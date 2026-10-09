---
name: Profile photo storage independence
description: Profile photo durability and failure handling when using Cloudflare R2.
---

New profile photos should use Cloudflare R2, with only an image link saved on the account. Preserve existing inline photos and older external image links until the account replaces them.

**Why:** An AWS storage failure blocked profile uploads, and the user chose Cloudflare for features still blocked by AWS. Keeping image bytes outside account JSON also avoids enlarging every account response.

**How to apply:** Verify the uploaded image can be read before saving its link. Failed image or account writes must preserve the previous photo. Cleanup must target only managed R2 images and must not reverse a successful account update; do not delete unrelated or legacy photos.
