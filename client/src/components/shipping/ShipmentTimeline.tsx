import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AlertCircle, Check, Clock3, ExternalLink, MapPin, MessageSquare, PackageCheck, Truck } from "lucide-react";
import { shipmentStatusLabels } from "@shared/logistics";
import type { ShipmentView } from "@shared/logistics";

const statusOrder = ["preparing", "ready_for_pickup", "pickup_scheduled", "collected", "in_transit", "out_for_delivery", "delivered"];
const safeTrackingUrl = (value?: string | null) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch { return null; }
};
function describeIssueError(error: unknown) {
  if (!(error instanceof Error)) return "Could not send that report. Please try again.";
  const raw = error.message.replace(/^\d{3}:\s*/, "");
  try {
    const parsed = JSON.parse(raw);
    return parsed.message || parsed.error || raw;
  } catch {
    return raw || "Could not send that report. Please try again.";
  }
}

export default function ShipmentTimeline({ orderId }: { orderId: number }) {
  const { data, isLoading, isError, refetch } = useQuery<{ shipments: ShipmentView[] }>({
    queryKey: ["/api/logistics/shipments", { orderId }],
    queryFn: async () => {
      const response = await fetch(`/api/logistics/shipments?orderId=${encodeURIComponent(orderId)}`, { credentials: "include" });
      if (!response.ok) throw new Error("Could not load shipment updates");
      return response.json();
    },
    enabled: Number.isFinite(orderId),
    refetchInterval: 30000,
    staleTime: 0,
  });
  if (isLoading) return <div className="mt-4 rounded-xl border border-teal-100 bg-teal-50/50 p-4"><div className="h-4 w-40 animate-pulse rounded bg-teal-100" /><div className="mt-3 h-3 w-full animate-pulse rounded bg-teal-100" /></div>;
  if (isError) return <div className="mt-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><span>Shipment details are temporarily unavailable.</span><button onClick={() => refetch()} className="underline">Retry</button></div>;
  const shipments = data?.shipments || [];
  if (!shipments.length) return <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Shipment tracking will appear here when fulfillment begins.</div>;

  return <section className="mt-4 space-y-3 rounded-xl border border-teal-100 bg-[#f5fbf9] p-4" aria-label={`Shipment timeline for order ${orderId}`}>
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-slate-900">Shipment timeline</h3>
      <span className="text-[11px] text-slate-500">Manual updates · refreshes every 30 seconds</span>
    </div>
    {shipments.map((shipment) => {
      const activeIndex = statusOrder.indexOf(shipment.status);
      const tracking = safeTrackingUrl(shipment.trackingUrl);
      return <article key={shipment.id} className="rounded-lg border border-white bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-teal-800">Shipment {shipment.id}</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{shipmentStatusLabels[shipment.status] || shipment.status}</p>
            <p className="mt-1 text-xs text-slate-500">Fulfilled by {shipment.partnerName || "Afrolandx shipping team"}</p>
          </div>
          {tracking && <a href={tracking} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-teal-200 px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-50">Track shipment <ExternalLink className="h-3 w-3" /></a>}
        </div>
        {shipment.trackingNumber && <p className="mt-3 flex items-center gap-2 font-mono text-xs text-slate-600"><Truck className="h-3.5 w-3.5" />{shipment.trackingNumber}</p>}
        <div className="relative mt-5 grid grid-cols-4 gap-1 sm:grid-cols-7">
          <div className="absolute left-2 right-2 top-2 h-px bg-slate-200" />
          {statusOrder.map((status, index) => {
            const past = activeIndex >= index && activeIndex >= 0;
            const current = shipment.status === status;
            return <div key={status} className="relative z-10 flex min-w-0 flex-col items-center gap-2 text-center">
              <span className={`grid h-4 w-4 place-items-center rounded-full border-2 ${past ? "border-teal-700 bg-teal-700" : "border-slate-300 bg-white"}`}>{past && <Check className="h-2.5 w-2.5 text-white" />}</span>
              <span className={`text-[9px] leading-tight sm:text-[10px] ${current ? "font-bold text-teal-900" : "text-slate-500"}`}>{shipmentStatusLabels[status as keyof typeof shipmentStatusLabels]}</span>
            </div>;
          })}
        </div>
        {shipment.status === "delayed" && <p className="mt-3 flex gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900"><Clock3 className="h-4 w-4 shrink-0" />Your delivery is delayed. See the latest update below.</p>}
        {shipment.status === "delivery_failed" && <p className="mt-3 flex gap-2 rounded-md bg-rose-50 p-2 text-xs text-rose-900"><AlertCircle className="h-4 w-4 shrink-0" />A delivery attempt could not be completed. Please contact support if you need help.</p>}
        {shipment.status === "returned" && <p className="mt-3 flex gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900"><PackageCheck className="h-4 w-4 shrink-0" />This shipment is being returned to the sender.</p>}
        {shipment.deliveryAddress && <p className="mt-3 flex items-start gap-2 text-xs text-slate-500"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />{[shipment.deliveryAddress.address1, shipment.deliveryAddress.address2, shipment.deliveryAddress.city, shipment.deliveryAddress.state, shipment.deliveryAddress.country].filter(Boolean).join(", ")}</p>}
        {shipment.events?.length > 0 && <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
          {shipment.events.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((event) => <div key={event.id} className="flex gap-2 text-xs">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-700" />
            <span className="min-w-0 flex-1"><strong className="font-semibold text-slate-800">{event.status ? shipmentStatusLabels[event.status as keyof typeof shipmentStatusLabels] || event.status : event.type}</strong><span className="text-slate-600"> — {event.note}</span><span className="ml-2 text-slate-400">{new Date(event.createdAt).toLocaleString()} · {event.source}</span></span>
          </div>)}
        </div>}
        <ShipmentIssueForm shipmentId={shipment.id} orderId={orderId} />
      </article>;
    })}
  </section>;
}

function ShipmentIssueForm({ shipmentId, orderId }: { shipmentId: number; orderId: number }) {
  const cache = useQueryClient();
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const issue = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/logistics/shipments/${shipmentId}/issues`, { message: message.trim() });
      return response.json().catch(() => null);
    },
    onSuccess: () => {
      setMessage("");
      setSent(true);
      cache.invalidateQueries({ queryKey: ["/api/logistics/shipments", { orderId }] });
    },
  });
  return <div className="mt-4 border-t border-teal-100 pt-3">
    <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); setSent(false); issue.mutate(); }}>
      <input value={message} onChange={(event) => setMessage(event.target.value)} minLength={10} maxLength={2000} placeholder="Report a shipment issue, even after delivery" className="h-10 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100" />
      <button disabled={message.trim().length < 10 || issue.isPending} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-800 px-4 text-sm font-semibold text-white disabled:opacity-50"><MessageSquare className="h-4 w-4" />{issue.isPending ? "Sending…" : "Report issue"}</button>
    </form>
    {sent && <p className="mt-2 text-xs font-medium text-teal-800">Your report has been sent to the shipping team.</p>}
    {issue.isError && <p role="alert" className="mt-2 text-xs text-rose-700">{describeIssueError(issue.error)}</p>}
  </div>;
}
