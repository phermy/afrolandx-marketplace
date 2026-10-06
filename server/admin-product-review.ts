import type { RequestHandler } from "express";
import { storage } from "./storage";
import { approveProduct } from "./admin-product-bulk";
import { hasSupportManagementAccess } from "../shared/admin-access";
import { getProductApprovalIssues, productApprovalMessage } from "../shared/product-approval";

type ReviewStorage = Pick<typeof storage, "getUser" | "getProduct" | "getVendor" | "getCategories" | "updateProductStatus">;

export function createProductReviewHandlers(store: ReviewStorage, approve: typeof approveProduct) {
  // Both canonical admin URLs and the legacy status URL check current account
  // authorization; session role claims alone never grant reviewer access.
  const handler = (action: (id: number, req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => Promise<unknown>): RequestHandler =>
    async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      try {
        const actor = await store.getUser((req.user as any)?.id);
        if (!hasSupportManagementAccess(actor)) {
          return void res.status(403).json({ message: "Verified Admin access is required to review products." });
        }
        const id = /^\d+$/.test(req.params.id) ? Number(req.params.id) : NaN;
        if (!Number.isSafeInteger(id) || id <= 0) {
          return void res.status(400).json({ message: "Invalid product ID." });
        }
        await action(id, req, res);
      } catch (error) {
        console.error("Product review failed:", error);
        res.status(500).json({ message: "Could not complete the product review. Please try again." });
      }
    };

  const getDetails = handler(async (id, _req, res) => {
    const product = await store.getProduct(id);
    if (!product) return res.status(404).json({ message: productApprovalMessage("not_found"), reason: "not_found" });
    const [vendor, categories] = await Promise.all([store.getVendor(product.vendorId), store.getCategories()]);
    const category = categories.find(category => category.id === product.categoryId);
    // Business identity is sufficient for review. Never expose vendor owner
    // account identifiers/contact records through this staff-privacy exception.
    return res.json({
      product,
      vendor: vendor ? { id: vendor.id, businessName: vendor.businessName, status: vendor.status, verificationStatus: vendor.verificationStatus } : null,
      category: category ? { id: category.id, name: category.name } : null,
      approvalIssues: getProductApprovalIssues(product, vendor, Boolean(category)),
    });
  });

  const updateStatus = handler(async (id, req, res) => {
    const status = req.body?.status;
    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid product status." });
    }
    if (status === "approved") {
      const result = await approve(id);
      if (!result.approved) {
        return res.status(result.reason === "not_found" ? 404 : 409).json({
          message: productApprovalMessage(result.reason), reason: result.reason,
        });
      }
    } else {
      if (!await store.getProduct(id)) return res.status(404).json({ message: productApprovalMessage("not_found"), reason: "not_found" });
      await store.updateProductStatus(id, status);
    }
    return res.json({ message: "Product status updated." });
  });
  return { getDetails, updateStatus };
}

export const productReviewHandlers = createProductReviewHandlers(storage, approveProduct);
