// Only an existing, email-verified designated owner can receive the
// non-delegable superadmin role. Ordinary admin APIs never issue this role.
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