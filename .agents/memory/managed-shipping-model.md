---
name: Managed shipping model
description: The user's chosen shipping responsibility model and phased operating scope.
---

The user chose Afrolandx managed shipping: the customer pays Afrolandx, Afrolandx arranges and pays the agency, the vendor prepares and hands over the package, and an approved shipping partner confirms collection and delivery. Partner access is invitation only and limited to assigned shipments.

**Why:** The user asked to implement the recommended model so customers have one place for payment, tracking, and help instead of separate vendor delivery arrangements.

**How to apply:** Retain central Afrolandx oversight with full shipping access for verified Admins and package level tracking, including separate packages from the same vendor when necessary. The user subsequently delegated full shipping operations to Admins, not only Superadmins. The initial operating phase uses manual bookings and records of payments already made. Add carrier automation only after a specific carrier and genuine booking and tracking access are confirmed; never present manual updates as live carrier integration or a payment record as an actual transfer.

The user chose Shipbubble as the primary shipping provider and Terminal Africa as the backup, rather than replacing Terminal Africa.

**Why:** The user requested one primary provider and one backup after discussing both services.

**How to apply:** Prefer verified live Shipbubble access; use Terminal Africa as backup only with verified live access. Keep manual confirmation when neither is available. Failover of read operations must not imply permission to retry paid bookings with another provider: a lost booking response can conceal a successful charge.
