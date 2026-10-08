// Literal vendor endpoints must never be interpreted as an administrator's
// vendor ID, even when they are registered after the details route.
export const VENDOR_DETAILS_ROUTE = "/api/vendors/:id([1-9]\\d*)";
