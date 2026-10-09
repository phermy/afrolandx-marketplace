import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RefreshCw, Activity } from "lucide-react";

type MonitorVendor = { id: number; businessName: string; status: string; reviewDue: boolean; missingEvidence: string[]; duplicatesCount: number; orders30d: number; lateOrders: number; refunds30d: number; disputes30d: number; nextReviewAt?: string; lastMonitoredAt?: string };
export default function VendorMonitoring() {
  const client = useQueryClient();
  const [notes, setNotes] = useState<Record<number, string>>({});
  const query = useQuery<{ vendors: MonitorVendor[] }>({
    queryKey: ["/api/admin/vendor-monitoring"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/vendor-monitoring")).json(),
  });
  const reviewMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("POST", `/api/admin/vendors/${id}/monitoring`, { notes: notes[id] || "" }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["/api/admin/vendor-monitoring"] }); await client.invalidateQueries({ queryKey: ["/api/admin/vendors"] }); },
  });
  if (query.isLoading) return <div className="space-y-3 p-4" aria-label="Loading vendor monitoring" aria-busy="true"><div className="h-16 animate-pulse rounded-lg bg-stone-100" /><div className="h-16 animate-pulse rounded-lg bg-stone-100" /></div>;
  if (query.error) return <div role="alert" className="m-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">Monitoring data is unavailable. <Button size="sm" variant="outline" onClick={() => query.refetch()}><RefreshCw className="mr-1 h-4 w-4" />Retry</Button></div>;
  const vendors = query.data?.vendors || [];
  return <div className="space-y-4">
    <div className="flex items-start gap-3 rounded-lg border border-[#e6d9c2] bg-[#faf5ea] p-4 text-sm leading-6 text-[#675a43]"><Activity className="mt-0.5 h-5 w-5 shrink-0 text-[#a35c3f]" /><p>Manual business health reviews use recent order, refund and recorded chargeback signals. Late handling counts are paid orders still pending or processing beyond the vendor published processing time, measured from order creation. They indicate dispatch handling needs review, not carrier delivery lateness. Recorded chargebacks are not a count of all customer complaints. Monitoring records a staff review only and does not automatically suspend a business.</p></div>
    {vendors.length === 0 ? <div className="rounded-xl border border-dashed border-stone-300 p-8 text-center"><p className="font-semibold">No businesses to monitor</p><p className="mt-1 text-sm text-stone-500">Approved businesses will appear here when available.</p></div> : vendors.map(vendor => <article key={vendor.id} className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-[#193d32]">{vendor.businessName}</h3><p className="mt-1 text-xs capitalize text-stone-500">{vendor.status} · {vendor.reviewDue ? "Review due" : "Review current"}{vendor.nextReviewAt ? ` · next review ${new Date(vendor.nextReviewAt).toLocaleDateString()}` : ""}</p></div>{vendor.duplicatesCount > 0 && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-900">{vendor.duplicatesCount} possible duplicates</span>}</div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">{[["Orders, 30 days", vendor.orders30d], ["Dispatch handling review", vendor.lateOrders], ["Refunds, 30 days", vendor.refunds30d], ["Recorded chargebacks", vendor.disputes30d], ["Missing evidence", vendor.missingEvidence.length]].map(([label, value]) => <div key={label} className="rounded-lg bg-[#f7f5ef] p-2.5"><p className="text-[11px] leading-4 text-stone-500">{label}</p><p className="mt-1 font-mono text-lg font-semibold text-[#344b40]">{value}</p></div>)}</div>
      {!!vendor.missingEvidence.length && <p className="mt-3 text-xs text-amber-800">Missing: {vendor.missingEvidence.join(", ")}</p>}
      <div className="mt-4"><Label htmlFor={`monitor-${vendor.id}`}>Monitoring notes</Label><Textarea id={`monitor-${vendor.id}`} rows={2} value={notes[vendor.id] || ""} onChange={event => setNotes(current => ({ ...current, [vendor.id]: event.target.value }))} placeholder="Record what you reviewed and any follow up needed. At least 20 characters." /></div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-stone-500">Last monitored: {vendor.lastMonitoredAt ? new Date(vendor.lastMonitoredAt).toLocaleDateString() : "Not yet reviewed"}</p><Button size="sm" className="bg-[#245c49] text-white hover:bg-[#1a493a]" disabled={(notes[vendor.id] || "").trim().length < 20 || reviewMutation.isPending} onClick={() => reviewMutation.mutate(vendor.id)}>{reviewMutation.isPending ? "Recording…" : "Record manual review"}</Button></div>
      {reviewMutation.isError && <p className="mt-2 text-sm text-red-700" role="alert">{reviewMutation.error instanceof Error ? reviewMutation.error.message.replace(/^\d{3}:\s*/, "") : "Review could not be recorded."}</p>}
    </article>)}
  </div>;
}
