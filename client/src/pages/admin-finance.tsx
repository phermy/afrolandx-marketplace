import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Navbar from "@/components/navbar";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const ngn = (value: unknown) => `₦${Number(value || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

export default function AdminFinance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [orderId, setOrderId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [chargebackReference, setChargebackReference] = useState("");
  const [settlementOtps, setSettlementOtps] = useState<Record<number, string>>({});
  const { data: finance } = useQuery<any>({ queryKey: ["/api/admin/finance"], retry: false });
  const { data: vendors = [] } = useQuery<any[]>({ queryKey: ["/api/vendors"], retry: false });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/finance"] });
    queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
  };
  const verifyMutation = useMutation({
    mutationFn: async (vendorId: number) => (await apiRequest("PATCH", `/api/admin/vendors/${vendorId}/verification`, {
      cacVerified: true, identityVerified: true, businessVerified: true, decision: "verified", notes: "Verification evidence reviewed by administrator.",
    })).json(),
    onSuccess: () => { refresh(); toast({ title: "Vendor verification completed" }); },
    onError: (error: any) => toast({ title: "Verification failed", description: error?.message, variant: "destructive" }),
  });
  const settleMutation = useMutation({
    mutationFn: async (vendorId: number) => (await apiRequest("POST", `/api/admin/vendors/${vendorId}/settlements`)).json(),
    onSuccess: () => { refresh(); toast({ title: "Settlement submitted to Paystack" }); },
    onError: (error: any) => toast({ title: "Settlement failed", description: error?.message, variant: "destructive" }),
  });
  const adjustmentMutation = useMutation({
    mutationFn: async (kind: "refund" | "chargeback") => {
      const path = kind === "refund" ? "refunds" : "chargebacks";
      return (await apiRequest("POST", `/api/admin/orders/${orderId}/${path}`, {
        amount: Number(amount), reason, ...(kind === "chargeback" ? { reference: chargebackReference } : {}),
      })).json();
    },
    onSuccess: () => { refresh(); setAmount(""); setReason(""); setChargebackReference(""); toast({ title: "Financial adjustment recorded" }); },
    onError: (error: any) => toast({ title: "Adjustment failed", description: error?.message, variant: "destructive" }),
  });
  const reconcileMutation = useMutation({
    mutationFn: async (settlementId: number) =>
      (await apiRequest("POST", `/api/admin/settlements/${settlementId}/reconcile`)).json(),
    onSuccess: () => { refresh(); toast({ title: "Settlement reconciled with Paystack" }); },
    onError: (error: any) => toast({ title: "Reconciliation failed", description: error?.message, variant: "destructive" }),
  });
  const refundReconcileMutation = useMutation({
    mutationFn: async (adjustmentId: number) =>
      (await apiRequest("POST", `/api/admin/adjustments/${adjustmentId}/reconcile`)).json(),
    onSuccess: () => { refresh(); toast({ title: "Refund reconciled with Paystack" }); },
    onError: (error: any) => toast({ title: "Refund reconciliation failed", description: error?.message, variant: "destructive" }),
  });
  const otpMutation = useMutation({
    mutationFn: async (settlementId: number) =>
      (await apiRequest("POST", `/api/admin/settlements/${settlementId}/finalize-otp`, {
        otp: settlementOtps[settlementId],
      })).json(),
    onSuccess: (_data, settlementId) => {
      refresh();
      setSettlementOtps(current => ({ ...current, [settlementId]: "" }));
      toast({ title: "Transfer OTP submitted" });
    },
    onError: (error: any) => toast({ title: "OTP submission failed", description: error?.message, variant: "destructive" }),
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div><h1 className="text-3xl font-bold">Finance administration</h1><p className="text-gray-500">Verification, refunds, chargebacks, and vendor settlements.</p></div>
        <Card>
          <CardHeader><CardTitle>Vendor verification and payouts</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {vendors.map(vendor => (
              <div key={vendor.id} className="flex flex-wrap items-center justify-between gap-3 border rounded-lg p-3">
                <div><p className="font-medium">{vendor.businessName}</p><p className="text-xs text-gray-500">CAC: {vendor.cacNumber || "Not supplied"} · Verification: {vendor.verificationStatus}</p></div>
                <div className="flex gap-2">
                  {vendor.verificationStatus !== "verified" && <Button size="sm" variant="outline" disabled={!vendor.cacNumber || verifyMutation.isPending} onClick={() => verifyMutation.mutate(vendor.id)}>Mark checks verified</Button>}
                  <Button size="sm" disabled={vendor.status !== "approved" || vendor.verificationStatus !== "verified" || settleMutation.isPending} onClick={() => settleMutation.mutate(vendor.id)}>Pay available balance</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Refund or chargeback</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-3">
            <Input value={orderId} onChange={event => setOrderId(event.target.value.replace(/\D/g, ""))} placeholder="Order ID" />
            <Input value={amount} onChange={event => setAmount(event.target.value)} type="number" min="0.01" step="0.01" placeholder="Merchandise amount in NGN" />
            <Input value={chargebackReference} onChange={event => setChargebackReference(event.target.value)} placeholder="Chargeback reference (chargebacks only)" />
            <Textarea value={reason} onChange={event => setReason(event.target.value)} placeholder="Reason" />
            <div className="flex gap-2 md:col-span-2">
              <Button disabled={!orderId || !amount || reason.length < 5 || adjustmentMutation.isPending} onClick={() => adjustmentMutation.mutate("refund")}>Refund through Paystack</Button>
              <Button variant="destructive" disabled={!orderId || !amount || reason.length < 5 || !chargebackReference || adjustmentMutation.isPending} onClick={() => adjustmentMutation.mutate("chargeback")}>Record chargeback</Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Settlement history</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="py-2">Vendor</th><th>Gross</th><th>Commission</th><th>Net</th><th>Status</th><th>Date</th><th>Action</th></tr></thead>
              <tbody>{(finance?.settlements || []).map((settlement: any) => <tr key={settlement.id} className="border-b"><td className="py-2">{settlement.vendorName}</td><td>{ngn(settlement.grossAmount)}</td><td>{ngn(settlement.commissionAmount)}</td><td>{ngn(settlement.netAmount)}</td><td className="capitalize">{settlement.status}</td><td>{new Date(settlement.createdAt).toLocaleDateString("en-GB")}</td><td><div className="flex gap-2 items-center">{settlement.providerReference && settlement.status === "processing" && <Button size="sm" variant="outline" disabled={reconcileMutation.isPending} onClick={() => reconcileMutation.mutate(settlement.id)}>Check Paystack</Button>}{settlement.status === "processing" && String(settlement.failureReason || "").toLowerCase().includes("otp") && <><Input className="w-24 h-8" value={settlementOtps[settlement.id] || ""} onChange={event => setSettlementOtps(current => ({ ...current, [settlement.id]: event.target.value.replace(/\D/g, "").slice(0, 6) }))} placeholder="6-digit OTP" /><Button size="sm" disabled={(settlementOtps[settlement.id] || "").length !== 6 || otpMutation.isPending} onClick={() => otpMutation.mutate(settlement.id)}>Submit OTP</Button></>}</div></td></tr>)}</tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Refund reconciliation</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(finance?.adjustments || []).filter((adjustment: any) => adjustment.kind === "refund" && adjustment.status === "processing").map((adjustment: any) => (
              <div key={adjustment.id} className="flex flex-wrap items-center justify-between gap-3 border rounded-lg p-3">
                <div><p className="font-medium">Order #{adjustment.orderId} · {ngn(adjustment.amount)}</p><p className="text-xs text-gray-500">{adjustment.providerReference}</p></div>
                <Button size="sm" variant="outline" disabled={refundReconcileMutation.isPending} onClick={() => refundReconcileMutation.mutate(adjustment.id)}>Check Paystack refund</Button>
              </div>
            ))}
            {!(finance?.adjustments || []).some((adjustment: any) => adjustment.kind === "refund" && adjustment.status === "processing") && <p className="text-sm text-gray-500">No refunds require reconciliation.</p>}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}