import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight, Clock3, FileCheck2, FileUp, LockKeyhole, RefreshCw, ShieldCheck, Store, Trash2 } from "lucide-react";
import Navbar from "@/components/navbar";
import { normalizeCacNumber } from "@shared/vendor-onboarding";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Evidence = { id: number; kind: "cac_certificate" | "identity_authority"; originalName: string; bytes: number; uploadedAt: string };
type Application = {
  vendor: (Record<string, any> & { id: number; status: string; businessName?: string; contactName?: string; phone?: string; cacNumber?: string; description?: string }) | null;
  evidence: Evidence[];
  review: { revision: number; submittedAt?: string; firstReviewerId?: number; firstReviewerName?: string; firstReviewedAt?: string; secondReviewerId?: number; secondReviewerName?: string; secondReviewedAt?: string; nextReviewAt?: string; lastMonitoredAt?: string } | null;
  duplicatesCount: number;
  needs: string[];
};
const applicationKey = ["/api/vendor-application"];
const kinds = [
  { kind: "cac_certificate", title: "CAC registration certificate", note: "A clear PDF, JPEG or PNG showing your business registration." },
  { kind: "identity_authority", title: "Proof of authority for this business", note: "A document showing you may represent or act for this business. Do not send a government identity card unless specifically requested." },
] as const;
const validCac = (value: string) => normalizeCacNumber(value) !== null;
const readableError = (error: unknown) => {
  const message = error instanceof Error ? error.message : "Please try again.";
  const body = message.replace(/^\d{3}:\s*/, "");
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed?.message === "string") return parsed.message;
    if (typeof parsed?.error === "string") return parsed.error;
  } catch { /* Keep plain server messages readable. */ }
  return body.replace(/^"|"$/g, "");
};

