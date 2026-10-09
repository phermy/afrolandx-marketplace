---
name: Browser interaction checks
description: Distinguish real browser gestures from synthetic DOM clicks when testing headless UI controls
---

Use real browser keyboard or pointer input to test headless UI controls, and verify their active state before checking the resulting content. A DOM element's `.click()` is not always equivalent to a user gesture.

**Why:** Radix tab triggers activate through mouse-down, keyboard or focus handlers. A synthetic click left the previous panel active and falsely appeared to show missing vendor orders even with correct API fixtures.

**How to apply:** Focus a tab and send Enter, or send a complete pointer gesture through the browser protocol. Assert the selected tab or active panel before judging its contents. Keep browser-only response fixtures clearly distinguished from verification of real authentication.

Wait for the actual control or active panel before interacting with a freshly loaded route; fixed sleeps are not readiness checks.

**Why:** Route splitting introduced variable cold-load times, making otherwise valid homepage and checkout checks fail intermittently before their controls existed.

**How to apply:** Use bounded polling with an explicit assertion and timeout. Maintain accurate response shapes for browser fixtures when newly added profile forms are mounted.

If the testing callback rejects the documented testing configuration as an unknown kind, use the project's headless Chromium/CDP checks rather than retrying that unavailable configuration.

**Why:** The runtime rejected the configuration even though the local testing instructions advertised it.

**How to apply:** Treat this as a conditional capability limitation, not a permanent ban on the tester. Distinguish browser-only fixtures from real account, carrier and payment verification.
