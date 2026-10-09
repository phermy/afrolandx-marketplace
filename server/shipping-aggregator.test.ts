import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";
import crypto from "crypto";
import { requiresDdp, parcelDimensions, selectDeliveryOptions, validShipbubbleSignature, ratesForPackage, createProviderLabel } from "./shipping-aggregator";

test("DDP is required for UK US and Canada aliases",()=>{
  for(const country of ["UK","United Kingdom","US","USA","United States","Canada","CA"]) assert.equal(requiresDdp(country),true);
  assert.equal(requiresDdp("Nigeria"),false);
});
test("missing and invalid parcel dimensions never generate invented rates",()=>{
  assert.throws(()=>parcelDimensions(null));
  assert.throws(()=>parcelDimensions("0x2x3"));
  assert.throws(()=>parcelDimensions("very small"));
  assert.deepEqual(parcelDimensions("20 × 10 × 5 cm"),{length:20,width:10,height:5});
});
test("bundled services charge every seller once and return at most three distinct options",()=>{
  const p=(vendorId:number,amount:number,courierId:string,deliveryDate:string)=>({vendorId,amount,duties:15,requestToken:`token${vendorId}`,courierId,serviceCode:courierId,carrier:courierId,deliveryDate,dutiesPaid:true});
  const groups=[[p(1,100,"slow","2030-01-05"),p(1,200,"fast","2030-01-02")],[p(2,50,"slow","2030-01-06"),p(2,150,"fast","2030-01-03")]];
  const options=selectDeliveryOptions(groups);
  assert.equal(options.length,2);
  assert.equal(options[0].shippingAmount,180);
  assert.equal(options[0].deliveryDate,"2030-01-06");
  assert.equal(options[1].shippingAmount,380);
  assert.equal(options[1].packages.length,2);
});
test("signed webhooks require the exact body and reject malformed signatures",t=>{
  const before=process.env.SHIPBUBBLE_API_KEY;process.env.SHIPBUBBLE_API_KEY="fixture";
  t.after(()=>{if(before===undefined)delete process.env.SHIPBUBBLE_API_KEY;else process.env.SHIPBUBBLE_API_KEY=before;});
  const body=Buffer.from('{"order_id":"fixture"}');
  const signature=crypto.createHmac("sha512","fixture").update(body).digest("hex");
  assert.equal(validShipbubbleSignature(body,signature),true);
  assert.equal(validShipbubbleSignature(Buffer.from("{}"),signature),false);
  assert.equal(validShipbubbleSignature(body,"123"),false);
});
test("DDP calculator failure blocks rates, while successful duties are added and COD stays disabled",async t=>{
  const before=process.env.SHIPBUBBLE_API_KEY;process.env.SHIPBUBBLE_API_KEY="fixture";
  t.after(()=>{mock.restoreAll();if(before===undefined)delete process.env.SHIPBUBBLE_API_KEY;else process.env.SHIPBUBBLE_API_KEY=before;});
  let failed=true;let booking:any;
  mock.method(globalThis,"fetch",async(url:any,init:any)=>{
    if(String(url).endsWith("/address/validate")) return Response.json({status:"success",data:{address_code:123}});
    if(String(url).includes("/landed-cost")) return failed?Response.json({status:"failed"},{status:400}):Response.json({status:"success",data:{amount:50,currency:"NGN"}});
    if(String(url).endsWith("/fetch_rates")) return Response.json({status:"success",data:{request_token:"fixture",couriers:[{courier_id:1,courier_name:"Carrier",service_code:"standard",currency:"NGN",rate_card_amount:90,total:100,delivery_eta_time:"2030-01-03"}]}});
    booking=JSON.parse(init.body);return Response.json({status:"success",data:{order_id:"SB-fixture"}});
  });
  const contact={firstName:"Fixture",address1:"Fixture address",city:"City",state:"State",postalCode:"123",country:"United Kingdom",contactEmail:"fixture@example.test",phone:"+44123456789"};
  const input={vendorId:1,sender:contact,receiver:contact,categoryId:1,items:[{name:"Garment",description:"Garment",unit_weight:1,unit_amount:1000,quantity:1}],dimensions:{length:20,width:10,height:5},pickupDate:"2030-01-01"};
  await assert.rejects(ratesForPackage(input));
  failed=false;const rates=await ratesForPackage(input);
  assert.equal(rates[0].duties,50);assert.equal(rates[0].dutiesPaid,true);
  assert.equal(rates[0].amount,100);
  await createProviderLabel(rates[0]);
  assert.equal(booking.duties_paid,true);assert.equal(booking.is_cod_label,false);
});
