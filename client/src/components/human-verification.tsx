import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Status = { enabled: boolean; siteKey?: string; required?: boolean; nextChallengeAt?: number };
type Turnstile = {
  render: (element: HTMLElement, options: {
    sitekey: string;
    appearance: string;
    callback: (token: string) => void;
    "error-callback": () => void;
    "expired-callback": () => void;
  }) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window { turnstile?: Turnstile }
}

export default function HumanVerification() {
  const [status, setStatus] = useState<Status | null>(null);
  const [snoozedUntil, setSnoozedUntil] = useState(0);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/human-verification/status", {
        credentials: "include",
        cache: "no-store",
      });
      if (response.ok) setStatus(await response.json());
    } catch {
      // Keep the existing prompt if the status check briefly fails.
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(refresh, 30_000);
    const onFocus = () => { if (!document.hidden) void refresh(); };
    const onRequired = () => { setSnoozedUntil(0); void refresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("human-verification-required", onRequired);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("human-verification-required", onRequired);
    };
  }, [refresh]);

  const open = Boolean(status?.enabled && status.required && !document.hidden && Date.now() >= snoozedUntil);

  useEffect(() => {
    if (!open || !status?.siteKey || !containerRef.current) return;
    let cancelled = false;
    const container = containerRef.current;
    const render = () => {
      if (cancelled || !window.turnstile || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(container, {
        sitekey: status.siteKey!,
        appearance: "always",
        callback: async (token) => {
          setChecking(true);
          setError("");
          try {
            const response = await fetch("/api/human-verification/verify", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || "Verification failed. Please try again.");
            setStatus((previous) => previous ? { ...previous, required: false, nextChallengeAt: result.nextChallengeAt } : previous);
          } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Verification failed. Please try again.");
            if (widgetIdRef.current) window.turnstile?.reset(widgetIdRef.current);
          } finally {
            setChecking(false);
          }
        },
        "error-callback": () => { setError("The check could not load. Please try again."); },
        "expired-callback": () => { setError("The check expired. Please try again."); },
      });
    };

    if (window.turnstile) {
      render();
    } else {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = render;
      script.onerror = () => { if (!cancelled) setError("Unable to load the verification check. Please try again later."); };
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
      if (widgetIdRef.current) window.turnstile?.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    };
  }, [open, status?.siteKey]);

  if (!status?.enabled) return null;

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Quick security check</AlertDialogTitle>
          <AlertDialogDescription>
            Please confirm you are not a robot to continue. You can browse without checking now,
            but actions such as checkout will need verification.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div ref={containerRef} className="flex min-h-16 justify-center" aria-label="Human verification check" />
        {checking && <p className="text-sm text-muted-foreground" role="status">Checking your response…</p>}
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setSnoozedUntil(Date.now() + 5 * 60_000)}>
            Not now
          </AlertDialogCancel>
          {error && <AlertDialogAction onClick={() => {
            setError("");
            if (widgetIdRef.current) window.turnstile?.reset(widgetIdRef.current);
            else window.location.reload();
          }}>Try again</AlertDialogAction>}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}