# AfrolandX Payment and Vendor Settlement Workflow

**Effective date:** 12 September 2026

**Transaction and settlement currency:** Nigerian Naira (NGN)

**Marketplace commission:** 8% of merchandise value

**Payment and transfer provider:** Paystack

## 1. Purpose

This document explains how AfrolandX receives customer payments, calculates vendor earnings, verifies payout accounts, settles vendors, and accounts for refunds and chargebacks.

AfrolandX controls the payment and settlement process. Vendors do not collect customer payments through their own Paystack accounts and do not need to register with or manage Paystack.

## 2. Roles and responsibilities

### Customer

- Selects products and an available shipping method.
- Pays the final amount presented by AfrolandX.
- Pays AfrolandX through the Paystack checkout process.
- May receive a refund when AfrolandX approves one.

### Vendor

- Supplies products and fulfils confirmed orders.
- Completes AfrolandX vendor verification requirements.
- Provides a Nigerian bank name and 10-digit account number to AfrolandX.
- Reviews pending, available, processing, and settled earnings on AfrolandX.
- Does not open or operate a Paystack account for AfrolandX sales.
- Does not initiate customer charges, refunds, chargebacks, or settlements.

### AfrolandX administrator

- Reviews the vendor's CAC information, identity check, and business check.
- Approves a vendor only after all required checks are marked complete.
- Reviews orders and delivery status.
- Initiates vendor settlements.
- Submits merchandise refunds to Paystack.
- Records confirmed chargebacks and their references.
- Reviews ledger entries, financial adjustments, and settlement history.

### Paystack

- Processes customer payments for AfrolandX.
- Confirms transaction status to AfrolandX.
- Resolves Nigerian bank-account names.
- Creates a transfer-recipient code for a verified bank account.
- Transfers approved settlement amounts from the AfrolandX Paystack balance.
- Reports transfer success, failure, or reversal to AfrolandX.

## 3. Customer payment

1. AfrolandX calculates the order amount on the server.
2. The payment is initialized in NGN and sent to Paystack in kobo.
3. Paystack processes the customer's payment.
4. AfrolandX verifies the payment reference, amount, currency, order metadata, and successful status.
5. Only a verified payment changes the order to paid and creates vendor sale entries.
6. AfrolandX attempts to reserve every purchased item from stock.
7. If stock is reserved, every vendor is approved, and shipping is fully resolved, the order moves automatically to Processing.

If a final shipping quote or shipping balance is still outstanding, the paid order remains Awaiting Shipping Quote. It moves automatically to Processing after the final quote is covered or the remaining shipping balance is paid, provided stock is reserved and all vendors remain approved.

If stock reservation fails or another condition is not satisfied, AfrolandX does not start fulfilment automatically. The order remains held for administrator review.

A payment may contain:

- **merchandise value:** the products purchased from one or more vendors; and
- **shipping value:** the applicable shipping estimate or confirmed shipping charge.

These amounts are accounted for separately. Shipping is not vendor merchandise income and is not subject to the 8% marketplace commission.

Duplicate callbacks or webhooks do not create another paid transition or another sale entry for the same vendor and order.

## 4. Commission and vendor earnings

For each vendor represented in a paid order, AfrolandX groups that vendor's order items and calculates:

> **Commission = vendor merchandise value × 8%**

> **Vendor net earning = vendor merchandise value − commission**

Amounts are rounded to two decimal places.

### Example

A vendor supplies merchandise worth **₦100,000**:

- Merchandise value: ₦100,000
- AfrolandX commission at 8%: ₦8,000
- Vendor net earning: ₦92,000

If shipping is ₦15,000, the customer may pay ₦115,000, but commission is still calculated on ₦100,000 only. The vendor earning remains ₦92,000.

## 5. Multi-vendor orders

If one order contains products from several vendors:

- each vendor receives a separate ledger entry;
- each vendor's commission is based only on that vendor's merchandise;
- shipping is excluded from every vendor calculation; and
- later refunds or chargebacks are allocated proportionally using each vendor's merchandise share.

This prevents one vendor's products or adjustments from being included in another vendor's balance.

## 6. Vendor ledger and balance states

The vendor ledger is the permanent financial statement used to calculate balances. Current product prices are not used to recalculate historical earnings.

Ledger entries include sales, refunds, and chargebacks. Each entry records the order, vendor, gross merchandise amount, commission, net vendor amount, status, reference, description, and date.

### Pending

A vendor sale entry becomes pending after the customer's payment is verified. It is not yet eligible for settlement. The fulfilment order itself may move directly to Processing when the automatic safety conditions pass; ledger earnings still remain pending until delivery.

### Available

When the order is marked delivered, its pending sale entries become available. Refund or chargeback entries may reduce the available balance.

### Processing

When an administrator creates a settlement, the selected available entries are locked to that settlement and become processing. They cannot be selected for another settlement while the transfer is in progress.

The Paystack transfer reference is persisted before submission. Network timeouts, rate limits, and provider 5xx responses are treated as unknown outcomes: the entries remain locked until a signed webhook or an administrator's Paystack reconciliation confirms the result. If Paystack requires transfer OTP, an administrator completes the protected OTP step before the settlement can become paid.

### Settled

When Paystack confirms a successful transfer, the settlement is marked paid and its processing ledger entries become settled.

If Paystack rejects, fails, or reverses a transfer, the entries are released back to available so an administrator can investigate and retry safely.

## 7. Vendor verification

AfrolandX uses an administrator-reviewed verification checklist. Before approval, the administrator must confirm:

