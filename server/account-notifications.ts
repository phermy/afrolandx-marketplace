import { db } from "./db";
import { logisticsEmailOutbox } from "../shared/schema";

// Reuse the existing durable non-financial email queue. No mail-provider error
// can undo an approved application or a completed password change.
export async function queueAccountEmail(email: string | null | undefined, subject: string, message: string) {
  if (!email) return;
  await db.insert(logisticsEmailOutbox).values({ recipient: email, subject, message });
}

export function vendorStatusMessage(status: string, previousStatus: string, reason?: string) {
  const title = status === "approved"
    ? previousStatus === "suspended" ? "Vendor account reactivated" : "Vendor application approved"
    : status === "rejected" ? "Vendor application rejected"
    : status === "suspended" ? "Vendor account suspended" : "Vendor application awaiting review";
  const description = status === "approved"
    ? "You can sign in and manage your listings. Products still require approval before shoppers can buy them."
    : status === "rejected"
      ? "Your application was not approved. Contact support if you need help with the next steps."
      : status === "suspended"
        ? "Your selling access has been suspended. Your historical orders and records are retained. Contact support for assistance."
        : "Your application is awaiting review. Submission does not grant permission to sell.";
  return { title, message: `${description}${reason ? `\nReason: ${reason}` : ""}\nFor assistance, contact support@afrolandx.com.` };
}

export async function notifyVendorStatus(vendor: { status: string }, applicant: { email?: string | null }, status: string, reason?: string) {
  if (vendor.status === status) return;
  const message = vendorStatusMessage(status, vendor.status, reason);
  await queueAccountEmail(applicant.email, message.title, message.message);
}
