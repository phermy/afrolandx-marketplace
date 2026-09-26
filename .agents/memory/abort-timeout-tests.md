---
name: Abort timeout tests
description: Reliable testing for hung network requests guarded by AbortSignal.timeout.
---

Node's `AbortSignal.timeout` uses a timer that does not keep the event loop alive. A test whose only pending work is a mocked never-resolving request can end as "cancelled" before the abort fires.

**Why:** A stalled connector test needed a separate referenced timer to let the abort occur. Attaching the rejection assertion only after that timer led to an unhandled-rejection warning.

**How to apply:** In similar timeout tests, attach the rejection assertion immediately and keep the event loop alive with a short referenced timer until the signal fires. This is a test harness concern, not a reason to weaken production timeouts.