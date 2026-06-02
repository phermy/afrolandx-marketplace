---
name: Single-session enforcement
description: How one-active-session-per-user is implemented across backend and frontend.
---

## Rule
Only one session per user is allowed at a time. A new login immediately invalidates (kicks out) any previous session.

## How it works

**Backend (`shared/schema.ts`):**
- `users.activeSessionId varchar` — stores the session ID of the current valid session.

**Backend (`server/storage.ts`):**
- `updateActiveSession(userId, sessionId | null)` — writes the value.

**Backend (`server/auth.ts`):**
- `finalizeLogin(req, res, user, onSuccess)` — helper called by all 3 login paths (password, OTP, email-verify). Calls `req.login` then writes `req.sessionID` to `activeSessionId`.
- `isAuthenticated` middleware — after passport check, compares `req.user.activeSessionId` against `req.sessionID`. If mismatch → 401 `{ message: "SESSION_SUPERSEDED" }`.
- Logout clears `activeSessionId` to null.

**Frontend (`client/src/lib/queryClient.ts`):**
- `throwIfResNotOk` detects `SESSION_SUPERSEDED` in any 401 response body → dispatches `window.CustomEvent("session-superseded")`.

**Frontend (`client/src/hooks/useAuth.ts`):**
- Polls `/api/auth/user` every 60 s (`refetchInterval: 60000`).
- Detects `SESSION_SUPERSEDED` in auth poll response → dispatches the same event.

**Frontend (`client/src/App.tsx`):**
- `SessionKickoutGuard` component listens for `session-superseded` event → clears React Query auth cache, shows destructive toast ("You were signed in on another device"), redirects to `/login`.

**Why:**
- Prevents concurrent sessions (security + subscription enforcement).
- Session check is free — `req.user` is already hydrated by passport's `deserializeUser` on every request; no extra DB call needed.

**How to apply:**
- Any new login endpoint must use `finalizeLogin` instead of `req.login` directly.
- `isAuthenticated` already enforces the check automatically for all protected routes.