- a CAC number is present;
- the CAC information has been reviewed;
- the vendor's identity check has been completed; and
- the business check has been completed.

The administrator may mark verification as verified or rejected and add review notes. A vendor cannot be approved while verification is incomplete. A vendor must be approved and verified before AfrolandX can settle their earnings.

This workflow records the administrator's verification decision. It should not be described as an automatic live lookup against the CAC registry unless a separate registry integration is added.

## 8. Payout account setup

The vendor's only payment-related responsibility is to provide their bank details to AfrolandX.

1. A verified vendor selects a Nigerian bank on AfrolandX.
2. The vendor enters a 10-digit Nigerian bank account number on AfrolandX.
3. The AfrolandX server sends the account number and bank code to Paystack.
4. Paystack resolves and returns the account name.
5. AfrolandX asks Paystack to create a transfer recipient.
6. Paystack returns a recipient code that AfrolandX uses for future settlements.

The vendor does not leave AfrolandX to complete this process and does not manage Paystack.

AfrolandX stores:

- bank code and bank name;
- Paystack-verified account name;
- only the last four digits of the account number;
- Paystack recipient code;
- verification status and date.

AfrolandX does **not** store the full bank account number after setup.

If the vendor changes the payout account, AfrolandX repeats the verification process and replaces the saved masked account and recipient information.

## 9. Settlement process

An administrator can initiate a settlement only when:

- the vendor is approved;
- the vendor verification status is verified;
- the payout account is verified;
- the vendor has ledger entries that are available and not already attached to another settlement; and
- the combined net available amount is greater than zero.

The settlement records:

- vendor and payout-account references;
- gross merchandise amount;
- commission amount;
- net amount sent;
- settlement period;
- approving administrator;
- Paystack transfer code and reference;
- processing, paid, failed, or reversed status;
- payment date or failure reason.

AfrolandX sends the exact net settlement amount to Paystack in NGN. Paystack transfers it from the AfrolandX Paystack balance to the vendor's verified bank account.

## 10. Merchandise refunds

Only an AfrolandX administrator can submit a merchandise refund.

The administrator identifies the paid order, enters the merchandise refund amount and reason, and AfrolandX reserves the adjustment against the remaining refundable merchandise balance before submitting it to Paystack using the original payment reference.

Pending or uncertain refunds remain locked and do not create vendor reversal entries until Paystack confirms processing. Signed refund webhooks finalize or fail the claim. An administrator can also reconcile by original transaction, amount, and AfrolandX adjustment reference; a no-match claim cannot be released until the reconciliation waiting period has elapsed.

For accounting purposes:

- cumulative active refunds and chargebacks cannot exceed the order's merchandise value;
- shipping is not included in this merchandise-refund calculation;
- the refund is allocated proportionally between vendors in a multi-vendor order;
- each affected vendor receives a negative gross ledger entry;
- the related 8% commission is reversed; and
- the negative net entry reduces the vendor's available balance or future earnings.

### Refund example

For a single-vendor merchandise refund of **₦20,000**:

- Gross refund: −₦20,000
- Commission reversal: −₦1,600
- Vendor net adjustment: −₦18,400

The commission reversal means AfrolandX does not retain commission on refunded merchandise.

## 11. Chargebacks

When a chargeback is confirmed, an administrator records:

- the affected order;
- the confirmed chargeback amount;
- the provider or dispute reference; and
- the reason.

The same merchandise limit, multi-vendor allocation, commission reversal, and negative vendor-ledger treatment used for refunds applies to chargebacks.

Chargebacks are currently recorded by an administrator after confirmation. This document should not describe automatic Paystack dispute ingestion unless a dedicated dispute webhook workflow is added.

## 12. Shipping adjustments

Shipping adjustments remain separate from merchandise refunds and vendor settlements.

If a confirmed final shipping amount differs from the amount already paid, the existing shipping-reconciliation process handles:

- an additional shipping balance owed by the customer;
- a shipping refund owed to the customer; or
- a fulfilment hold until the shipping difference is resolved.

Shipping adjustments do not alter the vendor's merchandise commission.

## 13. Access and audit information

### Vendor finance view

A vendor can view:

- pending, available, and settled balance totals;
- masked payout-account information;
- sale, refund, and chargeback statement entries; and
- settlement history.

### Administrator finance view

An administrator can:

- review vendor verification status;
- complete the verification checklist;
- initiate settlement of an eligible positive balance;
- submit a merchandise refund;
- record a confirmed chargeback; and
- review ledger, adjustment, and settlement records.

Financial API responses are marked not to be stored in shared browser caches.

## 14. Important operational conditions

- Paystack must be configured and available.
- The AfrolandX Paystack account must have Transfers enabled.
- The AfrolandX Paystack balance must be sufficient for the settlement.
- Vendor bank details must resolve successfully through Paystack.
- Administrators must verify evidence before marking vendor checks complete.
- Administrators must confirm chargeback information before recording it.
- A Paystack refund or transfer may remain pending until Paystack reports its final status.

## 15. Summary

- Customers pay AfrolandX through Paystack in NGN.
- AfrolandX controls all customer payments, refunds, chargeback accounting, and vendor settlements.
- Vendors only provide fulfilment services, verification information, and bank details.
- Vendors do not need a Paystack account.
- Commission is 8% of merchandise only.
- Earnings become available after delivery.
- Only approved, verified vendors with verified payout accounts can be paid.
- Refunds and chargebacks reverse both vendor earnings and the related commission.
- Shipping remains separate from merchandise commission and vendor earnings.

**AfrolandX — CAC REG: 7039498**

**Email:** info@afrolandx.com