---
name: Abort timeout tests
description: Reliable testing for hung network requests guarded by AbortSignal.timeout.
---

Node's `AbortSignal.timeout` uses a timer that does not keep the event loop alive. A test whose only pending work is a mocked never-resolving request can end as "cancelled" before the abort fires.

**Why:** A stalled connector test needed a separate referenced timer to let the abort occur. Attaching the rejection assertion only after that timer led to an unhandled-rejection warning.

**How to apply:** In similar timeout tests, attach the rejection assertion immediately and keep the event loop alive with a short referenced timer until the signal fires. This is a test harness concern, not a reason to weaken production timeouts.

Do not assume the tool network sandbox exposes the same globals as workspace Node. `fetch` can be available inside an impure block while `AbortSignal` is unavailable.

**Why:** A timed HTTP probe failed before reaching the service because the sandbox did not expose `AbortSignal`; this was not a service outage.

**How to apply:** Use documented fetch callbacks or workspace Node for HTTP probes requiring native abort timeouts. Keep credential values and full responses out of probe output.