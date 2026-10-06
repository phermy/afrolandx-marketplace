import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ShipmentItem } from "@shared/logistics";
import { GitBranch, Plus, RotateCcw } from "lucide-react";

type SplitItem = { productId: number; quantity: number };
type SplitPayload = { requestKey: string; items: SplitItem[]; reason: string };

const newRequestKey = () => crypto.randomUUID();

export default function SplitShipmentForm({ shipmentId, orderId, items }: { shipmentId: number; orderId: number; items: ShipmentItem[] }) {
  const queryClient = useQueryClient();
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [reason, setReason] = useState("");
  const [success, setSuccess] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const requestKeyRef = useRef(newRequestKey());
  const lastItemsRef = useRef("");
  const submittedPayloadRef = useRef<SplitPayload | null>(null);

  const split = useMutation({
    mutationFn: async (payload: SplitPayload) => {
      const response = await apiRequest("POST", `/api/logistics/shipments/${shipmentId}/split`, payload);
      return response.json().catch(() => null);
    },
    onSuccess: () => {
      setSuccess(true);
      setQuantities({});
      setReason("");
      setAttempted(false);
      submittedPayloadRef.current = null;
      lastItemsRef.current = "";
      requestKeyRef.current = newRequestKey();
      queryClient.invalidateQueries({ queryKey: ["/api/logistics/shipments"] });
    },
  });

  const availableUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  const selectedItems = items.flatMap((item) => {
    const quantity = quantities[item.productId] || 0;
    return quantity > 0 ? [{ productId: item.productId, quantity }] : [];
  });
  const selectedUnits = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const validSelection = selectedUnits > 0 && selectedUnits < availableUnits;
  const canSubmit = validSelection && reason.trim().length >= 3 && !split.isPending;

  const setItemQuantity = (productId: number, value: number) => {
    const next = { ...quantities, [productId]: value };
    const nextItems = items.flatMap((item) => {
      const quantity = next[item.productId] || 0;
      return quantity > 0 ? [{ productId: item.productId, quantity }] : [];
    });
    const fingerprint = JSON.stringify(nextItems);
    if (fingerprint !== lastItemsRef.current) {
      requestKeyRef.current = newRequestKey();
      lastItemsRef.current = fingerprint;
      submittedPayloadRef.current = null;
      setAttempted(false);
      setSuccess(false);
    }
    setQuantities(next);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit && !submittedPayloadRef.current) return;
    const payload: SplitPayload = submittedPayloadRef.current || {
      requestKey: requestKeyRef.current,
      items: selectedItems,
      reason: reason.trim(),
    };
    submittedPayloadRef.current = payload;
    setAttempted(true);
    split.mutate(payload);
  };

  return <section className="rounded-xl border border-amber-200 bg-[#fffaf0] p-4">
    <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-950"><GitBranch className="h-4 w-4" />Split package</h4>
    <p className="mb-4 mt-1 text-xs leading-5 text-amber-900/80">Create a separate shipment for selected quantities. Leave at least one unit in this package. Each package is handled independently from this point.</p>
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-2">
        {items.map((item) => <label key={item.productId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-100 bg-white px-3 py-2">
          <span className="min-w-0 flex-1 text-sm text-slate-800">{item.name}<span className="ml-2 text-xs text-slate-500">In this package: {item.quantity}</span></span>
          <span className="flex items-center gap-2 text-xs text-slate-500"><span>Move</span><input aria-label={`Quantity of ${item.name} to move`} type="number" min={0} max={item.quantity} step={1} value={quantities[item.productId] || 0} onChange={(event) => setItemQuantity(item.productId, Math.min(item.quantity, Math.max(0, Number(event.target.value) || 0)))} className="h-9 w-20 rounded-md border border-amber-200 px-2 text-sm text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" /><span>units</span></span>
        </label>)}
      </div>
      <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">Reason for split</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} maxLength={1000} required disabled={attempted} placeholder="For example, an item needs separate handling or a different pickup." className="min-h-20 w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:bg-amber-50" /></label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-amber-900">{!selectedUnits ? "Choose at least one item quantity." : selectedUnits >= availableUnits ? "At least one unit must stay in the original package." : `${selectedUnits} unit${selectedUnits === 1 ? "" : "s"} selected for the new package.`}</p>
        <button type="submit" disabled={(!canSubmit && !submittedPayloadRef.current) || split.isPending} className="inline-flex h-9 items-center gap-2 rounded-md bg-amber-900 px-3 text-xs font-semibold text-white hover:bg-amber-950 disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-3.5 w-3.5" />{split.isPending ? "Creating package…" : attempted ? "Retry same split request" : "Create split shipment"}</button>
      </div>
    </form>
    {success && <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-teal-800"><RotateCcw className="h-3.5 w-3.5" />Split shipment created. Refreshing the package list.</p>}
    {split.isError && <p role="alert" className="mt-3 text-xs text-rose-800">The split could not be confirmed. You can retry safely with the same selected quantities; the request key is preserved until those quantities change.</p>}
  </section>;
}
