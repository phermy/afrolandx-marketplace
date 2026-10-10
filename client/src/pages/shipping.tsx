import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import Navbar from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { isVendor } from "@/lib/roleUtils";
import { hasShippingOperationsAccess } from "@shared/admin-access";
import { useToast } from "@/hooks/use-toast";
import SplitShipmentForm from "@/components/shipping/SplitShipmentForm";
import ProviderConnections from "@/components/shipping/ProviderConnections";
import { shipmentStatusLabels, shipmentStatuses, shipmentTransitions } from "@shared/logistics";
import type { LogisticsAccess, LogisticsPartnerView, ShipmentView, ShipmentsResponse, ShipmentStatus } from "@shared/logistics";
import { AlertTriangle, ArrowUpRight, Check, ChevronDown, CircleAlert, ClipboardCheck, ExternalLink, Package, Plus, RefreshCw, ShieldAlert, Truck, Users } from "lucide-react";

type ActionArgs = { method: string; path: string; body?: unknown; success: string };
type ShipmentEventWithActor = NonNullable<ShipmentView["events"]>[number] & { actorName?: string };
const money = (value?: string | null) => value ? `₦${Number(value).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";
const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "Not recorded";
const validTrackingUrl = (value?: string | null) => {
  try { const url = new URL(value || ""); return url.protocol === "https:" ? url.toString() : null; } catch { return null; }
};
const fieldClass = "h-10 w-full rounded-md border border-[#d8e4e0] bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100";
const areaClass = "min-h-20 w-full rounded-md border border-[#d8e4e0] bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100";
const labelClass = "mb-1.5 block text-xs font-semibold text-slate-600";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block min-w-0"><span className={labelClass}>{label}</span>{children}</label>;
}
function SectionTitle({ eyebrow, title, detail }: { eyebrow: string; title: string; detail?: string }) {
  return <div className="mb-4"><p className="text-[10px] font-bold uppercase tracking-[.19em] text-teal-800">{eyebrow}</p><h2 className="mt-1 font-nigerian text-xl font-bold text-slate-900">{title}</h2>{detail && <p className="mt-1 text-sm text-slate-500">{detail}</p>}</div>;
}

export default function Shipping() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const admin = hasShippingOperationsAccess(user);
  const vendor = isVendor(user);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [busyShipment, setBusyShipment] = useState<number | null>(null);

  const accessQuery = useQuery<LogisticsAccess>({
    queryKey: ["/api/logistics/access", user?.id, admin],
    staleTime: 0,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });
  const access = accessQuery.data;
  const shipmentsQuery = useQuery<ShipmentsResponse>({
    queryKey: ["/api/logistics/shipments", user?.id, admin],
    enabled: !!access && (access.admin || !!access.vendorId || access.partnerIds.length > 0),
    refetchInterval: 30000,
    staleTime: 0,
  });
  const partnersQuery = useQuery<LogisticsPartnerView[]>({
    queryKey: ["/api/logistics/partners", user?.id, admin],
    enabled: !!access?.admin,
    staleTime: 0,
  });
  const action = useMutation({
    mutationFn: async ({ method, path, body }: ActionArgs) => {
      const response = await apiRequest(method, path, body);
      if (response.status === 204) return null;
      return response.json().catch(() => null);
    },
    onSuccess: (_result, variables) => {
      toast({ title: "Shipping updated", description: variables.success });
      queryClient.invalidateQueries({ queryKey: ["/api/logistics/shipments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logistics/partners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logistics/access"] });
      if (variables.path.includes("/invitations/") && variables.path.endsWith("/accept")) {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      }
    },
    onError: (error: Error) => toast({ title: "Could not save shipping update", description: error.message || "Please check the details and try again.", variant: "destructive" }),
    onSettled: () => setBusyShipment(null),
  });
  const run = (args: ActionArgs) => action.mutate(args);
  const data = shipmentsQuery.data;
  const shipments = data?.shipments || [];
  const partners = partnersQuery.data || [];
  const invitations = access?.invitations || [];
  const visibleShipments = useMemo(() => shipments.filter((shipment) => {
    const statusPass = filter === "all" || shipment.status === filter;
    const term = search.trim().toLowerCase();
    const searchPass = !term || [shipment.id, shipment.orderId, shipment.vendorName, shipment.partnerName, shipment.trackingNumber].some((value) => String(value || "").toLowerCase().includes(term));
    return statusPass && searchPass;
  }), [filter, search, shipments]);

  const refresh = () => {
    accessQuery.refetch();
    shipmentsQuery.refetch();
    partnersQuery.refetch();
  };

  if (accessQuery.isLoading) return <div className="min-h-[100dvh] bg-[#f3f7f5]"><Navbar /><div className="mx-auto max-w-6xl space-y-5 px-4 py-10"><div className="h-28 animate-pulse rounded-2xl bg-white" /><div className="h-64 animate-pulse rounded-2xl bg-white" /></div></div>;
  if (accessQuery.isError) return <><Navbar /><main className="min-h-[70vh] bg-[#f3f7f5] px-4 py-16"><div className="mx-auto max-w-xl rounded-2xl border border-rose-200 bg-white p-8 text-center"><CircleAlert className="mx-auto h-10 w-10 text-rose-600" /><h1 className="mt-4 text-xl font-bold text-slate-900">Shipping access could not be checked</h1><p className="mt-2 text-sm text-slate-600">Refresh to retry. If your shipping invitation was recently changed, ask an administrator to confirm your access.</p><Button className="mt-5 bg-teal-800 hover:bg-teal-900" onClick={refresh}><RefreshCw className="mr-2 h-4 w-4" />Retry access check</Button></div></main></>;
  if (!access?.admin && !access?.vendorId && !access?.partnerIds?.length) return <><Navbar /><main className="min-h-[70vh] bg-[#f3f7f5] px-4 py-16"><div className="mx-auto max-w-xl rounded-2xl border border-[#dce7e2] bg-white p-8 text-center shadow-sm"><ShieldAlert className="mx-auto h-10 w-10 text-teal-800" /><h1 className="mt-4 font-nigerian text-2xl font-bold text-slate-900">Shipping workspace unavailable</h1><p className="mt-2 text-sm leading-6 text-slate-600">Your shipping access is not active. If you expected an invitation, contact your Afrolandx administrator.</p>{invitations.length > 0 && <div className="mt-6 rounded-xl bg-[#f4f8f6] p-4 text-left"><p className="text-xs font-bold uppercase tracking-wider text-teal-900">Invitations for your verified email</p>{invitations.map((invite) => <div key={invite.id} className="mt-3 flex items-center justify-between gap-3"><span className="text-sm text-slate-700">{invite.partnerName}</span><Button size="sm" disabled={action.isPending} onClick={() => run({ method: "POST", path: `/api/logistics/invitations/${invite.id}/accept`, body: {}, success: `You joined ${invite.partnerName}.` })}>Accept invitation</Button></div>)}</div>}</div></main></>;

  const roleLabel = access.admin ? "Administrator" : access.partnerIds.length ? "Shipping partner" : "Vendor pickup";
  return <div className="min-h-[100dvh] bg-[#f3f7f5] text-slate-800">
    <Navbar />
    <main className="mx-auto max-w-[1440px] px-4 pb-14 pt-7 sm:px-6 lg:px-8">
      <div className="relative mb-7 overflow-hidden rounded-[1.4rem] bg-[#103c38] px-6 py-7 text-white sm:px-9 sm:py-9">
        <div className="pointer-events-none absolute -right-14 -top-24 h-72 w-72 rounded-full border border-white/10" /><div className="pointer-events-none absolute -right-1 top-10 h-48 w-48 rounded-full border border-white/10" />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-5">
          <div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.18em] text-[#b8ded1]"><Truck className="h-3.5 w-3.5" />Operations desk · {roleLabel}</div><h1 className="font-nigerian text-3xl font-bold tracking-tight sm:text-4xl">Shipping, by hand.</h1><p className="mt-2 max-w-xl text-sm leading-6 text-[#c4dcd5]">A clear record of pickups, agency handoffs and delivery milestones. Updates are entered by the team; this workspace does not provide GPS or live carrier tracking.</p></div>
          <Button variant="outline" onClick={refresh} className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"><RefreshCw className={`mr-2 h-4 w-4 ${shipmentsQuery.isFetching ? "animate-spin" : ""}`} />Refresh list</Button>
        </div>
        <div className="relative z-10 mt-7 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[{ label: "Visible shipments", value: shipments.length }, { label: "In progress", value: shipments.filter((s) => !["delivered", "returned"].includes(s.status)).length }, { label: "Need attention", value: shipments.filter((s) => ["delayed", "delivery_failed"].includes(s.status)).length }, { label: "Eligible imports", value: access.admin ? data?.eligibleOrders?.length || 0 : "—" }].map((item) => <div key={item.label} className="rounded-xl border border-white/10 bg-white/[.07] px-4 py-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-[#b8d2ca]">{item.label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{item.value}</p></div>)}
        </div>
      </div>

      {!access.admin && invitations.length > 0 && <section className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-amber-950">Partner invitations</p><p className="mt-1 text-xs text-amber-800">Accept verified-email invitations to activate your partner access.</p></div><div className="flex flex-wrap gap-2">{invitations.map((invite) => <Button key={invite.id} size="sm" variant="outline" disabled={action.isPending} onClick={() => run({ method: "POST", path: `/api/logistics/invitations/${invite.id}/accept`, body: {}, success: `You joined ${invite.partnerName}.` })}>{invite.partnerName} · Accept</Button>)}</div></div></section>}

      {access.admin && user && <ProviderConnections userId={user.id} />}
      {access.admin && <AdminPartnerDesk partners={partners} loading={partnersQuery.isLoading} error={partnersQuery.isError} run={run} pending={action.isPending} />}
      {access.admin && !!data?.eligibleOrders?.length && <section className="mb-6 rounded-2xl border border-[#dce7e2] bg-white p-5 shadow-sm">
        <SectionTitle eyebrow="Backfill" title="Import a paid order" detail="Bring an eligible older order into manual shipping operations." />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end"><Field label="Eligible order"><select id="shipping-import-order" className={fieldClass} defaultValue=""><option value="" disabled>Select an order</option>{data.eligibleOrders.map((order) => <option key={order.id} value={order.id}>Order #{order.id} · {order.buyerName} · {new Date(order.createdAt).toLocaleDateString()}</option>)}</select></Field><Button disabled={action.isPending} onClick={() => { const value = (document.getElementById("shipping-import-order") as HTMLSelectElement)?.value; if (value) run({ method: "POST", path: `/api/logistics/orders/${value}/shipments`, body: {}, success: `Order #${value} imported into the shipping queue.` }); }}><Plus className="mr-2 h-4 w-4" />Import order</Button></div>
      </section>}

      <section className="rounded-2xl border border-[#dce7e2] bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div><SectionTitle eyebrow="Operations queue" title="Shipment register" detail="Status history refreshes automatically every 30 seconds." /></div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search shipment, order, vendor" className={`${fieldClass} sm:w-64`} />
            <select className={`${fieldClass} sm:w-48`} value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All statuses</option>{shipmentStatuses.map((status) => <option key={status} value={status}>{shipmentStatusLabels[status]}</option>)}</select>
          </div>
        </div>
        {shipmentsQuery.isLoading ? <div className="space-y-3">{[1, 2, 3].map((v) => <div key={v} className="h-36 animate-pulse rounded-xl bg-[#f1f6f3]" />)}</div> :
          shipmentsQuery.isError ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center"><CircleAlert className="mx-auto h-8 w-8 text-rose-600" /><p className="mt-2 font-semibold text-rose-900">Shipment list unavailable</p><p className="mt-1 text-sm text-rose-800">Access may have changed, or the request failed.</p><Button variant="outline" className="mt-4" onClick={() => shipmentsQuery.refetch()}>Retry list</Button></div> :
          !visibleShipments.length ? <div className="rounded-xl border border-dashed border-[#cddbd5] bg-[#f7faf8] px-5 py-12 text-center"><Package className="mx-auto h-9 w-9 text-teal-800/50" /><h3 className="mt-3 font-semibold text-slate-900">{shipments.length ? "No shipments match this view" : "Nothing in the queue yet"}</h3><p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{shipments.length ? "Try a different status or search term." : access.admin ? "Paid orders appear here when imported or when fulfillment creates a shipment." : vendor ? "Pickup work assigned to your vendor account will appear here." : "Shipments assigned to your partner account will appear here."}</p></div> :
          <div className="space-y-4">{visibleShipments.map((shipment) => <ShipmentCard key={shipment.id} shipment={shipment} admin={!!access.admin} vendor={access.vendorId === shipment.vendorId && !access.admin && !(shipment.readyAt && shipment.partnerId && access.partnerIds.includes(shipment.partnerId))} vendorId={access.vendorId} partner={!!shipment.partnerId && access.partnerIds.includes(shipment.partnerId) && !access.admin} partners={partners} run={run} pending={action.isPending} setBusy={setBusyShipment} busy={busyShipment === shipment.id} />)}</div>}
        {data?.notificationFailures ? <p className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900"><AlertTriangle className="h-4 w-4" />Some update notifications could not be delivered. The shipment records remain saved.</p> : null}
      </section>

      {access.admin && <div className="mt-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-[#fff9ed] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="font-semibold text-slate-900">Confirm the final customer shipping price</p><p className="mt-1 max-w-3xl text-sm leading-5 text-slate-600">Partner quote amounts are agency invoice costs, not customer checkout charges. Sum partner costs across multiple shipments for an order, then reconcile the buyer-facing final rate in the existing shipping quote panel.</p></div>
        <Link href="/admin" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-50">Open Admin · Shipping Quotes<ArrowUpRight className="h-4 w-4" /></Link>
      </div>}
    </main>
  </div>;
}

