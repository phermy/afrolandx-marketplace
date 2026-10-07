import assert from "node:assert/strict";
import test from "node:test";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { emailPayload, sendPaymentEmail } from "./email";
import { notifyOrderPayment } from "./payment-emails";
import { storage } from "./storage";
import { PAYMENT_EMAIL } from "../shared/payment-contact";

test("payment mail uses the payments sender and reply address while preserving each customer's recipient", () => {
  const receipt = emailPayload("buyer@example.test", "Receipt", "<p>Paid</p>", true);
  assert.equal(receipt.from, `Afrolandx <${PAYMENT_EMAIL}>`);
  assert.equal(receipt.reply_to, PAYMENT_EMAIL);
  assert.deepEqual(receipt.to, ["buyer@example.test"]);
  assert.deepEqual(receipt.bcc, [PAYMENT_EMAIL]);
  const internal = emailPayload(PAYMENT_EMAIL, "Internal alert", "<p>Paid</p>", true);
  assert.deepEqual(internal.to, [PAYMENT_EMAIL]);
  assert.equal(internal.bcc, undefined);
  const auth = emailPayload("buyer@example.test", "Sign in", "<p>Code</p>");
  assert.equal(auth.reply_to, "support@afrolandx.com");
  assert.equal(auth.bcc, undefined);
  assert.notEqual(auth.from, receipt.from);
});

test("payment messages escape untrusted text and use stable provider keys for duplicate events", async t => {
  const sent: any[] = [];
  t.mock.method(ReplitConnectors.prototype, "proxy", async (_provider: string, _path: string, init: any) => {
    sent.push(init);
    return new Response("{}", { status: 200 });
  });
  await sendPaymentEmail("buyer@example.test", "Receipt", "<script>unsafe</script>", "order:1:paid");
  await sendPaymentEmail("buyer@example.test", "Receipt", "<script>unsafe</script>", "order:1:paid");
  assert.equal(sent[0].headers["Idempotency-Key"], sent[1].headers["Idempotency-Key"]);
  const body = JSON.parse(sent[0].body);
  assert.match(body.html, /&lt;script&gt;unsafe&lt;\/script&gt;/);
  assert.ok(body.html.includes(`mailto:${PAYMENT_EMAIL}`));
  assert.deepEqual(body.bcc, [PAYMENT_EMAIL]);
});

test("only confirmed order payments receive receipts and a mail outage cannot alter a payment", async t => {
  let paid = false;
  let attempts = 0;
  t.mock.method(storage, "getOrder", async () => ({
    id: 1, userId: "buyer", paymentStatus: paid ? "paid" : "pending", totalAmount: "12500",
    paymentReference: "reference-1",
  }));
  t.mock.method(storage, "getUser", async () => ({ id: "buyer", email: "buyer@example.test" }));
  t.mock.method(ReplitConnectors.prototype, "proxy", async () => { attempts++; throw new Error("Mail provider unavailable"); });
  t.mock.method(console, "error", () => {});
  await notifyOrderPayment(1);
  assert.equal(attempts, 0);
  paid = true;
  await assert.doesNotReject(() => notifyOrderPayment(1));
  assert.equal(attempts, 1);
  assert.equal(paid, true);
});
