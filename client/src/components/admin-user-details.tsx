import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { User } from "@/types";

type Details = {
  account: User;
  addresses: { id: number; label: string; firstName: string; lastName: string; address1: string; address2: string; city: string; state: string; postalCode: string; country: string; isDefault: boolean }[];
  orderCount: number;
  orders: { id: number; totalAmount: string; orderStatus: string; paymentStatus: string; createdAt: string }[];
  vendor: { businessName: string; contactName: string; phone: string; cacNumber: string; status: string; verificationStatus: string } | null;
};

const date = (value?: string | null) => value ? new Date(value).toLocaleDateString() : "Not recorded";

export function AdminUserDetails({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const { data, isLoading, error, refetch } = useQuery<Details>({
    queryKey: ["/api/admin/users", userId],
    queryFn: async () => (await apiRequest("GET", `/api/admin/users/${encodeURIComponent(userId!)}`)).json(),
    enabled: Boolean(userId),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  return (
    <Dialog open={Boolean(userId)} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[85dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Account details</DialogTitle>
          <DialogDescription>Contact information, saved delivery addresses, and recent orders.</DialogDescription>
        </DialogHeader>
        {isLoading && <p role="status">Loading account details…</p>}
        {error && <div role="alert"><p>Could not load account details.</p><Button variant="outline" onClick={() => refetch()}>Try again</Button></div>}
        {data && (
          <div className="space-y-6">
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              {[
                ["Name", [data.account.firstName, data.account.lastName].filter(Boolean).join(" ") || "Not provided"],
                ["Email", data.account.email || "Not provided"],
                ["Phone", data.account.phone || "Not recorded for this account"],
                ["Roles", (data.account.roles || []).join(", ")],
                ["Email verification", data.account.emailVerified ? "Verified" : "Not verified"],
                ["Account status", data.account.closedAt ? `Closed ${date(data.account.closedAt)}` : "Active"],
                ["Joined", date(data.account.createdAt)],
                ["Signup choice", data.account.signupIntent === "vendor" ? "Vendor application" : "Customer"],
              ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="font-semibold">{label}</dt><dd className="break-words text-gray-600">{value}</dd></div>)}
            </dl>
            {data.vendor && <section className="rounded border p-3 text-sm">
              <h3 className="mb-2 font-semibold">Vendor application</h3>
              <p>{data.vendor.businessName}</p>
              <p>Contact: {data.vendor.contactName || "Not provided"}</p>
              <p>Business phone: {data.vendor.phone || "Not provided"}</p>
              <p>CAC: {data.vendor.cacNumber || "Not provided"}</p>
              <p>Status: {data.vendor.status} · Verification: {data.vendor.verificationStatus}</p>
            </section>}
            <section>
              <h3 className="mb-2 font-semibold">Saved delivery addresses</h3>
              {data.addresses.length === 0 && <p className="text-sm text-gray-600">No saved addresses.</p>}
              <div className="space-y-2">{data.addresses.map(address => <div key={address.id} className="rounded border p-3 text-sm break-words">
                <p className="font-semibold">{address.label}{address.isDefault ? " (Default)" : ""}</p>
                <p>{address.firstName} {address.lastName}</p>
                <p>{[address.address1, address.address2, address.city, address.state, address.postalCode, address.country].filter(Boolean).join(", ")}</p>
              </div>)}</div>
            </section>
            <section>
              <h3 className="mb-2 font-semibold">Orders ({data.orderCount})</h3>
              {data.orderCount === 0 && <p className="text-sm text-gray-600">No orders yet.</p>}
              {data.orderCount > 20 && <p className="mb-2 text-sm text-gray-600">Showing the 20 most recent orders.</p>}
              <div className="space-y-2">{data.orders.map(order => <div key={order.id} className="rounded border p-3 text-sm">
                <p className="font-semibold">Order #{order.id} · NGN {Number(order.totalAmount).toLocaleString()}</p>
                <p>{date(order.createdAt)} · {order.orderStatus} · Payment: {order.paymentStatus}</p>
              </div>)}</div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
