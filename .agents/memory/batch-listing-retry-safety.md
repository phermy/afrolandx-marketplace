---
name: Batch listing retry safety
description: Why batch product creation must treat network retries differently from new submissions
---

Batch listing retries must be idempotent on the server, not just disabled after a successful response in the browser. A retry must return the same listing only when it belongs to the same vendor and still represents the same input and submission state; it must not silently turn a draft into a pending listing or report a draft as submitted.

**Why:** The server may create a product even when the browser never receives the response. Client-only "already saved" flags cannot distinguish that case from a failed request, and a second create would duplicate a listing.

**How to apply:** When adding other batch creation paths, preserve a unique request identity across retry attempts, check ownership and payload compatibility on the server, and keep draft and submitted outcomes distinct. Do not claim an item was submitted merely because an earlier create with the same identity returned successfully.