import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Navbar from "@/components/navbar";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ngn = (value: unknown) => `₦${Number(value || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

export default function VendorFinance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const { data: finance, isLoading } = useQuery<any>({ queryKey: ["/api/vendors/me/finance"], retry: false });
  const { data: banks = [] } = useQuery<any[]>({ queryKey: ["/api/paystack/banks"], retry: false });
  const selectedBank = banks.find(bank => bank.code === bankCode);
  const accountMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PUT", "/api/vendors/me/payout-account", {
        accountNumber,
        bankCode,
        bankName: selectedBank?.name,
      });
      return response.json();
    },
    onSuccess: () => {
      setAccountNumber("");
      queryClient.invalidateQueries({ queryKey: ["/api/vendors/me/finance"] });
      toast({ title: "Payout account verified", description: "Only masked account details are stored by Afrolandx." });
    },
    onError: (error: any) => toast({ title: "Account verification failed", description: error?.message || "Check the account details.", variant: "destructive" }),
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Vendor finance</h1>
          <p className="text-gray-500">8% commission applies to merchandise only. Shipping is excluded.</p>
        </div>
        {isLoading ? <p>Loading finance records…</p> : (
          <>
            <div className="grid md:grid-cols-3 gap-4">
              <Card><CardHeader><CardTitle className="text-sm">Pending delivery</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{ngn(finance?.summary?.pending)}</CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm">Available for payout</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-green-700">{ngn(finance?.summary?.available)}</CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm">Settled</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{ngn(finance?.summary?.settled)}</CardContent></Card>
            </div>
            <Card>
              <CardHeader><CardTitle>Payout account</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {finance?.payoutAccount && (
                  <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
                    Verified: {finance.payoutAccount.accountName} · {finance.payoutAccount.bankName} · •••• {finance.payoutAccount.accountLast4}
                  </p>
                )}
                <div className="grid md:grid-cols-[1fr_1fr_auto] gap-3">
                  <Select value={bankCode} onValueChange={setBankCode}>
                    <SelectTrigger><SelectValue placeholder="Choose bank" /></SelectTrigger>
                    <SelectContent>{banks.map(bank => <SelectItem key={bank.code} value={bank.code}>{bank.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input value={accountNumber} onChange={event => setAccountNumber(event.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="Enter an account number with 10 digits" />
                  <Button disabled={!bankCode || accountNumber.length !== 10 || accountMutation.isPending} onClick={() => accountMutation.mutate()}>
                    {accountMutation.isPending ? "Verifying…" : "Verify account"}
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Statement</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left"><th className="py-2">Date</th><th>Order</th><th>Type</th><th>Gross</th><th>Commission</th><th>Net</th><th>Status</th></tr></thead>
                  <tbody>{(finance?.entries || []).map((entry: any) => (
                    <tr key={entry.id} className="border-b">
                      <td className="py-2">{new Date(entry.createdAt).toLocaleDateString("en-GB")}</td>
                      <td>#{entry.orderId}</td><td className="capitalize">{entry.entryType}</td>
                      <td>{ngn(entry.grossAmount)}</td><td>{ngn(entry.commissionAmount)}</td><td className="font-medium">{ngn(entry.netAmount)}</td>
                      <td className="capitalize">{entry.status}</td>
                    </tr>
                  ))}</tbody>
                </table>
                {!finance?.entries?.length && <p className="py-6 text-gray-500">No statement entries yet.</p>}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}