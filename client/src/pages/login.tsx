import { useState } from "react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { AuthShell, authInputClass } from "@/components/auth-shell";

const normalizeEmail = (email: string) => email.trim().toLowerCase();

async function readResponse(response: Response, fallback: string) {
  const text = await response.text();
  let body: { message?: string; hint?: string } = {};
  try { body = JSON.parse(text); } catch { /* use fallback */ }
  return {
    message: typeof body.message === "string" ? body.message : fallback,
    hint: body.hint,
  };
}

export default function LoginPage() {
  const { toast } = useToast();
  const [mode, setMode] = useState<"password" | "code">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [codeEmail, setCodeEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeStep, setCodeStep] = useState<"request" | "verify">("request");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function loginWithPassword(event: React.FormEvent) {
    event.preventDefault();
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !password) {
      setError("Enter your email and password.");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password }),
        credentials: "include",
      });
      if (!response.ok) {
        const result = await readResponse(response, "Email or password is incorrect.");
        if (result.hint === "EMAIL_UNVERIFIED" || /not\s+verified|unverified|verify\s+(your\s+)?email/i.test(result.message)) {
          setCodeEmail(normalizedEmail);
          setCodeStep("request");
          setCode("");
          setMode("code");
          setError("Your email is not verified yet. Use an email code to verify it and sign in.");
          return;
        }
        throw new Error(result.message);
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Welcome back!", description: "You are now signed in." });
      window.location.href = "/";
    } catch (submitError: any) {
      setError(submitError.message || "We couldn't sign you in. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function requestCode(event?: React.FormEvent) {
    event?.preventDefault();
    const normalizedEmail = normalizeEmail(codeEmail);
    if (!normalizedEmail) {
      setError("Enter the email address on your account.");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      const response = await fetch("/api/send-login-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      if (!response.ok) throw new Error((await readResponse(response, "We couldn't send the sign-in code.")).message);
      setCodeEmail(normalizedEmail);
      setCodeStep("verify");
      setCode("");
      toast({ title: "Code sent", description: "Check your email for your 6-digit sign-in code." });
    } catch (submitError: any) {
      setError(submitError.message || "We couldn't send the sign-in code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function resendCode() {
    await requestCode();
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    if (code.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      const response = await fetch("/api/login-with-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizeEmail(codeEmail), otp: code }),
        credentials: "include",
      });
      if (!response.ok) throw new Error((await readResponse(response, "That code is invalid or expired.")).message);
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Welcome!", description: "You are now signed in." });
      window.location.href = "/";
    } catch (submitError: any) {
      setError(submitError.message || "That code is invalid or expired.");
    } finally {
      setIsLoading(false);
    }
  }

  function switchToPassword() {
    setMode("password");
    setError("");
    setCode("");
  }

  function switchToCode() {
    setMode("code");
    setError("");
    setCodeStep("request");
    setCode("");
    if (!codeEmail) setCodeEmail(email);
  }

  const footer = (
    <p className="text-center text-sm text-gray-600">
      Don’t have an account?{" "}
      <Link href="/register" className="font-semibold text-[#087f4f] hover:underline">Create one</Link>
    </p>
  );

  if (mode === "code") {
    return (
      <AuthShell
        title={codeStep === "request" ? "Sign in with a code" : "Enter your sign-in code"}
        description={codeStep === "request" ? "We’ll email you a one-time code. No password needed." : `We sent a 6-digit code to ${codeEmail}.`}
        headerLink={{ href: "/register", label: "Create account" }}
        footer={footer}
      >
        <button type="button" onClick={switchToPassword} className="mb-5 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 focus:outline-none focus:underline">
          <ArrowLeft className="h-4 w-4" /> Back to password login
        </button>
        {error && <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm leading-5 text-red-700" role="alert">{error}</div>}

        {codeStep === "request" ? (
          <form onSubmit={requestCode} className="space-y-5">
            <label className="block text-sm font-medium text-gray-700">
              Email address
              <input
                value={codeEmail}
                onChange={(event) => setCodeEmail(event.target.value)}
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                className={authInputClass}
                autoFocus
                required
              />
            </label>
            <button type="submit" disabled={isLoading} className="flex h-11 w-full items-center justify-center rounded-md bg-[#087f4f] px-4 text-sm font-semibold text-white transition hover:bg-[#06683f] focus:outline-none focus:ring-2 focus:ring-[#087f4f] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending code...</> : "Send sign-in code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="space-y-5">
            <div className="flex justify-center py-2">
              <InputOTP maxLength={6} value={code} onChange={setCode} aria-label="6-digit sign-in code" autoComplete="one-time-code" autoFocus>
                <InputOTPGroup>
                  <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2}
                  /><InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <button type="submit" disabled={isLoading || code.length !== 6} className="flex h-11 w-full items-center justify-center rounded-md bg-[#087f4f] px-4 text-sm font-semibold text-white transition hover:bg-[#06683f] focus:outline-none focus:ring-2 focus:ring-[#087f4f] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...</> : "Verify and sign in"}
            </button>
            <div className="flex items-center justify-between text-sm">
              <button type="button" onClick={() => { setCodeStep("request"); setError(""); }} className="text-gray-500 hover:text-gray-900 hover:underline">Use another email</button>
              <button type="button" onClick={resendCode} disabled={isLoading} className="font-medium text-[#087f4f] hover:underline disabled:opacity-50">Resend code</button>
            </div>
          </form>
        )}
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Log in to Afrolandx"
      description="Welcome back. Enter your details to continue."
      headerLink={{ href: "/register", label: "Create account" }}
      footer={footer}
    >
      {error && <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm leading-5 text-red-700" role="alert">{error}</div>}
      <form onSubmit={loginWithPassword} className="space-y-5">
        <label className="block text-sm font-medium text-gray-700">
          Email address
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            className={authInputClass}
            autoFocus
            data-testid="input-email"
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Password
          <span className="relative block">
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Your password"
              className={`${authInputClass} pr-11`}
               required
              data-testid="input-password"
            />
            <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-gray-400 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#087f4f]" aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </span>
        </label>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm text-[#315cff] hover:underline">Forgot password?</Link>
        </div>
        <button type="submit" disabled={isLoading} className="flex h-11 w-full items-center justify-center rounded-md bg-[#087f4f] px-4 text-sm font-semibold text-white transition hover:bg-[#06683f] focus:outline-none focus:ring-2 focus:ring-[#087f4f] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60" data-testid="button-login">
          {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Logging in...</> : "Log in"}
        </button>
      </form>
      <button type="button" onClick={switchToCode} className="mt-6 flex w-full items-center justify-center gap-2 text-sm font-medium text-gray-500 hover:text-[#087f4f] focus:outline-none focus:underline">
        <KeyRound className="h-4 w-4" /> Use an email sign-in code instead
      </button>
    </AuthShell>
  );
}