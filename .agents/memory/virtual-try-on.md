---
name: Virtual try-on scope and privacy
description: Distinguish clothing photo previews from live AR and keep customer photos ephemeral.
---

Photo-based clothing previews should be called AfrolandX Virtual Try-On, not live AR. Reserve “Try it on with AR” for a separate camera-tracked experience with suitable 3D assets.

**Why:** The existing product catalog consists of photos, not the tracked garment models needed for reliable real-time AR. A visual preview is also not a sizing guarantee, and shoppers' photos are sensitive.

**How to apply:** Only offer previews for suitable approved products; require explicit consent before sending photos to an external processor. Do not persist uploads or generated images on the app server by default. Disclose the provider's temporary retention accurately and let shoppers download a preview explicitly if they want to keep it.

The connected Replicate proxy limits inline file data URLs to 256 KB including base64 overhead. Compress the shopper's photo in memory under that bound before prediction, rather than persisting it to a temporary app-hosted URL.

**Why:** A normal phone photo exceeds that connector limit, but uploading it to app-controlled storage would break the default no-storage promise.

**How to apply:** Keep any future model/provider switch compatible with an in-memory upload and explicitly verify the external service's retention and input limits before enabling it.

Connecting the image provider does not establish that predictions can run; an authorized account may still reject requests for insufficient credit.

**Why:** A successful model metadata request is not a paid inference readiness check. Showing Try-On prematurely would lead shoppers into a failing upload flow.

**How to apply:** Keep the shopper entry point behind a release flag until a real preview using non-personal sample images succeeds, then enable it.