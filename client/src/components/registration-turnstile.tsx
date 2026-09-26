import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window { turnstile?: TurnstileApi }
}

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export function RegistrationTurnstile({
  siteKey,
  onToken,
  resetNonce,
}: {
  siteKey: string;
  onToken: (token: string) => void;
  resetNonce: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const [error, setError] = useState("");
  onTokenRef.current = onToken;

  useEffect(() => {
    let cancelled = false;
    let script = document.querySelector<HTMLScriptElement>('script[data-registration-turnstile]');
    const render = () => {
      if (cancelled || !container.current || !window.turnstile || widgetId.current !== null) return;
      try {
        widgetId.current = window.turnstile.render(container.current, {
          sitekey: siteKey,
          theme: "light",
          size: "flexible",
          callback: (token: string) => { setError(""); onTokenRef.current(token); },
          "expired-callback": () => { onTokenRef.current(""); setError("Security check expired. Please complete it again."); },
          "error-callback": () => { onTokenRef.current(""); setError("Security check could not load. Please refresh and try again."); },
        });
      } catch {
        setError("Security check could not load. Please refresh and try again.");
      }
    };
    const onLoad = () => render();
    const onScriptError = () => { if (!cancelled) setError("Security check could not load. Please refresh and try again."); };
    if (!script) {
      script = document.createElement("script");
      script.src = SCRIPT_URL;
      script.async = true;
      script.dataset.registrationTurnstile = "true";
      document.head.appendChild(script);
    }
    if (window.turnstile) render();
    else {
      script.addEventListener("load", onLoad);
      script.addEventListener("error", onScriptError);
    }
    return () => {
      cancelled = true;
      script?.removeEventListener("load", onLoad);
      script?.removeEventListener("error", onScriptError);
      if (widgetId.current !== null) {
        window.turnstile?.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetNonce && widgetId.current !== null) {
      onTokenRef.current("");
      window.turnstile?.reset(widgetId.current);
    }
  }, [resetNonce]);

  return (
    <div aria-label="Security check">
      <div ref={container} className="min-h-[65px]" />
      {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}