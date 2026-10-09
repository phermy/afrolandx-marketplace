import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, RefreshCw } from "lucide-react";

type Evidence = { id: number; kind: string; originalName: string; bytes: number; uploadedAt: string };
type RelatedBusiness = { id: number; businessName: string; status: string };
type MonitoringReview = { id: number; notes: string; createdAt: string; reviewerName: string };
type Detail = { vendor?: any; evidence: Evidence[]; review?: any; duplicatesCount: number; duplicates?: RelatedBusiness[]; monitoringReviews?: MonitoringReview[]; needs: string[] };
const needLabels: Record<string, string> = {
  business_details: "Save the business contact, name, phone number, registration number and description.",
  cac_certificate: "Upload a CAC registration certificate.",
  cac_certificate_missing: "Upload a CAC registration certificate.",
  missing_cac_certificate: "Upload a CAC registration certificate.",
  identity_authority: "Upload proof that you may act for this business.",
  identity_authority_missing: "Upload proof that you may act for this business.",
  missing_identity_authority: "Upload proof that you may act for this business.",
  cac_number_invalid: "Provide a valid CAC registration number.",
  invalid_cac_number: "Provide a valid CAC registration number.",
  valid_cac_number: "Provide a valid CAC registration number, such as RC followed by its registration digits.",
  application_not_submitted: "The application must be submitted before review.",
  not_submitted: "The application must be submitted before review.",
  duplicate_resolution_required: "Record how the possible matching business records were resolved.",
  duplicates_unresolved: "Record how the possible matching business records were resolved.",
  first_review_required: "A first CAC Public Search review is required.",
  both_documents_required: "Upload both required documents before review.",
};
function readableNeed(code: string) {
  const normalized = code.trim().toLowerCase();
  if (needLabels[normalized]) return needLabels[normalized];
  if (normalized.includes("cac") && normalized.includes("certificate")) return "Upload a CAC registration certificate.";
  if (normalized.includes("identity") || normalized.includes("authority")) return "Upload proof that you may act for this business.";
  if (normalized.includes("duplicate")) return "Record how the possible matching business records were resolved.";
  if (normalized.includes("submit")) return "Submit the application before review.";
  if (normalized.includes("cac") && (normalized.includes("valid") || normalized.includes("number"))) return "Provide a valid CAC registration number.";
  return normalized.replace(/[_-]+/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
}
export default function VendorOnboardingReview({ vendorId }: { vendorId: number }) {
  const query = useQuery<Detail>({
    queryKey: ["/api/admin/vendors", vendorId, "onboarding"],
    queryFn: async () => (await apiRequest("GET", `/api/admin/vendors/${vendorId}/onboarding`)).json(),
  });
  if (query.isLoading) return <div className="space-y-3 py-3" aria-busy="true"><div className="h-5 w-1/3 animate-pulse rounded bg-stone-200" /><div className="h-16 animate-pulse rounded bg-stone-100" /></div>;
  if (query.error || !query.data) return <div role="alert" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900"><p>Application evidence could not be loaded.</p><Button size="sm" variant="outline" className="mt-3" onClick={() => query.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button></div>;
  const detail = query.data;
  return <section className="space-y-4 rounded-xl border border-stone-200 bg-[#fbfaf7] p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-[#193d32]">Application evidence and approvals</h3><Badge variant="outline">{detail.vendor?.status || "pending"}</Badge></div>
    {detail.duplicatesCount > 0 && <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{detail.duplicatesCount} possible matching business record{detail.duplicatesCount === 1 ? "" : "s"} need a documented resolution.</p>}
     {detail.needs.length > 0 && <ul className="list-inside list-disc text-sm text-amber-800">{detail.needs.map(item => <li key={item}>{readableNeed(item)}</li>)}</ul>}
     {!!detail.duplicates?.length && <div className="space-y-2">
       <h4 className="text-sm font-semibold text-[#5f4c2e]">Related business records</h4>
       <p className="text-xs leading-5 text-stone-600">These records share registration details. Review each before resolving possible duplicates.</p>
       <ul className="grid gap-2 sm:grid-cols-2">{detail.duplicates.map(business => <li key={business.id} className="rounded-lg border border-amber-200 bg-white p-3 text-sm">
         <span className="font-medium text-[#34483d]">{business.businessName}</span>
         <span className="mt-1 block text-xs text-stone-600">Business ID {business.id} · <span className="capitalize">{business.status}</span></span>
       </li>)}</ul>
     </div>}
    <div className="grid gap-2 sm:grid-cols-2">{detail.evidence.map(file => <a key={file.id} href={`/api/vendor-application/evidence/${file.id}/download`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white p-3 text-sm hover:border-[#799c84] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#316d55]">
       <FileText className="h-5 w-5 shrink-0 text-[#a35c3f]" /><span className="min-w-0 flex-1 truncate">{file.originalName}<small className="block text-xs text-stone-500">{file.kind === "cac_certificate" ? "CAC certificate" : "Proof you may act for this business"} · {new Date(file.uploadedAt).toLocaleDateString()}</small></span><span className="text-xs text-[#316d55]">Download</span>
    </a>)}</div>
    <div className="grid gap-3 border-t border-stone-200 pt-3 sm:grid-cols-2">
      <p className="text-sm"><span className="block text-xs text-stone-500">First CAC review</span>{detail.review?.firstReviewerName ? `${detail.review.firstReviewerName} · ${detail.review.firstReviewedAt ? new Date(detail.review.firstReviewedAt).toLocaleString() : "Recorded"}` : "Not yet recorded"}</p>
      <p className="text-sm"><span className="block text-xs text-stone-500">Final approval</span>{detail.review?.secondReviewerName ? `${detail.review.secondReviewerName} · ${detail.review.secondReviewedAt ? new Date(detail.review.secondReviewedAt).toLocaleString() : "Recorded"}` : "Awaiting a different authorised reviewer"}</p>
    </div>
     <div className="border-t border-stone-200 pt-3">
       <h4 className="font-semibold text-[#193d32]">Monitoring review history</h4>
       {detail.monitoringReviews?.length ? <ol className="mt-3 space-y-3">
         {detail.monitoringReviews.map(item => <li key={item.id} className="rounded-lg border border-stone-200 bg-white p-3">
           <div className="flex flex-wrap justify-between gap-2 text-xs text-stone-500"><span>{item.reviewerName || "Afrolandx reviewer"}</span><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time></div>
           <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-700">{item.notes}</p>
         </li>)}
       </ol> : <p className="mt-2 text-sm text-stone-500">No monitoring reviews recorded yet.</p>}
     </div>
  </section>;
}