export default function VendorApply() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ contactName: "", businessName: "", phone: "", cacNumber: "", description: "" });
  const [notice, setNotice] = useState("");
  const initializedForVendor = useRef<number | null>(null);
  const applicationQuery = useQuery<Application>({
    queryKey: applicationKey,
    enabled: isAuthenticated && !!user?.emailVerified,
    queryFn: async () => (await apiRequest("GET", "/api/vendor-application")).json(),
  });
  const app = applicationQuery.data;
  useEffect(() => {
    if (app?.vendor && initializedForVendor.current !== app.vendor.id) {
      initializedForVendor.current = app.vendor.id;
      setForm({
        contactName: app.vendor.contactName || "",
        businessName: app.vendor.businessName || "",
        phone: app.vendor.phone || "",
        cacNumber: app.vendor.cacNumber || "",
        description: app.vendor.description || "",
      });
    }
  }, [app?.vendor]);
  const locked = app?.vendor?.status === "approved" || app?.vendor?.status === "suspended";
  const evidenceKinds = useMemo(() => new Set(app?.evidence.map(item => item.kind) || []), [app?.evidence]);
  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/vendor-application", form);
      return response.json();
    },
    onSuccess: async () => {
      setNotice("Your business details are saved. This is a draft, not an approval to sell.");
      await queryClient.invalidateQueries({ queryKey: applicationKey });
      await queryClient.invalidateQueries({ queryKey: ["/api/vendors/me"] });
    },
  });
  const uploadMutation = useMutation({
    mutationFn: async ({ kind, file }: { kind: string; file: File }) => {
      const data = new FormData();
      data.append("kind", kind);
      data.append("file", file);
      return (await apiRequest("POST", "/api/vendor-application/evidence", data)).json();
    },
    onSuccess: async () => { setNotice("Evidence uploaded. Your application still needs a staff review."); await queryClient.invalidateQueries({ queryKey: applicationKey }); },
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/vendor-application/evidence/${id}`),
    onSuccess: async () => { setNotice("Evidence removed."); await queryClient.invalidateQueries({ queryKey: applicationKey }); },
  });
  const submitMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/vendor-application/submit", {})).json(),
    onSuccess: async () => { setNotice("Your application is submitted for review. You cannot sell until both approvals are complete."); await queryClient.invalidateQueries({ queryKey: applicationKey }); await queryClient.invalidateQueries({ queryKey: ["/api/vendors/me"] }); },
  });
  const mutationError = [saveMutation.error, uploadMutation.error, deleteMutation.error, submitMutation.error].find(Boolean);
  const problem = mutationError ? readableError(mutationError) : applicationQuery.error ? readableError(applicationQuery.error) : "";

  return (
    <div className="min-h-[100dvh] bg-[#f5f1e8] text-[#1b302c]">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-8 lg:pt-14">
        <div className="grid gap-10 lg:grid-cols-[.88fr_1.12fr] lg:gap-16">
          <section className="lg:sticky lg:top-10 lg:self-start">
            <p className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-[#a35c3f]"><span className="h-px w-8 bg-[#a35c3f]" />For independent makers</p>
            <h1 className="max-w-xl font-['Space_Grotesk'] text-5xl font-semibold leading-[1.02] tracking-[-.055em] sm:text-6xl">A thoughtful path to your shop.</h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-[#52635c]">Afrolandx welcomes independent African makers. We review each business and its documents before selling access is granted.</p>
            <p className="mt-3 max-w-lg text-sm leading-6 text-[#69756d]">A valid CAC number format checks only that the registration number follows the expected pattern. An Afrolandx reviewer manually checks CAC Public Search; no government record is checked automatically.</p>
            <div className="mt-9 space-y-0">
              {[
                ["01", "Tell us about your business", "Save your contact details, registration number and maker story."],
                ["02", "Share two documents", "Upload your CAC certificate and proof of identity or authority."],
                ["03", "Two staff reviews", "A first reviewer checks the CAC listing. A different authorised reviewer makes the final decision."],
              ].map(([number, title, detail]) => <div className="grid grid-cols-[2.5rem_1fr] gap-4 border-t border-[#d8d0bf] py-5" key={number}>
                <span className="font-mono text-sm text-[#a35c3f]">{number}</span><div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm leading-6 text-[#68756d]">{detail}</p></div>
              </div>)}
            </div>
            <div className="mt-6 rounded-xl border border-[#e3d9c8] bg-[#eee7d9] p-4 text-sm leading-6 text-[#5b685f]">
              <ShieldCheck className="mb-2 h-5 w-5 text-[#316d55]" />
              Drafting or submitting an application does not make a shop live. You may list products and sell only after the review is approved.
            </div>
          </section>
          <section className="rounded-2xl border border-[#e2dacb] bg-[#fffdf8] p-5 shadow-[0_18px_55px_rgba(54,62,49,.07)] sm:p-8">
            {!isAuthenticated || authLoading ? (
              <div className="py-8">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#e9efe7] text-[#316d55]"><Store /></div>
                <h2 className="font-['Space_Grotesk'] text-3xl font-semibold tracking-tight">Start with an account</h2>
                <p className="mt-3 max-w-md leading-7 text-[#637067]">Sign in or create an account to save your application, upload supporting documents and follow its review status.</p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Button asChild className="bg-[#245c49] text-white hover:bg-[#1a493a]"><Link href="/login?redirect=/vendor/apply">Sign in <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                  <Button asChild variant="outline" className="border-[#c9d4c9]"><Link href="/register?as=vendor">Create maker account</Link></Button>
                </div>
                <p className="mt-6 flex items-center gap-2 text-xs text-[#788179]"><LockKeyhole className="h-4 w-4" />Your details are used for the application review.</p>
              </div>
            ) : !user?.emailVerified ? (
              <div className="py-8">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#f8ecd4] text-[#9c6334]"><Clock3 /></div>
                <h2 className="font-['Space_Grotesk'] text-3xl font-semibold">Verify your email first</h2>
                <p className="mt-3 leading-7 text-[#637067]">Your Afrolandx account needs a verified email before a business application can be saved. Check your inbox for the verification message, then return here.</p>
                <p className="mt-5 text-sm text-[#64736a]">Signed in as {user?.email}</p>
              </div>
            ) : applicationQuery.isLoading ? (
              <div className="space-y-5 py-4" aria-label="Loading application" aria-busy="true">
                <div className="h-8 w-2/3 animate-pulse rounded bg-[#e9e4da]" /><div className="h-20 animate-pulse rounded bg-[#eee9df]" /><div className="h-32 animate-pulse rounded bg-[#eee9df]" />
              </div>
            ) : applicationQuery.isError ? (
              <div className="py-8" role="alert"><h2 className="font-['Space_Grotesk'] text-2xl font-semibold">Application details are unavailable</h2><p className="mt-3 text-sm text-[#98513f]">{problem}</p><Button variant="outline" className="mt-5" onClick={() => applicationQuery.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Try again</Button></div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e7e0d4] pb-5">
                  <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#a35c3f]">Maker application</p><h2 className="mt-2 font-['Space_Grotesk'] text-3xl font-semibold tracking-tight">{app?.vendor ? "Your application" : "Business details"}</h2></div>
                  {app?.vendor && <span className="rounded-full bg-[#f1eadb] px-3 py-1.5 text-xs font-semibold capitalize text-[#775d3d]">{app.vendor.status === "pending" ? "Pending review" : app.vendor.status}</span>}
                </div>
                {app?.vendor && <div className="mt-5 rounded-xl bg-[#f2f5ef] p-4">
                  <div className="flex gap-3"><FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-[#316d55]" /><div><h3 className="font-semibold">Review status</h3><p className="mt-1 text-sm leading-6 text-[#5c6b62]">{app.vendor.status === "approved" ? "Your business is approved. Continue to your vendor workspace." : app.vendor.status === "rejected" ? "Changes are needed before this application can proceed. Review the notes below and update your application." : app.vendor.status === "suspended" ? "Your selling access is currently paused. Contact the Afrolandx team for next steps." : "Your application is not approved yet. Complete both documents and submit for review; selling stays unavailable until final approval."}</p>
                    {app.review?.firstReviewerName && <p className="mt-3 text-xs text-[#65736a]">First review by {app.review.firstReviewerName}{app.review.firstReviewedAt ? ` · ${new Date(app.review.firstReviewedAt).toLocaleDateString()}` : ""}</p>}
                    {app.review?.secondReviewerName && <p className="mt-1 text-xs text-[#65736a]">Final approval by {app.review.secondReviewerName}{app.review.secondReviewedAt ? ` · ${new Date(app.review.secondReviewedAt).toLocaleDateString()}` : ""}</p>}
                  </div></div>
                </div>}
                {!locked && <form className="mt-6 space-y-4" onSubmit={event => { event.preventDefault(); saveMutation.mutate(); }}>
                  {[
                    ["contactName", "Contact name", "Your full name"],
                    ["businessName", "Business name", "Name customers will see"],
                    ["phone", "Phone number", "+234 800 000 0000"],
                    ["cacNumber", "CAC registration number", "For example RC1234567"],
                  ].map(([name, label, placeholder]) => <div key={name}>
                    <Label htmlFor={name}>{label}</Label><Input id={name} name={name} autoComplete={name === "contactName" ? "name" : name === "phone" ? "tel" : "off"} placeholder={placeholder} required={name !== "cacNumber"} value={form[name as keyof typeof form]} onChange={event => setForm(current => ({ ...current, [name]: event.target.value }))} />
                  </div>)}
                  <p className="text-xs leading-5 text-[#778078]">Use a CAC prefix such as RC, BN, IT, LP or LLP followed by the registration digits. A valid number is required before submission.</p>
                  <div><Label htmlFor="description">What do you make?</Label><Textarea id="description" required rows={4} placeholder="Tell us about your work, materials and where it is made." value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} /></div>
                  <Button type="submit" variant="outline" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Saving details…" : "Save business details"}</Button>
                </form>}
                {locked && <p className="mt-5 rounded-lg border border-[#d6dfd4] bg-[#f2f5ef] p-4 text-sm leading-6 text-[#53645a]">Documents and profile details are locked for approved or suspended businesses. Contact support if information needs correction.</p>}
                {!locked && <div className="mt-8 border-t border-[#e7e0d4] pt-6">
                  <h3 className="font-['Space_Grotesk'] text-xl font-semibold">Required evidence</h3><p className="mt-1 text-sm leading-6 text-[#67746b]">PDF, JPEG or PNG files up to 2 MB each. Both document types are needed before submission.</p>
                  <div className="mt-4 space-y-3">{kinds.map(({ kind, title, note }) => {
                    const uploaded = app?.evidence.find(item => item.kind === kind);
                    return <div key={kind} className="rounded-xl border border-[#e5dfd3] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex gap-3"><FileUp className="mt-1 h-5 w-5 text-[#a35c3f]" /><div><p className="font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-[#788179]">{note}</p></div></div>
                        {uploaded && <Button type="button" variant="ghost" size="sm" aria-label={`Remove ${title}`} disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(uploaded.id)}><Trash2 className="mr-1 h-4 w-4" />Remove</Button>}
                      </div>
                      {uploaded ? <p className="mt-3 text-xs text-[#35664f]">{uploaded.originalName} · {Math.max(1, Math.round(uploaded.bytes / 1024))} KB</p> : <label className="mt-3 inline-flex cursor-pointer items-center rounded-md border border-[#cfd8cf] px-3 py-2 text-sm font-medium text-[#315744] hover:bg-[#f3f6f1] focus-within:ring-2 focus-within:ring-[#316d55]">
                        Choose file<input className="sr-only" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={event => {
                          const file = event.currentTarget.files?.[0];
                          if (file && file.size > 2 * 1024 * 1024) setNotice("This file is larger than 2 MB. Choose a smaller document.");
                          else if (file && !/\.(pdf|jpe?g|png)$/i.test(file.name)) setNotice("Choose a PDF, JPEG or PNG document.");
                          else if (file) { setNotice(""); uploadMutation.mutate({ kind, file }); }
                          event.currentTarget.value = "";
                        }} />
                      </label>}
                    </div>;
                  })}</div>
                  {app?.needs?.length ? <ul className="mt-4 list-inside list-disc text-sm text-[#95583c]">{app.needs.map(item => <li key={item}>{item}</li>)}</ul> : null}
                  <Button className="mt-5 bg-[#245c49] text-white hover:bg-[#1a493a]" disabled={submitMutation.isPending || !app?.vendor || !validCac(form.cacNumber || app?.vendor?.cacNumber || "") || !kinds.every(item => evidenceKinds.has(item.kind))} onClick={() => submitMutation.mutate()}>{submitMutation.isPending ? "Submitting…" : "Submit for review"}</Button>
                  {!app?.vendor && <p className="mt-2 text-xs text-[#7a8178]">Save your business details before submitting.</p>}
                </div>}
                {problem && <p className="mt-5 rounded-lg border border-[#e8c9bb] bg-[#fbefea] p-3 text-sm text-[#8e4936]" role="alert">{problem}</p>}
                {notice && <p className="mt-4 text-sm text-[#35664f]" role="status">{notice}</p>}
                {app?.vendor?.status === "approved" && <Button asChild className="mt-5 bg-[#245c49] text-white"><Link href="/vendor">Open vendor workspace <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>}
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
