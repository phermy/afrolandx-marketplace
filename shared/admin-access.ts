export type ManagementAccount = {
  id?: string; roles?: unknown; emailVerified?: boolean | null; closedAt?: unknown;
};
export function hasFullManagementAccess(account: ManagementAccount | null | undefined): boolean {
  return Boolean(account && !account.closedAt && account.emailVerified &&
    Array.isArray(account.roles) && account.roles.includes("admin") && account.roles.includes("superadmin"));
}
export function hasSupportManagementAccess(account: ManagementAccount | null | undefined): boolean {
  return Boolean(account && !account.closedAt && account.emailVerified && Array.isArray(account.roles) && account.roles.includes("admin"));
}
// Shipping operations are delegated to all verified Admins, independently of
// Superadmin-only platform, account-role, and finance administration.
export const hasShippingOperationsAccess = hasSupportManagementAccess;
export function isAdministratorAccount(account: ManagementAccount | null | undefined): boolean {
  return Boolean(account && Array.isArray(account.roles) &&
    (account.roles.includes("admin") || account.roles.includes("superadmin")));
}
export function isCustomerOrVendorAccount(account: ManagementAccount | null | undefined): boolean {
  return Boolean(account && !isAdministratorAccount(account) && Array.isArray(account.roles) &&
    (account.roles.includes("customer") || account.roles.includes("vendor")));
}
const supportRoutes: Record<string, RegExp[]> = {
  GET: [/^\/users(?:\/[^/]+)?$/, /^\/vendors$/, /^\/products\/(?:pending|\d+)$/, /^\/orders$/, /^\/shipping-quote-requests$/, /^\/reviews$/],
  POST: [/^\/products\/bulk-approve$/, /^\/vendors\/\d+\/products$/],
  PATCH: [/^\/products\/\d+\/status$/, /^\/vendors\/\d+\/(?:verification|status)$/, /^\/orders\/\d+\/(?:status|tracking)$/, /^\/shipping-quote-requests\/\d+$/, /^\/reviews\/\d+\/moderation$/],
};
export function isSupportManagementRoute(method: string, path: string): boolean {
  return supportRoutes[method.toUpperCase()]?.some(pattern => pattern.test(path.replace(/\/$/, "") || "/")) || false;
}
