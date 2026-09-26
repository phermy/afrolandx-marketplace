---
name: Product image durability
description: Production product photos must be stored durably rather than silently saved on a temporary app instance
---

Production product image uploads must fail explicitly if durable cloud storage is unavailable. Local disk is only a development fallback, not a valid substitute for successful production uploads.

**Why:** A vendor may see a successful listing while photos saved on a temporary or separate app instance disappear or become unreachable later. A visible retryable failure is safer than an apparently successful upload with missing customer-facing images.

**How to apply:** Use durable storage for production listing creation and image additions. When it fails, do not record local upload URLs as if the images were published; verify real storage connectivity before claiming production upload readiness.