function AdminPartnerDesk({ partners, loading, error, run, pending }: { partners: LogisticsPartnerView[]; loading: boolean; error: boolean; run: (args: ActionArgs) => void; pending: boolean }) {
  const [showNew, setShowNew] = useState(false);
  const [invitePartner, setInvitePartner] = useState<number | null>(null);
  return <section className="mb-6 rounded-2xl border border-[#dce7e2] bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><SectionTitle eyebrow="Access & partner roster" title="Shipping partners" detail="Manage partner availability and invitation access." /><Button onClick={() => setShowNew((value) => !value)}><Plus className="mr-2 h-4 w-4" />{showNew ? "Close form" : "Add partner"}</Button></div>
    {showNew && <form className="mb-5 grid gap-3 rounded-xl bg-[#f4f8f6] p-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); run({ method: "POST", path: "/api/logistics/partners", body: { name: form.get("name"), contactEmail: form.get("contactEmail"), phone: form.get("phone") || undefined }, success: "Shipping partner created." }); event.currentTarget.reset(); setShowNew(false); }}>
      <Field label="Partner name"><input name="name" required minLength={2} maxLength={160} className={fieldClass} /></Field><Field label="Contact email"><input name="contactEmail" required type="email" className={fieldClass} /></Field><Field label="Phone (optional)"><input name="phone" type="tel" className={fieldClass} /></Field><div className="flex items-end"><Button type="submit" disabled={pending} className="w-full">Create partner</Button></div>
    </form>}
    {error ? <p className="rounded-lg bg-rose-50 p-4 text-sm text-rose-800">Partner roster could not load. Refresh the page to try again.</p> : loading ? <div className="h-20 animate-pulse rounded-lg bg-[#f1f6f3]" /> : partners.length === 0 ? <div className="rounded-xl border border-dashed border-[#cddbd5] p-6 text-center text-sm text-slate-500">No shipping partners are registered yet.</div> :
      <div className="space-y-3">{partners.map((partner) => <article key={partner.id} className="rounded-xl border border-[#e2ebe7] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{partner.name}</h3><Badge className={partner.active ? "bg-teal-100 text-teal-900 hover:bg-teal-100" : "bg-slate-100 text-slate-600 hover:bg-slate-100"}>{partner.active ? "Active" : "Paused"}</Badge></div><p className="mt-1 text-sm text-slate-500">{partner.contactEmail}{partner.phone ? ` · ${partner.phone}` : ""}</p></div><Button size="sm" variant="outline" disabled={pending} onClick={() => run({ method: "PATCH", path: `/api/logistics/partners/${partner.id}`, body: { active: !partner.active }, success: `${partner.name} ${partner.active ? "paused" : "resumed"}.` })}>{partner.active ? "Pause partner" : "Resume partner"}</Button></div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500"><Users className="mr-1 inline h-3.5 w-3.5" />Members & invitations</p><Button size="sm" variant="ghost" onClick={() => setInvitePartner(invitePartner === partner.id ? null : partner.id)}><Plus className="mr-1 h-3.5 w-3.5" />Invite member</Button></div>
        {invitePartner === partner.id && <form className="mt-2 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); run({ method: "POST", path: `/api/logistics/partners/${partner.id}/invitations`, body: { email: form.get("email") }, success: "Partner invitation sent." }); event.currentTarget.reset(); setInvitePartner(null); }}><input name="email" type="email" required placeholder="name@company.com" className={`${fieldClass} sm:max-w-xs`} /><Button size="sm" disabled={pending}>Send invitation</Button></form>}
        <div className="mt-3 divide-y divide-slate-100">{partner.members.map((member) => <div key={member.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span className="text-slate-700">{member.email}<span className="ml-2 text-xs text-slate-400">{member.accepted ? "Accepted" : "Invitation pending"}</span></span><Button size="sm" variant="ghost" disabled={pending || !member.active} onClick={() => run({ method: "PATCH", path: `/api/logistics/members/${member.id}`, body: { active: false }, success: `Access for ${member.email} revoked.` })}>{member.active ? "Revoke access" : "Revoked"}</Button></div>)}</div>
      </article>)}</div>}
  </section>;
}

function ShipmentCard({ shipment, admin, vendor, vendorId, partner, partners, run, pending, setBusy, busy }: { shipment: ShipmentView; admin: boolean; vendor: boolean; vendorId: number | null; partner: boolean; partners: LogisticsPartnerView[]; run: (args: ActionArgs) => void; pending: boolean; setBusy: (id: number | null) => void; busy: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [selectedStatus, setStatus] = useState<ShipmentStatus>(vendor ? "ready_for_pickup" : "pickup_scheduled");
  const [correction, setCorrection] = useState(false);
  const [reason, setReason] = useState("");
  const chosenPartner = partners.find((item) => item.active)?.id;
  const approvedQuote = shipment.quotes?.find((quote) => quote.id === shipment.approvedQuoteId) || shipment.quotes?.find((quote) => quote.status === "approved");
  const quoteTotal = shipment.quotes?.filter((quote) => quote.status === "approved").reduce((sum, quote) => sum + Number(quote.amount || 0), 0);
  const canMarkCollected = !!shipment.bookingAcceptedAt && !!shipment.agencyPayment && !!shipment.pickupScheduledAt;
  const buyerShippingSettled = ["included", "paid"].includes(shipment.buyerShippingStatus);
  const trackingHref = validTrackingUrl(shipment.trackingUrl);
  const locked = shipment.status === "returned";
  const updateOptions = vendor
    ? (["preparing", "ready_for_pickup"].includes(shipment.status) ? ["ready_for_pickup"] : [])
    : admin || partner ? (admin && correction && !["delivered", "returned"].includes(shipment.status)
      ? shipmentStatuses.filter(item => item !== "preparing")
      : shipmentTransitions[shipment.status].filter(item => admin || item !== "ready_for_pickup")) : [];
  const status = (updateOptions.includes(selectedStatus) ? selectedStatus : updateOptions[0] || selectedStatus) as ShipmentStatus;

  return <article className="overflow-hidden rounded-xl border border-[#dce7e2] bg-white">
    <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
          <div className="flex min-w-0 items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e9f3ef] text-teal-900"><Package className="h-5 w-5" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">Shipment #{shipment.id}</h3><Badge className="bg-[#e9f3ef] text-teal-900 hover:bg-[#e9f3ef]">{shipmentStatusLabels[shipment.status]}</Badge></div><p className="mt-1 text-xs text-slate-500">Order #{shipment.orderId} · {shipment.vendorName} · Opened {new Date(shipment.createdAt).toLocaleDateString()}</p><p className="mt-1 text-xs text-slate-500">{shipment.items?.length || 0} line items{shipment.partnerName ? ` · ${shipment.partnerName}` : ""}</p></div></div>
      <Button size="sm" variant="outline" onClick={() => setExpanded((value) => !value)}>{expanded ? "Close workflow" : "Open workflow"}<ChevronDown className={`ml-1 h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} /></Button>
    </div>
    <div className="grid grid-cols-2 gap-px border-t border-[#e7eeea] bg-[#e7eeea] sm:grid-cols-4">
      {[["Tracking", shipment.trackingNumber || "Not assigned"], ["Booking", shipment.bookingAcceptedAt ? "Accepted" : "Pending"], ["Buyer shipping", shipment.buyerShippingStatus || "Not available"], ["Pickup ready", shipment.readyAt ? dateTime(shipment.readyAt) : "Awaiting vendor"]].map(([label, value]) => <div key={label} className="min-w-0 bg-[#f9fbfa] px-3 py-3 sm:px-4"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 truncate text-xs font-medium text-slate-800">{value}</p></div>)}
    </div>
    {expanded && <div className="space-y-5 border-t border-[#e7eeea] p-4 sm:p-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <section><h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-600">Consignment & destination</h4><div className="space-y-2 text-sm text-slate-700">{shipment.items?.map((item) => <p key={item.productId} className="flex justify-between gap-3"><span>{item.name}</span><span className="shrink-0 text-slate-500">× {item.quantity}</span></p>)}</div><p className="mt-3 text-xs leading-5 text-slate-600">{[shipment.deliveryAddress?.address1, shipment.deliveryAddress?.address2, shipment.deliveryAddress?.city, shipment.deliveryAddress?.state, shipment.deliveryAddress?.postalCode, shipment.deliveryAddress?.country].filter(Boolean).join(", ") || "Delivery address unavailable"}</p><p className="mt-1 text-xs text-slate-600">{[shipment.deliveryAddress.firstName, shipment.deliveryAddress.lastName].filter(Boolean).join(" ")}{shipment.deliveryAddress.phone && <> · <a className="underline" href={`tel:${shipment.deliveryAddress.phone.replace(/[^\d+]/g, "")}`}>{shipment.deliveryAddress.phone}</a></>}</p><p className="mt-2 text-xs text-slate-500">{shipment.weightKg ? `${shipment.weightKg} kg` : "Weight not recorded"}{shipment.dimensions ? ` · ${shipment.dimensions}` : ""}</p>{shipment.pickupAddress && <div className="mt-4 rounded-lg bg-teal-50 p-3 text-xs text-teal-950"><h5 className="font-semibold">Vendor pickup contact</h5><p className="mt-1">{shipment.pickupAddress.contactName} · <a className="underline" href={`tel:${shipment.pickupAddress.phone.replace(/[^\d+]/g, "")}`}>{shipment.pickupAddress.phone}</a></p><p className="mt-1">{[shipment.pickupAddress.address1, shipment.pickupAddress.address2, shipment.pickupAddress.city, shipment.pickupAddress.state, shipment.pickupAddress.postalCode, shipment.pickupAddress.country].filter(Boolean).join(", ")}</p>{shipment.pickupScheduledAt && <p className="mt-1">Pickup: {dateTime(shipment.pickupScheduledAt)}</p>}</div>}</section>
        <section><h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-600">Event history</h4><div className="max-h-52 space-y-3 overflow-y-auto">{shipment.events?.length ? shipment.events.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((event) => { const adminEvent = event as ShipmentEventWithActor; return <div key={event.id} className="flex gap-2 text-xs"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-700" /><span><strong>{shipmentStatusLabels[event.status as ShipmentStatus] || event.type}</strong> · {event.note}<span className="ml-1 text-slate-400">{dateTime(event.createdAt)} · {event.source}{admin && adminEvent.actorName ? ` · ${adminEvent.actorName}` : ""}</span>{event.deliveryEvidence && <span className="mt-1 block text-slate-500">Evidence: {event.deliveryEvidence}</span>}</span></div>; }) : <p className="text-xs text-slate-500">No updates recorded.</p>}</div></section>
      </div>
      {(admin || (vendor && vendorId === shipment.vendorId)) && shipment.status === "preparing" && !shipment.bookingAcceptedAt && <SplitShipmentForm shipmentId={shipment.id} orderId={shipment.orderId} items={shipment.items} />}
      {admin && <section className="rounded-xl border border-teal-100 bg-[#f4f9f7] p-4"><h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-teal-900">Assign a shipping partner</h4><form className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(shipment.id); run({ method: "POST", path: `/api/logistics/shipments/${shipment.id}/assign`, body: { partnerId: Number(form.get("partnerId")), reason: String(form.get("reason") || "") }, success: `Shipment #${shipment.id} assigned.` }); }}><select name="partnerId" className={fieldClass} required defaultValue={shipment.partnerId || chosenPartner || ""}><option value="" disabled>Select active partner</option>{partners.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input name="reason" required minLength={3} maxLength={500} placeholder="Assignment reason" className={fieldClass} /><Button size="sm" disabled={pending || !partners.some((item) => item.active)}>Assign</Button></form></section>}
      {(admin || partner) && <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-[#e2ebe7] p-4"><h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-600">Partner cost quote</h4><p className="mb-3 text-xs leading-5 text-slate-500">This is an agency invoice cost in NGN, not the buyer's checkout shipping charge.</p>{(!shipment.partnerId && !partner) && <p className="mb-3 rounded bg-amber-50 p-2 text-xs text-amber-900">Assign a partner before requesting their cost quote.</p>}
          <form className="grid gap-2 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(shipment.id); run({ method: "POST", path: `/api/logistics/shipments/${shipment.id}/quotes`, body: { amount: Number(form.get("amount")), estimatedDelivery: form.get("estimatedDelivery"), notes: form.get("notes") || "" }, success: `Cost quote submitted for shipment #${shipment.id}.` }); }}>
            <Field label="Amount (NGN)"><input name="amount" required type="number" min="0.01" step="0.01" className={fieldClass} placeholder="e.g. 18500" /></Field><Field label="Estimated delivery"><input name="estimatedDelivery" required minLength={3} className={fieldClass} placeholder="e.g. 5 to 7 business days" /></Field><div className="sm:col-span-2"><Field label="Notes"><textarea name="notes" maxLength={2000} className={areaClass} placeholder="Route, service details, or quote validity" /></Field></div><Button type="submit" size="sm" className="sm:col-span-2" disabled={pending || !shipment.partnerId || !shipment.readyAt || !!shipment.bookingAcceptedAt}>Submit cost quote</Button>{!shipment.readyAt && <p className="text-xs text-amber-800 sm:col-span-2">The vendor must provide actual package details before quoting.</p>}
          </form>
          {shipment.quotes?.length ? <div className="mt-4 space-y-2">{shipment.quotes.map((quote) => <div key={quote.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#f6f8f7] p-3 text-xs"><div><strong>{money(quote.amount)}</strong><span className="ml-2 text-slate-500">{quote.estimatedDelivery} · {quote.status}</span>{quote.notes && <p className="mt-1 text-slate-500">{quote.notes}</p>}{quote.reviewNote && <p className="mt-1 text-slate-500">Review: {quote.reviewNote}</p>}</div>{admin && quote.status === "submitted" && <div className="flex gap-2"><Button size="sm" disabled={pending} onClick={() => run({ method: "POST", path: `/api/logistics/quotes/${quote.id}/review`, body: { decision: "approved", reason: "Approved after operational review." }, success: "Partner cost approved." })}><Check className="mr-1 h-3 w-3" />Approve</Button><RejectQuote quoteId={quote.id} run={run} pending={pending} /></div>}</div>)}</div> : null}
          {admin && quoteTotal !== undefined && quoteTotal > 0 && <p className="mt-3 text-xs font-semibold text-teal-900">Approved partner costs on this shipment: {money(String(quoteTotal))}</p>}
        </section>
        {(admin || partner) && <section className="rounded-xl border border-[#e2ebe7] p-4"><h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-600">Confirm booking</h4>{!approvedQuote && <p className="mb-2 text-xs text-amber-800">An approved cost quote is required.</p>}{!buyerShippingSettled && <p className="mb-2 text-xs text-amber-800">Buyer shipping must be settled before booking acceptance.</p>}<form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(shipment.id); run({ method: "POST", path: `/api/logistics/shipments/${shipment.id}/booking`, body: { bookingReference: form.get("bookingReference") }, success: `Booking accepted for shipment #${shipment.id}.` }); }}><input name="bookingReference" required minLength={3} maxLength={160} defaultValue={shipment.bookingReference || ""} className={fieldClass} placeholder="Booking reference" /><Button size="sm" disabled={pending || !approvedQuote || !buyerShippingSettled || !!shipment.bookingAcceptedAt}>{shipment.bookingAcceptedAt ? "Booking accepted" : "Accept booking"}</Button></form></section>}
        {admin && <section className="rounded-xl border border-[#e2ebe7] p-4"><h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-600">Record agency payment</h4><p className="mb-3 text-xs text-slate-500">Records a payment already made; this does not transfer money. This record is immutable.</p>{shipment.agencyPayment ? <div className="rounded-lg bg-teal-50 p-3 text-xs text-teal-950"><p className="font-semibold">{money(shipment.agencyPayment.amount)} paid · {dateTime(shipment.agencyPayment.paidAt)}</p><p className="mt-1">Invoice {shipment.agencyPayment.invoiceReference} · Payment {shipment.agencyPayment.paymentReference}</p>{shipment.agencyPayment.note && <p className="mt-1">{shipment.agencyPayment.note}</p>}</div> : <AgencyPaymentForm shipment={shipment} approvedQuote={approvedQuote} run={run} pending={pending} setBusy={setBusy} />}</section>}
      </div>}

      {vendor && shipment.status !== "ready_for_pickup" && <p className="rounded-lg bg-[#f4f8f6] p-3 text-xs text-slate-600">Vendor actions are limited to marking goods ready for pickup. Pickup, transit and delivery updates are recorded by the shipping team.</p>}
      {(admin || partner || vendor) && !locked && !!updateOptions.length && <StatusForm shipment={shipment} status={status} setStatus={setStatus} options={updateOptions} correction={correction} setCorrection={setCorrection} reason={reason} setReason={setReason} admin={admin} vendor={vendor} canMarkCollected={canMarkCollected} run={run} pending={pending} setBusy={setBusy} />}
      {locked && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><ClipboardCheck className="mr-1 inline h-4 w-4" />{shipment.status === "delivered" ? "Delivered shipments are terminal. Do not correct tracking or finance records by editing shipment status." : "Returned shipments are terminal and cannot be reopened through status editing."}</p>}
      {trackingHref && <a href={trackingHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800 underline">Open HTTPS tracking link <ExternalLink className="h-3 w-3" /></a>}
    </div>}
  </article>;
}

function RejectQuote({ quoteId, run, pending }: { quoteId: number; run: (args: ActionArgs) => void; pending: boolean }) {
  const [reason, setReason] = useState("");
  return <form className="flex items-center gap-1" onSubmit={(event) => { event.preventDefault(); run({ method: "POST", path: `/api/logistics/quotes/${quoteId}/review`, body: { decision: "rejected", reason }, success: "Partner cost quote rejected." }); }}><input value={reason} onChange={(event) => setReason(event.target.value)} required minLength={3} maxLength={500} className="h-8 w-28 rounded border px-2 text-xs" placeholder="Reason" /><Button size="sm" variant="outline" disabled={pending}>Reject</Button></form>;
}

function AgencyPaymentForm({ shipment, approvedQuote, run, pending, setBusy }: { shipment: ShipmentView; approvedQuote?: ShipmentView["quotes"] extends (infer Q)[] | undefined ? Q : never; run: (args: ActionArgs) => void; pending: boolean; setBusy: (id: number | null) => void }) {
  return <form className="grid gap-2 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(shipment.id); run({ method: "POST", path: `/api/logistics/shipments/${shipment.id}/agency-payment`, body: { amount: Number(form.get("amount")), invoiceReference: form.get("invoiceReference"), paymentReference: form.get("paymentReference"), paidAt: new Date(String(form.get("paidAt"))).toISOString(), note: form.get("note") || "" }, success: `Agency payment recorded for shipment #${shipment.id}.` }); }}>
    <Field label="Amount (exact approved cost)"><input name="amount" type="number" required step="0.01" min="0.01" defaultValue={approvedQuote?.amount || ""} className={fieldClass} /></Field><Field label="Paid at"><input name="paidAt" type="datetime-local" required className={fieldClass} /></Field><Field label="Invoice reference"><input name="invoiceReference" required className={fieldClass} /></Field><Field label="Payment reference"><input name="paymentReference" required className={fieldClass} /></Field><div className="sm:col-span-2"><Field label="Note"><input name="note" className={fieldClass} /></Field></div><Button size="sm" className="sm:col-span-2" disabled={pending || !approvedQuote || !shipment.bookingAcceptedAt}>Record payment</Button>{!shipment.bookingAcceptedAt && <p className="text-[11px] text-amber-800 sm:col-span-2">Booking acceptance is required before recording the agency payment.</p>}
  </form>;
}

function StatusForm({ shipment, status, setStatus, options, correction, setCorrection, reason, setReason, admin, vendor, canMarkCollected, run, pending, setBusy }: { shipment: ShipmentView; status: ShipmentStatus; setStatus: (status: ShipmentStatus) => void; options: string[]; correction: boolean; setCorrection: (value: boolean) => void; reason: string; setReason: (value: string) => void; admin: boolean; vendor: boolean; canMarkCollected: boolean; run: (args: ActionArgs) => void; pending: boolean; setBusy: (id: number | null) => void }) {
  return <section className="rounded-xl border border-teal-100 bg-[#f4f9f7] p-4">
    <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-teal-950">{vendor ? "Vendor pickup readiness" : "Record manual status update"}</h4><p className="mb-3 text-xs text-slate-500">{vendor ? "Complete all pickup details; vendors cannot claim collection or delivery." : "Every manual update is recorded in the shipment timeline."}</p>
     <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const nextStatus = String(form.get("status")) as ShipmentStatus; const body: Record<string, unknown> = { status: nextStatus, note: form.get("note"), correction, ...(correction ? { reason } : {}) }; if (nextStatus === "ready_for_pickup") { body.pickupAddress = { contactName: form.get("contactName"), phone: form.get("phone"), address1: form.get("address1"), address2: form.get("address2") || "", city: form.get("city"), state: form.get("state"), postalCode: form.get("postalCode"), country: form.get("country") }; body.weightKg = Number(form.get("weightKg")); body.dimensions = form.get("dimensions"); } if (nextStatus === "pickup_scheduled") body.pickupScheduledAt = new Date(String(form.get("pickupScheduledAt"))).toISOString(); if (nextStatus === "collected") { body.trackingNumber = form.get("trackingNumber"); const url = String(form.get("trackingUrl") || "").trim(); if (url) body.trackingUrl = url; } if (nextStatus === "delivered") body.deliveryEvidence = form.get("deliveryEvidence"); setBusy(shipment.id); run({ method: "POST", path: `/api/logistics/shipments/${shipment.id}/status`, body, success: `Shipment #${shipment.id} updated to ${shipmentStatusLabels[nextStatus]}.` }); }}>
      <Field label="New status"><select name="status" value={status} onChange={(event) => setStatus(event.target.value as ShipmentStatus)} className={fieldClass}>{options.map((item) => <option key={item} value={item}>{shipmentStatusLabels[item as ShipmentStatus]}</option>)}</select></Field>
       {status === "pickup_scheduled" && !vendor && <Field label="Pickup scheduled at"><input name="pickupScheduledAt" type="datetime-local" required className={fieldClass} /></Field>}
      {status === "collected" && !vendor && <><Field label="Tracking number"><input name="trackingNumber" required minLength={3} className={fieldClass} /></Field><Field label="Tracking URL (HTTPS only)"><input name="trackingUrl" type="url" pattern="https://.+" placeholder="https://carrier.example/track/…" className={fieldClass} /></Field>{!canMarkCollected && <p className="text-xs text-amber-800 sm:col-span-2">Collection requires both accepted booking and recorded agency payment.</p>}</>}
      {status === "delivered" && !vendor && <div className="sm:col-span-2"><Field label="Delivery evidence (required)"><textarea name="deliveryEvidence" minLength={5} maxLength={2000} required className={areaClass} placeholder="Recipient, signed delivery note, or other evidence" /></Field></div>}
      {status === "ready_for_pickup" && <div className="grid gap-3 rounded-lg border border-teal-100 bg-white p-3 sm:col-span-2 sm:grid-cols-2"><p className="text-[10px] font-bold uppercase tracking-wider text-teal-900 sm:col-span-2">Pickup address and package details</p><Field label="Contact name"><input name="contactName" required minLength={2} className={fieldClass} /></Field><Field label="Contact phone"><input name="phone" type="tel" required className={fieldClass} /></Field><Field label="Address line 1"><input name="address1" required minLength={3} className={fieldClass} /></Field><Field label="Address line 2"><input name="address2" className={fieldClass} /></Field><Field label="City"><input name="city" required minLength={2} className={fieldClass} /></Field><Field label="State / region"><input name="state" required minLength={2} className={fieldClass} /></Field><Field label="Postal code"><input name="postalCode" required className={fieldClass} /></Field><Field label="Country"><input name="country" required minLength={2} className={fieldClass} /></Field><Field label="Weight (kg)"><input name="weightKg" type="number" step="0.01" min="0.01" max="10000" required className={fieldClass} /></Field><Field label="Dimensions"><input name="dimensions" required minLength={3} maxLength={120} placeholder="Length × width × height" className={fieldClass} /></Field></div>}
      {(admin || !vendor) && admin && !["delivered", "returned"].includes(shipment.status) && <label className="flex items-start gap-2 text-xs text-slate-700 sm:col-span-2"><input type="checkbox" checked={correction} onChange={(event) => setCorrection(event.target.checked)} className="mt-0.5 accent-teal-800" />Correct an earlier non-terminal status (reason required; delivered and returned are locked)</label>}
      {correction && admin && <div className="sm:col-span-2"><Field label="Correction reason"><textarea value={reason} onChange={(event) => setReason(event.target.value)} required minLength={3} maxLength={1000} className={areaClass} /></Field></div>}
      <div className="sm:col-span-2"><Field label="Update note (required)"><textarea name="note" required minLength={3} maxLength={2000} className={areaClass} placeholder={vendor ? "What is packed and ready for collection?" : "Record what changed and any context for the next operator"} /></Field></div>
       <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-[10px] text-slate-500">Tracking links must be HTTPS. Updates are entered manually.</p><Button type="submit" className="w-full sm:w-auto" disabled={pending || !status || (status === "collected" && !vendor && !canMarkCollected) || (correction && reason.trim().length < 3)}>Save status update</Button></div>
    </form>
  </section>;
}
