#!/usr/bin/env bash
set -euo pipefail

npm ci --prefer-offline --no-audit --no-fund
npm run db:push -- --force
npm run build