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

For server-rendered public routes, an existing heading is not proof that React has mounted. Wait for the actual interactive component or its new state before asserting client navigation.

**Why:** A homepage check repeatedly inspected the server-rendered fallback before the redesigned client header and hero loaded, reporting missing links that were present after mounting.

**How to apply:** Anchor readiness checks inside the client root and assert the specific heading/control under test rather than any document heading.

Raw browser-protocol Enter input must include the character event for a native form submission, not only key-down and key-up.

**Why:** Trusted key-down reached the focused search input but did not perform native form submission until a carriage-return character event was sent.

**How to apply:** Send the complete key sequence and assert the resulting URL; do not treat a missing character event as an application search failure.

If the testing callback rejects the documented testing configuration as an unknown kind, use the project's headless Chromium/CDP checks rather than retrying that unavailable configuration.

**Why:** The runtime rejected the configuration even though the local testing instructions advertised it.

**How to apply:** Treat this as a conditional capability limitation, not a permanent ban on the tester. Distinguish browser-only fixtures from real account, carrier and payment verification.
