---
name: Product image durability
description: Production product photos must be stored durably rather than silently saved on a temporary app instance
---

Production product image uploads must fail explicitly if durable cloud storage is unavailable. Local disk is only a development fallback, not a valid substitute for successful production uploads.

**Why:** A vendor may see a successful listing while photos saved on a temporary or separate app instance disappear or become unreachable later. A visible retryable failure is safer than an apparently successful upload with missing customer-facing images.

**How to apply:** Use durable storage for production listing creation and image additions. When it fails, do not record local upload URLs as if the images were published; verify real storage connectivity before claiming production upload readiness.

A configured AWS SDK client is not evidence of working storage. A successful bucket access check is also not evidence that photo writes or public image delivery work.

**Why:** Client construction succeeds without authenticating, and temporary AWS credentials can become invalid independently of application code. Bucket-list access, object-write permission, and public-read permission are distinct. A service key may legitimately lack account-wide bucket listing, so that denial alone must not trigger credential rotation or a request for broad AWS access.

**How to apply:** Label configuration and connection checks separately. Before calling uploads ready, verify a representative image write and retrieval of its returned URL. Refresh temporary access keys, secret keys and session tokens as one matching set through secure secret tooling.

Cloudflare's agent connection and application connector have separate authorization. Reconnecting an agent connection does not necessarily expand its permissions.

**Why:** An agent connection with account and user read scopes could list R2 buckets, but bucket creation remained denied after reconnection. The separate application connector also rejected its supplied credential; an attached connection is not proof of authenticated API access.

**How to apply:** After one failed reconnect retry, stop reconnecting the same authorization. Check the actual scopes and credential type. The Cloudflare application connector uses a Cloudflare REST API bearer token, not an R2 S3 Access Key ID or Secret Access Key. Repair credentials only through the existing integration's secure settings, never through chat.

Cloudflare token verification depends on token ownership: account-owned tokens use the account-specific verification endpoint, while user-owned tokens use the user endpoint.

**Why:** The Account API tokens screen and My Profile API Tokens screen represent different ownership models. Confusing them can make diagnostic checks misleading.

**How to apply:** Use `/accounts/{account_id}/tokens/verify` for an account-owned token and `/user/tokens/verify` for a user-owned token. Still test the actual bucket operation separately. An Active label or successful token verification does not establish object-write permission; a token showing Workers R2 Storage Bucket Item Read cannot upload photos.

Cloudflare token verification errors 6003 with nested 6111 indicate a malformed Authorization header, not a bucket permission failure.

**Why:** An existing, publicly enabled R2 bucket could be inspected through the agent connection while the application connector failed at token verification before bucket authorization.

**How to apply:** Confirm the credential's kind and formatting before further bucket changes or reconnect attempts. Ask only which kind of credential was saved, never its value; do not assume the user supplied the wrong key when the connector's header configuration could also be responsible. Validate a direct request before implementing a secret-based fallback: bypassing the connector does not prove that the saved token will work. If both paths fail, stop asking for blind credential replacements and inspect the credential's source screen with every secret fully redacted.

Confirm the intended bucket's Cloudflare account identity independently of the agent connection and bucket name.

**Why:** A bucket with the expected name was visible through the agent connection, but the user's bucket dashboard showed a different account from the application's configured target. Bucket names alone do not establish account identity.

**How to apply:** Match the intended account, token account resources, bucket and public delivery URL before activating uploads. A mismatched account is separate from malformed authentication; correcting one does not prove the other is fixed. Do not change only the account ID while retaining an unverified delivery URL from another bucket.

The R2 rollout is for new product photos in development, not a replacement for all AWS storage.

**Why:** The user approved development setup while preserving existing AWS images and keeping private documents separate. Enabling a development photo bucket does not authorize migration of existing records or a production rollout.

**How to apply:** Keep non-product uploads on their existing storage, preserve historical image URLs, and require separate approval and production-grade delivery configuration before enabling R2 in production.