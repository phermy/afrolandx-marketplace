import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { AccountCommerceItem } from "@shared/account-commerce";

export function AccountCommerceHistory({ title, items }: { title: string; items: AccountCommerceItem[] }) {
  const [limit, setLimit] = useState(20);
  return <section>
    <h3 className="mb-2 font-semibold">{title} ({items.length} product entries)</h3>
    {items.length === 0 && <p className="text-sm text-gray-600">No history recorded.</p>}
    <div className="space-y-2">{items.slice(0, limit).map((item, index) => <div key={`${item.orderId}-${item.productId}-${index}`} className="rounded border p-3 text-sm">
      <p className="break-words font-semibold">{item.productName || `Product #${item.productId}`}</p>
      <p>Order #{item.orderId} · Quantity: {item.quantity} · Unit price: ₦{Number(item.unitPrice).toLocaleString()}</p>
      <p>Product total: ₦{(Number(item.unitPrice) * item.quantity).toLocaleString()}</p>
      <p>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "Date not recorded"} · {item.orderStatus || "Unknown status"} · Payment: {item.paymentStatus || "Unknown"}</p>
    </div>)}</div>
    {items.length > limit && <Button className="mt-3" variant="outline" onClick={() => setLimit(value => value + 20)}>Show more history</Button>}
  </section>;
}
