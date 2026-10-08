---
name: Bot-check access
description: Constraint for any future human verification in Afrolandx.
---

Do not reintroduce a site-wide challenge that can lock legitimate people out of sign-in. If bot checks are added again, use a provider that actually supports the image or sign selection the user requested; do not promise that Cloudflare Turnstile will show image challenges.

**Why:** The Cloudflare hostname configuration caused verification to fail and prevented the user from logging in. The user explicitly preferred removing it over retaining a broken check.

**How to apply:** Verify challenges on the exact preview and published hostnames before making them mandatory. The app screenshot tool browses `127.0.0.1`, not the proxied Replit development hostname; its widget result does not establish whether the real preview hostname is authorized. Cloudflare error 110200 means the current browser hostname is not authorized; its official development test widget can preview the UI but provides no real bot protection. Keep account email verification and existing rate limits independent from any optional bot-check provider.

Cloudflare account connections may list Turnstile widgets yet reject widget updates for lack of edit permission. **Why:** A successful read did not imply an authorized hostname change. **How to apply:** Read back the saved domains after any attempted change; if Cloudflare rejects the write, leave mandatory enforcement off and have a widget editor update Hostname Management directly.

Do not infer that a managed Turnstile widget is broken solely because an automated headless browser leaves it blank. **Why:** After the exact hostname was authorized, automated browsers produced no token or error; the user confirmed the full registration flow, including the human check and email verification, worked in a normal Preview browser without publishing first. **How to apply:** Validate a real browser on the exact hostname before enabling enforcement; still verify the server-side check separately.

Restore real Cloudflare enforcement after registration testing; temporary preview opt-outs are not a launch configuration. **Why:** The user explicitly requested Cloudflare back on while retaining server rate limits. **How to apply:** Check current preview and published hostnames against the actual widget, require server token verification, and leave signup, login, code/reset and chat limits independent of Cloudflare.