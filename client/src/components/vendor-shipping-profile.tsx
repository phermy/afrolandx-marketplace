import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

const fields = [
  ["firstName","Pickup contact first name"],["lastName","Last name"],["contactEmail","Pickup email"],
  ["phone","Pickup phone"],["address1","Pickup street address"],["address2","Address line 2"],
  ["city","City"],["state","State or province"],["postalCode","Postal code"],["country","Country"],
] as const;
export default function VendorShippingProfile() {
  const { toast } = useToast();
  const [address,setAddress] = useState<Record<string,string>>(Object.fromEntries(fields.map(([k])=>[k,""])));
  const [categoryId,setCategory] = useState("");
  const [processingDays,setDays] = useState("1");
  const profile = useQuery<any>({queryKey:["/api/vendors/me/shipping-profile"],retry:false});
  const categories = useQuery<any[]>({queryKey:["/api/shipping/package-categories"],retry:false,staleTime:3600_000});
  useEffect(()=>{
    if(profile.data){setAddress(profile.data.address);setCategory(String(profile.data.category_id));setDays(String(profile.data.processing_days));}
  },[profile.data]);
  const save = useMutation({
    mutationFn:()=>apiRequest("PUT","/api/vendors/me/shipping-profile",{address,categoryId:Number(categoryId),processingDays:Number(processingDays)}),
    onSuccess:()=>toast({title:"Pickup details saved",description:"Add accurate shipping weights and packed dimensions to your products so buyers can get live rates."}),
    onError:(e:Error)=>toast({title:"Could not save pickup details",description:e.message,variant:"destructive"}),
  });
  return <section className="mb-6 rounded-lg border bg-white p-6" aria-label="Vendor shipping setup">
    <h2 className="text-xl font-semibold">Shipping setup</h2>
    <p className="mt-2 mb-4 text-sm text-gray-600">Carriers collect from this address. Afrolandx does not warehouse your products. Each listing needs its packed weight in kg and packed dimensions in cm. Parcels are quoted as stacked packages; prepare them to match the listing dimensions.</p>
    {profile.isError && <p role="alert" className="text-red-700">Could not load your pickup profile. Retry before making changes.</p>}
    <form onSubmit={e=>{e.preventDefault();save.mutate();}} className="grid gap-4 sm:grid-cols-2">
      {fields.map(([key,label])=><label key={key} className="text-sm font-medium">{label}
        <input className="mt-1 w-full rounded border p-2" value={address[key] || ""} type={key==="contactEmail"?"email":"text"}
          required={!["lastName","address2"].includes(key)} onChange={e=>setAddress(a=>({...a,[key]:e.target.value}))}/>
      </label>)}
      <label className="text-sm font-medium">Package category
        <select required value={categoryId} onChange={e=>setCategory(e.target.value)} className="mt-1 w-full rounded border p-2">
          <option value="">Choose your category</option>
          {categories.data?.map(c=><option key={c.category_id} value={c.category_id}>{c.category}</option>)}
        </select>
        {categories.isError && <span role="alert" className="text-red-700">Shipping categories could not be loaded.</span>}
      </label>
      <label className="text-sm font-medium">Days needed to prepare for pickup
        <input required type="number" min="1" max="6" value={processingDays} onChange={e=>setDays(e.target.value)} className="mt-1 w-full rounded border p-2"/>
      </label>
      <Button type="submit" disabled={save.isPending || profile.isLoading || profile.isError || categories.isError}>Save pickup details</Button>
    </form>
  </section>;
}
