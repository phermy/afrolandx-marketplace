import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ShippingProviderConnections } from "@shared/shipping-providers";
import { RefreshCw } from "lucide-react";

export default function ProviderConnections({ userId }: { userId: string }) {
  const query = useQuery<ShippingProviderConnections>({
    queryKey: ["/api/logistics/providers", userId],
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const data = query.data;
  const active = data?.providers.find(provider => provider.id === data.activeProvider);
  return <section className="mb-6 rounded-xl border border-[#dce7e2] bg-white p-5" aria-labelledby="shipping-providers-title">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 id="shipping-providers-title" className="text-lg font-semibold text-slate-900">Primary and backup connections</h2>
        <p className="mt-1 text-sm text-slate-600">Shipbubble is preferred. Terminal Africa is selected only when the primary connection is unavailable and the backup has verified live access.</p>
      </div>
      <Button variant="outline" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
        <RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />Refresh status
      </Button>
    </div>
    {query.isLoading && <p role="status" className="mt-4 text-sm text-slate-600">Checking provider connections…</p>}
    {query.isError && <p role="alert" className="mt-4 text-sm text-rose-700">Provider status could not be checked. Use manual confirmation and retry.</p>}
    {data && <>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {data.providers.map(provider => <div key={provider.id} className="rounded-lg border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-slate-900">{provider.name} <span className="text-sm font-normal text-slate-500">· {provider.role === "primary" ? "Primary" : "Backup"}</span></h3>
            <Badge variant={provider.status === "connected" ? "default" : "outline"}>{provider.status === "connected" ? "Live API verified" : "Not available"}</Badge>
          </div>
          <p className="mt-2 text-sm text-slate-600">{provider.message}</p>
          {provider.status === "connected" && <details className="mt-3 text-sm text-slate-600">
            <summary className="cursor-pointer font-medium">{provider.couriers.length} operational couriers returned</summary>
            <ul className="mt-2 max-h-40 list-inside list-disc overflow-auto">{provider.couriers.map((courier, index) => <li key={`${courier.name}-${index}`}>{courier.name}{courier.international ? " · International" : ""}{courier.domestic ? " · Domestic" : ""}</li>)}</ul>
          </details>}
          <p className="mt-3 text-xs text-slate-500">Checked {new Date(provider.checkedAt).toLocaleString()}</p>
        </div>)}
      </div>
      <p role="status" className={`mt-4 text-sm font-medium ${data.manualRequired ? "text-amber-800" : "text-teal-800"}`}>
        {active ? `Selected connection: ${active.name}${data.usingBackup ? " (backup)" : " (primary)"}.` : "Neither provider is verified. Manual shipping confirmation is required."}
      </p>
    </>}
    <p className="mt-3 text-xs leading-5 text-slate-500">This checks carrier connections only. Checkout estimates and shipping quotes remain unchanged. Bookings, agency payments and tracking updates remain manual; no automatic paid booking or booking failover is enabled. Successful connections are cached for up to five minutes, failures for one minute.</p>
  </section>;
}
