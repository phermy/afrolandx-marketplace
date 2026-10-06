// Used by both private review and transactional approval, so the explanation
// staff see cannot diverge from the checks applied at the status write.
const messages: Record<string, string> = {
  not_found: "This product no longer exists. Refresh the product review list.",
  not_pending: "Only products submitted for review can be approved. Refresh the list to check its current status.",
  vendor_not_found: "The vendor for this product could not be found.",
  vendor_not_approved: "Approve the vendor application before approving this product.",
  vendor_not_verified: "Complete the vendor's required business verification before approving this product.",
  missing_name: "The vendor must add a product name before this product can be approved.",
  missing_description: "The vendor must add a product description before this product can be approved.",
  invalid_price: "The vendor must set a product price greater than zero before approval.",
  invalid_stock: "Product stock must be a whole number of zero or more.",
  invalid_category: "Assign this product to an existing category before approval.",
  missing_image: "The vendor must upload at least one product photo before this product can be approved.",
  no_longer_eligible: "This product changed during review. Refresh its details before trying again.",
};

export function productApprovalMessage(reason: string): string {
  return messages[reason] || "This product cannot be approved yet. Review its listing requirements and try again.";
}

type ReviewProduct = {
  status?: string | null; name?: string | null; description?: string | null;
  price: unknown; stock: number | null; images?: unknown; imageUrl?: unknown;
};
type ReviewVendor = { status?: string | null; verificationStatus?: string | null };

export function getProductApprovalIssues(product: ReviewProduct, vendor: ReviewVendor | null | undefined, categoryExists: boolean) {
  const codes: string[] = [];
  if (product.status !== "pending") codes.push("not_pending");
  if (!vendor) codes.push("vendor_not_found");
  else {
    if (vendor.status !== "approved") codes.push("vendor_not_approved");
    if (vendor.verificationStatus !== "verified") codes.push("vendor_not_verified");
  }
  if (typeof product.name !== "string" || !product.name.trim()) codes.push("missing_name");
  if (typeof product.description !== "string" || !product.description.trim()) codes.push("missing_description");
  const price = Number(product.price);
  if (!Number.isFinite(price) || price <= 0) codes.push("invalid_price");
  if (!Number.isInteger(product.stock) || product.stock === null || product.stock < 0) codes.push("invalid_stock");
  if (!categoryExists) codes.push("invalid_category");
  const hasImage = (Array.isArray(product.images) && product.images.some(image => typeof image === "string" && image.trim().length > 0))
    || (typeof product.imageUrl === "string" && product.imageUrl.trim().length > 0);
  if (!hasImage) codes.push("missing_image");
  return codes.map(code => ({ code, message: productApprovalMessage(code) }));
}
