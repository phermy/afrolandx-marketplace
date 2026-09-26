import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Planner = { id: number; businessName: string; location: string; description: string; status?: string; userId?: string };
type QuoteLine = { category: "venue" | "hotel" | "food" | "wear" | "other"; description: string; provider: string; estimatedAmountNgn: number; bookingStatus: "suggested" | "requested" | "confirmed_externally" | "unavailable" };
type Plan = {
  id: number; customerId: string; plannerId: number; title: string; eventType: string; eventDate: string;
  location: string; guestCount: number; needs: string; budgetNgn: number | null; status: string;
  quoteItems: QuoteLine[]; plannerFeeNgn: number | null; commissionNgn: number | null;
  plannerNetNgn: number | null; quoteVersion: number; quoteValidUntil: string | null;
};
type Earning = { id: number; eventId: number; grossNgn: number; commissionNgn: number; netNgn: number; status: string };
type EventMessage = { id: number; eventId: number; senderId: string; body: string; createdAt: string };
const money = (value: number) => `₦${value.toLocaleString("en-NG")}`;
const categories = ["venue", "hotel", "food", "wear", "other"] as const;
const blankLine = (): QuoteLine => ({ category: "venue", description: "", provider: "", estimatedAmountNgn: 0, bookingStatus: "suggested" });

