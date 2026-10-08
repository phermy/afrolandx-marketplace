---
name: Browser interaction checks
description: Distinguish real browser gestures from synthetic DOM clicks when testing headless UI controls
---

Use real browser keyboard or pointer input to test headless UI controls, and verify their active state before checking the resulting content. A DOM element's `.click()` is not always equivalent to a user gesture.

**Why:** Radix tab triggers activate through mouse-down, keyboard or focus handlers. A synthetic click left the previous panel active and falsely appeared to show missing vendor orders even with correct API fixtures.

**How to apply:** Focus a tab and send Enter, or send a complete pointer gesture through the browser protocol. Assert the selected tab or active panel before judging its contents. Keep browser-only response fixtures clearly distinguished from verification of real authentication.
