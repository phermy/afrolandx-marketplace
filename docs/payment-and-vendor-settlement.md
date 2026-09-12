# AfrolandX Payment and Vendor Settlement Process

**Effective date:** 12 September 2026  
**Currency:** Nigerian Naira (NGN)  
**Marketplace commission:** 8% of merchandise value

## Customer payment

Customers pay AfrolandX through Paystack. The verified payment may contain merchandise and shipping, but the two amounts are accounted for separately. Shipping is a pass-through amount and is not subject to the marketplace commission.

## Vendor earnings

When Paystack confirms an order payment, AfrolandX creates a permanent statement entry for each vendor represented in the order. The entry records:

- the vendor's merchandise value;
- AfrolandX's 8% commission; and
- the net amount payable to the vendor.

Earnings remain pending until the order is delivered. Delivery makes them available for settlement.

## Vendor verification

An administrator must verify the vendor's CAC registration information, identity checks, and business checks before approving the vendor. An unverified vendor cannot be approved for selling or paid.

## Payout accounts and settlements

A verified vendor adds a Nigerian bank account through Paystack. Paystack resolves the account name and creates a transfer recipient. AfrolandX stores only the bank name, account name, last four account digits, and Paystack recipient code; it does not store the full bank account number.

An administrator may settle only a positive available balance. Each settlement groups the included statement entries, sends the exact net amount through Paystack, and records the transfer status and reference. Failed transfers release the entries so they can be retried safely.

## Refunds and chargebacks

Administrators can issue merchandise refunds through Paystack and record confirmed chargebacks. A refund or chargeback:

- cannot exceed the order's remaining merchandise value;
- is allocated proportionally between vendors in a multi-vendor order;
- reverses the corresponding 8% commission; and
- reduces the vendor's available or future settlement balance.

Shipping-price adjustments remain in the separate shipping reconciliation process.

## Statements and access

Vendors can view pending, available, and settled balances together with individual sale, refund, and chargeback entries. Administrators can review verification status, initiate settlements, and view settlement history.

**AfrolandX — CAC REG: 7039498**  
**Email:** info@afrolandx.com