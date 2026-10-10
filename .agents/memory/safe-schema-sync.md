---
name: Safe development schema sync
description: Avoid destructive unrelated changes when applying a narrow database constraint
---

Do not accept a broad schema-sync prompt that offers to truncate populated tables to add an unrelated constraint. Inspect the intended diff and existing duplicates before applying any uniqueness rule.

**Why:** A development schema push once paused on a destructive option for an unrelated populated table while applying a narrow uniqueness improvement. Continuing blindly would have deleted unrelated data.

**How to apply:** For a targeted development change blocked by unrelated schema drift, use a narrowly scoped non-destructive development DDL operation and verify the resulting index. Never run production DDL; publish-time schema changes follow the supported deployment flow, and production duplicates must be resolved deliberately rather than deleted.