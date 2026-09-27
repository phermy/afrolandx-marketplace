import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { users, vendors } from "../shared/schema";
import { isDesignatedOwnerEmail } from "./admin-role-bootstrap";
import { hasManualCacReview } from "./cac-review";

const managedRoles = ["customer", "vendor", "admin", "superadmin"] as const;
type ManagedRole = (typeof managedRoles)[number];
type RoleMutation = { role: string; enabled: boolean } | { roles: unknown };

export class RoleManagementError extends Error {
  constructor(message: string, public readonly status = 409) {
    super(message);
  }
}

function isManagedRole(role: unknown): role is ManagedRole {
  return typeof role === "string" && (managedRoles as readonly string[]).includes(role);
}

function parseRoles(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((role): role is string => typeof role === "string") : [];
}

type LockedAccount = { id: string; email: string | null; email_verified: boolean; roles: unknown; closed_at: Date | null };

export async function lockVerifiedSuperadminAndTarget(
  tx: { execute: (query: any) => Promise<any> },
  actorId: string,
  targetId: string,
): Promise<{ actor: LockedAccount; target: LockedAccount }> {
  if (actorId === targetId) throw new RoleManagementError("You cannot change your own roles.", 403);
  const result = await tx.execute(sql`
    SELECT id, email, email_verified, roles, closed_at FROM users
    WHERE id IN (${actorId}, ${targetId}) ORDER BY id FOR UPDATE
  `);
  const rows = result.rows as LockedAccount[];
  const actor = rows.find(row => row.id === actorId);
  const target = rows.find(row => row.id === targetId);
  const actorRoles = parseRoles(actor?.roles);
  if (!actor || actor.closed_at || !actor.email_verified || !actorRoles.includes("admin") || !actorRoles.includes("superadmin")) {
    throw new RoleManagementError("Verified superadmin access is required.", 403);
  }
  if (!target) throw new RoleManagementError("User not found.", 404);
  if (target.closed_at) throw new RoleManagementError("This account is closed.", 409);
  return { actor, target };
}

export function assertRoleTargetMutable(actorId: string, targetId: string, email: string | null): void {
  if (actorId === targetId) throw new RoleManagementError("You cannot change your own roles.", 403);
  if (isDesignatedOwnerEmail(email)) {
    throw new RoleManagementError("The designated owner's roles cannot be changed.", 403);
  }
}

export async function updateManagedRoles(actorId: string, targetId: string, mutation: RoleMutation): Promise<string[]> {
  if (!targetId) throw new RoleManagementError("User ID is required.", 400);
  assertRoleTargetMutable(actorId, targetId, null);
  if ("role" in mutation && !isManagedRole(mutation.role)) {
    throw new RoleManagementError("Invalid role.", 400);
  }
  if ("roles" in mutation && (!Array.isArray(mutation.roles) || !mutation.roles.every(isManagedRole))) {
    throw new RoleManagementError("Invalid roles array.", 400);
  }

  return db.transaction(async tx => {
    const { target } = await lockVerifiedSuperadminAndTarget(tx, actorId, targetId);
    assertRoleTargetMutable(actorId, targetId, target.email);

    const current = parseRoles(target.roles);
    const next = new Set(current);
    if ("role" in mutation) {
      if (mutation.enabled) {
        next.add(mutation.role);
        if (mutation.role === "superadmin") next.add("admin");
      } else {
        next.delete(mutation.role);
      }
    } else {
      for (const role of managedRoles) next.delete(role);
      for (const role of mutation.roles as ManagedRole[]) next.add(role);
    }
    if (next.has("superadmin") && !target.email_verified) {
      throw new RoleManagementError("Verify the user's email before granting superadmin access.");
    }
    if (next.has("superadmin") && !next.has("admin")) {
      throw new RoleManagementError("Remove Superadmin before removing Admin.");
    }
    if (!next.size) next.add("customer");
    const roles = Array.from(next);
    await tx.update(users).set({ roles, updatedAt: new Date() }).where(eq(users.id, targetId));
    return roles;
  });
}

export async function approveVendorWithRole(actorId: string, vendorId: number) {
  return db.transaction(async tx => {
    const [record] = await tx.select().from(vendors).where(eq(vendors.id, vendorId));
    if (!record) throw new RoleManagementError("Vendor not found.", 404);
    const { target } = await lockVerifiedSuperadminAndTarget(tx, actorId, record.userId);
    assertRoleTargetMutable(actorId, record.userId, target.email);
    const locked = await tx.execute(sql`
      SELECT verification_status, verification_notes FROM vendors WHERE id = ${vendorId} FOR UPDATE
    `);
    if (locked.rows[0]?.verification_status !== "verified" ||
      !hasManualCacReview(locked.rows[0]?.verification_notes as string | null)) {
      throw new RoleManagementError("Complete a documented review using CAC Public Search before approval.");
    }
    const [updated] = await tx.update(vendors).set({ status: "approved", updatedAt: new Date() })
      .where(eq(vendors.id, vendorId)).returning();
    const roles = new Set(parseRoles(target.roles));
    if (!roles.has("vendor")) {
      roles.add("vendor");
      await tx.update(users).set({ roles: Array.from(roles), updatedAt: new Date() })
        .where(eq(users.id, record.userId));
    }
    return updated;
  });
}