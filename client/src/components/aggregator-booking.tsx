import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function AggregatorBooking({orderId,labelUrl}:{orderId:number;labelUrl?:string}) {
  const [confirmed,setConfirmed]=useState(false);
  const {toast}=useToast();
  const queries=useQueryClient();
  const action=useMutation({
    mutationFn:(kind:"book"|"sync")=>apiRequest("POST",`/api/admin/orders/${orderId}/aggregator-${kind}`,{confirmWalletCharge:confirmed}),
    onSuccess:()=>{queries.invalidateQueries({queryKey:["/api/logistics/shipments"]});toast({title:"Carrier information updated"});},
    onError:(e:Error)=>toast({title:"Carrier request could not be completed",description:e.message,variant:"destructive"}),
  });
  return <section className="rounded-xl border p-4">
    <h4 className="font-semibold">Aggregator booking</h4>
    <p className="my-2 text-xs text-gray-600">Book the vendor pickups through Shipbubble using the rates already paid by the buyer. Booking charges the provider wallet. Never retry an uncertain booking.</p>
    <label className="my-3 flex gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I confirm the shipping-wallet charge.</label>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={!confirmed||action.isPending} onClick={()=>action.mutate("book")}>Book carrier and get labels</Button>
      <Button size="sm" variant="outline" disabled={action.isPending} onClick={()=>action.mutate("sync")}>Refresh carrier tracking</Button>
      {labelUrl && <a className="text-sm underline" href={labelUrl} target="_blank" rel="noreferrer">Download shipping label</a>}
    </div>
  </section>;
}