async function request(url: string, method = "GET", data?: unknown) {
  const response = await fetch(url, {
    method, credentials: "include",
    headers: data === undefined ? {} : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "Please try again.");
  return body;
}

function QuoteEditor({ plan, onChange }: { plan: Plan; onChange: () => void }) {
  const [fee, setFee] = useState("");
  const [lines, setLines] = useState<QuoteLine[]>([blankLine()]);
  const [days, setDays] = useState("7");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const update = (index: number, patch: Partial<QuoteLine>) => setLines(current => current.map((line, i) => i === index ? { ...line, ...patch } : line));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      await request(`/api/event-plans/${plan.id}/quote`, "POST", {
        plannerFeeNgn: Number(fee), validDays: Number(days),
        items: lines.filter(line => line.description.trim()).map(line => ({ ...line, estimatedAmountNgn: Number(line.estimatedAmountNgn) })),
      });
      onChange();
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <form className="mt-5 space-y-4 rounded-lg border bg-white p-4" onSubmit={submit}>
      <h4 className="font-semibold">Prepare a new quotation</h4>
      <p className="text-sm text-gray-600">Quote your planning fee separately from hotels, venues, food and clothing. Online event payments are not available yet. Afrolandx records 8% of your fee as commission only when the customer confirms the event was delivered.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">Your planning fee (NGN)<Input required type="number" min="100" max="100000000" step="1" value={fee} onChange={e => setFee(e.target.value)} /></label>
        <label className="text-sm font-medium">Quote valid for (days)<Input required type="number" min="1" max="30" value={days} onChange={e => setDays(e.target.value)} /></label>
      </div>
      {Number(fee) >= 100 && <p className="text-sm">Afrolandx commission due on completion: <strong>{money(Math.round(Number(fee) * .08))}</strong> · Remaining planning fee: <strong>{money(Number(fee) - Math.round(Number(fee) * .08))}</strong></p>}
      <h5 className="text-sm font-semibold">Suggested suppliers and booking requests</h5>
      {lines.map((line, index) => (
        <div key={index} className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
          <label className="text-xs">Service
            <select className="mt-1 w-full rounded border p-2" value={line.category} onChange={e => update(index, { category: e.target.value as QuoteLine["category"] })}>
              {categories.map(category => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <label className="text-xs">Provider or venue name<Input maxLength={160} value={line.provider} onChange={e => update(index, { provider: e.target.value })} /></label>
          <label className="text-xs">Suggestion or booking detail<Input maxLength={240} value={line.description} onChange={e => update(index, { description: e.target.value })} /></label>
          <label className="text-xs">Estimated outside cost (NGN; not charged here)<Input type="number" min="0" max="1000000000" step="1" value={line.estimatedAmountNgn} onChange={e => update(index, { estimatedAmountNgn: Number(e.target.value) })} /></label>
          <label className="text-xs">Booking progress
            <select className="mt-1 w-full rounded border p-2" value={line.bookingStatus} onChange={e => update(index, { bookingStatus: e.target.value as QuoteLine["bookingStatus"] })}>
              <option value="suggested">Suggested, not booked</option>
              <option value="requested">Request sent, not confirmed</option>
              <option value="confirmed_externally">Planner reports external confirmation</option>
              <option value="unavailable">Unavailable, find an alternative</option>
            </select>
          </label>
          <button type="button" className="self-end text-sm text-red-700" onClick={() => setLines(current => current.filter((_, i) => i !== index))}>Remove</button>
        </div>
      ))}
      {lines.length < 30 && <Button variant="outline" type="button" onClick={() => setLines(current => [...current, blankLine()])}>Add service suggestion</Button>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <Button disabled={busy} type="submit">Send quotation</Button>
    </form>
  );
}

function EventConversation({ plan, myId }: { plan: Plan; myId: string }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const client = useQueryClient();
  const key = ["event-messages", plan.id];
  const messages = useQuery<EventMessage[]>({ queryKey: key, queryFn: () => request(`/api/event-plans/${plan.id}/messages`), enabled: open });
  return <div className="border-t pt-3">
    <Button type="button" variant="outline" onClick={() => setOpen(!open)}>{open ? "Hide conversation" : "Discuss this event"}</Button>
    {open && <div className="mt-3 space-y-3 rounded-md bg-gray-50 p-3">
      {messages.isError && <p role="alert" className="text-sm text-red-700">Messages could not be loaded.</p>}
      {messages.data?.map(message => <div key={message.id} className="rounded border bg-white p-3 text-sm">
        <p className="text-xs font-semibold text-green-800">{message.senderId === myId ? "You" : plan.customerId === myId ? "Your planner" : "Your customer"} · {new Date(message.createdAt).toLocaleString()}</p>
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
      </div>)}
      {!messages.isLoading && !messages.data?.length && <p className="text-sm text-gray-600">No messages yet.</p>}
      {!["completed", "cancelled"].includes(plan.status) && <form onSubmit={async e => {
        e.preventDefault(); setSending(true); setError("");
        try {
          await request(`/api/event-plans/${plan.id}/messages`, "POST", { body });
          setBody(""); client.invalidateQueries({ queryKey: key });
        } catch (error) { setError((error as Error).message); }
        finally { setSending(false); }
      }}>
        <label className="text-sm font-medium">Your message<textarea className="mt-1 min-h-20 w-full rounded border p-2" required maxLength={2000} value={body} onChange={e => setBody(e.target.value)} /></label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <Button disabled={sending || !body.trim()} type="submit">Send message</Button>
      </form>}
    </div>}
  </div>;
}

export default function EventServices() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedPlanner, setSelectedPlanner] = useState<number | null>(null);
  const [application, setApplication] = useState({ businessName: "", location: "", description: "" });
  const [brief, setBrief] = useState({ title: "", eventType: "", eventDate: "", location: "", guestCount: "50", budgetNgn: "", needs: "" });
  const planners = useQuery<Planner[]>({ queryKey: ["event-planners"], queryFn: () => request("/api/event-planners") });
  const mine = useQuery<Planner | null>({ queryKey: ["event-planner-me"], queryFn: () => request("/api/event-planners/me"), enabled: !!user });
  const plans = useQuery<Plan[]>({ queryKey: ["event-plans"], queryFn: () => request("/api/event-plans"), enabled: !!user });
  const admin = !!user?.roles?.includes("admin");
  const applicants = useQuery<Planner[]>({ queryKey: ["event-planner-applicants"], queryFn: () => request("/api/admin/event-planners"), enabled: admin });
  const earnings = useQuery<Earning[]>({ queryKey: ["event-earnings"], queryFn: () => request("/api/admin/event-earnings"), enabled: admin });
  const refresh = () => {
    client.invalidateQueries({ queryKey: ["event-plans"] });
    client.invalidateQueries({ queryKey: ["event-planners"] });
    client.invalidateQueries({ queryKey: ["event-planner-me"] });
    client.invalidateQueries({ queryKey: ["event-planner-applicants"] });
    client.invalidateQueries({ queryKey: ["event-earnings"] });
    client.invalidateQueries({ queryKey: ["/api/auth/user"] });
  };
  const act = async (url: string, data?: unknown) => {
    setError(""); setNotice(""); setBusy(true);
    try {
      const result = await request(url, "POST", data);
      setNotice(result.message || "Saved.");
      refresh();
      return result;
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <section className="mx-auto max-w-5xl px-4 pt-10" aria-label="Event planning services">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-green-800">Personal planning services</p>
        <h2 className="mt-1 text-2xl font-bold text-gray-900">Plan the whole occasion</h2>
        <p className="mt-2 max-w-3xl text-gray-600">Find an approved planner for venues, hotels, food and looks. Request a written quote, then manage your event in one place. Supplier availability and external bookings are confirmed by the planner, not automatically by Afrolandx. Event fee payments are not collected through this page.</p>
      </div>
      {error && <p role="alert" className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mb-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
      {!user && <p className="mb-6 rounded-lg bg-white p-5 text-sm"><Link href="/login" className="font-semibold text-green-800 underline">Log in</Link> to request planning or apply to become a planner.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {planners.data?.map(planner => <Card key={planner.id} className={selectedPlanner === planner.id ? "border-green-700" : ""}>
          <CardHeader><CardTitle>{planner.businessName}</CardTitle><CardDescription>{planner.location} · Approved event planner</CardDescription></CardHeader>
          <CardContent><p className="mb-4 whitespace-pre-wrap text-sm text-gray-600">{planner.description}</p>
            {user && <Button variant={selectedPlanner === planner.id ? "outline" : "default"} onClick={() => setSelectedPlanner(selectedPlanner === planner.id ? null : planner.id)}>Request a plan</Button>}
          </CardContent>
        </Card>)}
      </div>
      {planners.isError && <p className="text-sm text-red-700">Planners could not be loaded.</p>}
      {!planners.isLoading && !planners.isError && !planners.data?.length && <p className="rounded-lg border bg-white p-5 text-sm text-gray-600">No planners are approved yet. You can still explore the outfit collections below.</p>}
      {user && selectedPlanner && <Card className="mt-6">
        <CardHeader><CardTitle>Tell your planner about your event</CardTitle><CardDescription>Sharing a brief requests a quote; it does not book or charge you.</CardDescription></CardHeader>
        <CardContent><form className="grid gap-4 md:grid-cols-2" onSubmit={async e => {
          e.preventDefault();
          const result = await act("/api/event-plans", { ...brief, plannerId: selectedPlanner, guestCount: Number(brief.guestCount), budgetNgn: brief.budgetNgn ? Number(brief.budgetNgn) : null });
          if (result) setSelectedPlanner(null);
        }}>
          <label className="text-sm font-medium">Event name<Input required minLength={3} maxLength={160} value={brief.title} onChange={e => setBrief({ ...brief, title: e.target.value })} placeholder="My wedding" /></label>
          <label className="text-sm font-medium">Occasion<Input required maxLength={80} value={brief.eventType} onChange={e => setBrief({ ...brief, eventType: e.target.value })} placeholder="Wedding" /></label>
          <label className="text-sm font-medium">Event date<Input required type="date" min={new Date().toISOString().slice(0, 10)} value={brief.eventDate} onChange={e => setBrief({ ...brief, eventDate: e.target.value })} /></label>
          <label className="text-sm font-medium">City and country<Input required maxLength={160} value={brief.location} onChange={e => setBrief({ ...brief, location: e.target.value })} /></label>
          <label className="text-sm font-medium">Guests<Input required type="number" min="1" max="100000" value={brief.guestCount} onChange={e => setBrief({ ...brief, guestCount: e.target.value })} /></label>
          <label className="text-sm font-medium">Budget in NGN (optional)<Input type="number" min="1" step="1" value={brief.budgetNgn} onChange={e => setBrief({ ...brief, budgetNgn: e.target.value })} /></label>
          <label className="text-sm font-medium md:col-span-2">What do you need help with?
            <textarea className="mt-1 min-h-24 w-full rounded border p-3" minLength={10} maxLength={3000} required value={brief.needs} onChange={e => setBrief({ ...brief, needs: e.target.value })} placeholder="Venue, hotels, catering, guest clothing..." />
          </label>
          <Button disabled={busy}>Send event request</Button>
        </form></CardContent>
      </Card>}
      {user && <div className="mt-10">
        <h3 className="mb-4 text-xl font-bold">My event plans</h3>
        {plans.isError && <p role="alert" className="text-red-700">Your event plans could not be loaded.</p>}
        {!plans.isLoading && !plans.data?.length && <p className="text-sm text-gray-600">Your requests and quotations will appear here.</p>}
        <div className="space-y-4">{plans.data?.map(plan => {
          const asPlanner = mine.data?.id === plan.plannerId && plan.customerId !== user.id;
          const fee = plan.plannerFeeNgn || 0;
          const supplierTotal = (Array.isArray(plan.quoteItems) ? plan.quoteItems : []).reduce((sum, line) => sum + line.estimatedAmountNgn, 0);
          return <Card key={plan.id}><CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>{plan.title}</CardTitle><span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold uppercase text-green-800">{plan.status.replaceAll("_", " ")}</span></div>
            <CardDescription>{plan.eventType} · {plan.eventDate} · {plan.location} · {plan.guestCount} guests · {asPlanner ? "Planner view" : "Customer view"}</CardDescription>
          </CardHeader><CardContent className="space-y-3">
            <p className="whitespace-pre-wrap text-sm">{plan.needs}</p>
            {plan.budgetNgn && <p className="text-sm">Customer budget: {money(plan.budgetNgn)}</p>}
            {fee > 0 && <div className="rounded-md bg-green-50 p-4 text-sm">
              <p>Quoted planner fee: <strong>{money(fee)}</strong></p>
              <p>Afrolandx commission due from planner after customer confirms completion, 8% of planner fee: <strong>{money(plan.commissionNgn || 0)}</strong></p>
              {asPlanner && <p>Planning fee after commission: <strong>{money(plan.plannerNetNgn || 0)}</strong></p>}
              {plan.quoteValidUntil && <p className="mt-1">Quote valid until {new Date(plan.quoteValidUntil).toLocaleDateString()}</p>}
              <p className="mt-2 text-xs">This is a quotation, not a payment receipt. No event payments are taken here. Venue, hotel, food and clothing estimates are not included in the 8% commission. A supplier suggestion is not a confirmed reservation.</p>
              <a className="mt-3 inline-block font-semibold text-green-800 underline" href={`/api/event-plans/${plan.id}/statement`} target="_blank" rel="noopener noreferrer">Open printable quotation and commission statement</a>
            </div>}
            {!!plan.quoteItems?.length && <div className="space-y-2">
              <h4 className="font-semibold">Supplier suggestions and external bookings · estimated {money(supplierTotal)}</h4>
              {plan.quoteItems.map((line, index) => <div key={index} className="rounded border bg-white p-3 text-sm">
                <strong className="capitalize">{line.category}</strong> · {line.description} {line.provider && `· ${line.provider}`} · {money(line.estimatedAmountNgn)}
                <p className="text-xs font-medium text-amber-800">{line.bookingStatus === "confirmed_externally" ? "Planner reports external confirmation; ask for provider details" : line.bookingStatus === "requested" ? "Requested, not confirmed" : line.bookingStatus === "unavailable" ? "Unavailable; an alternative is needed" : "Suggested, not booked"}</p>
                {asPlanner && ["quoted", "accepted", "completion_requested"].includes(plan.status) && <label className="mt-2 block text-xs">Update booking progress
                  <select className="ml-2 rounded border p-1" value={line.bookingStatus} disabled={busy} onChange={e => act(`/api/event-plans/${plan.id}/bookings/${index}`, { bookingStatus: e.target.value })}>
                    <option value="suggested">Suggested</option><option value="requested">Requested</option>
                    <option value="confirmed_externally">Confirmed externally by planner</option><option value="unavailable">Unavailable</option>
                  </select>
                </label>}
              </div>)}
            </div>}
            {asPlanner && ["requested", "quoted"].includes(plan.status) && <QuoteEditor plan={plan} onChange={refresh} />}
            {!asPlanner && plan.status === "quoted" && <Button disabled={busy} onClick={() => act(`/api/event-plans/${plan.id}/accept`, { quoteVersion: plan.quoteVersion, plannerFeeNgn: fee })}>Accept this quotation</Button>}
            {!asPlanner && plan.status === "accepted" && <p className="text-xs text-gray-600">Quotation accepted. Coordinate services and any payment terms with your planner using the conversation below. Afrolandx does not collect this event fee online.</p>}
            {!asPlanner && ["requested", "quoted", "accepted"].includes(plan.status) && <Button variant="outline" disabled={busy} onClick={() => act(`/api/event-plans/${plan.id}/cancel`)}>Cancel request</Button>}
            {asPlanner && plan.status === "accepted" && <Button disabled={busy} onClick={() => act(`/api/event-plans/${plan.id}/delivered`)}>Mark services delivered</Button>}
            {!asPlanner && plan.status === "completion_requested" && <Button disabled={busy} onClick={() => act(`/api/event-plans/${plan.id}/complete`)}>Confirm event completed</Button>}
            {plan.status === "completed" && <p className="text-xs text-gray-600">Event #{plan.id} confirmed completed by the customer. The 8% planner commission is recorded as due to Afrolandx, not collected automatically.</p>}
            <EventConversation plan={plan} myId={user.id} />
          </CardContent></Card>;
        })}</div>
      </div>}
      {user && <Card className="mt-10">
        <CardHeader><CardTitle>Plan events professionally</CardTitle><CardDescription>Customers and vendors can also apply to be event planners using their existing account. Afrolandx reviews each application before listing it.</CardDescription></CardHeader>
        <CardContent>{mine.data ? <p className="text-sm">Application: <strong className="capitalize">{mine.data.status}</strong>. {mine.data.status === "approved" ? "You can manage quotes in My event plans above." : "Contact support if you need to update your application."}</p> :
          <form className="space-y-3" onSubmit={e => { e.preventDefault(); act("/api/event-planners/apply", application); }}>
            <label className="block text-sm font-medium">Business or professional name<Input required minLength={2} maxLength={160} value={application.businessName} onChange={e => setApplication({ ...application, businessName: e.target.value })} /></label>
            <label className="block text-sm font-medium">Service area<Input required minLength={2} maxLength={160} value={application.location} onChange={e => setApplication({ ...application, location: e.target.value })} /></label>
            <label className="block text-sm font-medium">Experience and services<textarea required minLength={30} maxLength={2000} className="mt-1 min-h-24 w-full rounded border p-3" value={application.description} onChange={e => setApplication({ ...application, description: e.target.value })} /></label>
            <Button disabled={busy}>Apply as event planner</Button>
          </form>}</CardContent>
      </Card>}
      {admin && <Card className="mt-10"><CardHeader><CardTitle>Event planner administration</CardTitle><CardDescription>Review applicants before making them available to customers. The 8% service-fee commission is recorded as due when customers confirm completed events; this page does not collect or settle it.</CardDescription></CardHeader>
        <CardContent className="space-y-3">{applicants.data?.map(planner => <div key={planner.id} className="rounded border p-3 text-sm">
          <strong>{planner.businessName}</strong> · {planner.location} · {planner.status}
          <p className="whitespace-pre-wrap py-2">{planner.description}</p>
          <div className="flex gap-2">{(["approved", "suspended", "rejected"] as const).filter(status => status !== planner.status).map(status => <Button key={status} variant="outline" size="sm" disabled={busy} onClick={async () => {
            setBusy(true); setError("");
            try { await request(`/api/admin/event-planners/${planner.id}/status`, "PATCH", { status }); refresh(); }
            catch (error) { setError((error as Error).message); }
            finally { setBusy(false); }
          }}>{status === "approved" ? "Approve" : status === "suspended" ? "Suspend" : "Reject"}</Button>)}</div>
        </div>)}
        {!applicants.isLoading && !applicants.data?.length && <p className="text-sm">No planner applications yet.</p>}
        {applicants.isError && <p className="text-sm text-red-700">Applications could not be loaded.</p>}
        <h4 className="pt-3 font-semibold">Completed event commission records</h4>
        {earnings.data?.map(row => <p key={row.id} className="rounded border p-2 text-sm">Event #{row.eventId}: quoted fee {money(row.grossNgn)} · Afrolandx commission {money(row.commissionNgn)} · fee after commission {money(row.netNgn)} · {row.status.replaceAll("_", " ")}</p>)}
        {earnings.isError && <p className="text-sm text-red-700">Earnings could not be loaded.</p>}
        </CardContent></Card>}
    </section>
  );
}