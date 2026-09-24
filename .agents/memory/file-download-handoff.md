---
name: File download handoff
description: Delivering downloadable assets when the workspace UI does not work for this user.
---

Do not rely solely on an asset card or the workspace file menu when the user asks to download an image.

**Why:** The user reported being unable to download an About-page photo both from the presented file card and from the file tree. Those interfaces looked sufficient from the agent side but did not complete the user's request.

**How to apply:** Offer a direct browser link that responds with a real file and `Content-Disposition: attachment`, and verify its response before sharing it. A working HTTP check does not prove the user's browser downloaded it; wait for their confirmation before treating the handoff as resolved.