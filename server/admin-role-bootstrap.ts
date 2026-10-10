// The designated owner is seeded on startup and cannot lose access through
// role management. Verified superadmins may delegate the role to other users.
export const DESIGNATED_OWNER_EMAIL = "femi.elegbeleye@afrolandx.com";

export function isDesignatedOwnerEmail(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === DESIGNATED_OWNER_EMAIL;
}

export function bootstrappedAdminRoles(
  currentRoles: unknown,
  isVerifiedOwner: boolean,
): string[] {
  const roles = new Set(
    Array.isArray(currentRoles)
      ? currentRoles.filter((role): role is string => typeof role === "string")
      : ["customer"],
  );
  roles.add("admin");
  if (isVerifiedOwner) roles.add("superadmin");
  return Array.from(roles);
}