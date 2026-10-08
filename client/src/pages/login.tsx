import { useState } from "react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2, Mail } from "lucide-react";
import { AuthShell, authButtonClass, authInputClass } from "@/components/auth-shell";

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
  const [mode, setMode] = useState<"choice" | "password" | "code">("choice");
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
      const result = await response.json();
      const returnTo = new URLSearchParams(window.location.search).get("returnTo");
      window.location.href = returnTo?.startsWith("/") && !returnTo.startsWith("//") && !/[\\\u0000-\u0020]/.test(returnTo)
        ? returnTo : result.user?.signupIntent === "vendor" ? "/vendor" : "/";
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
      if (!response.ok) throw new Error((await readResponse(response, "We couldn't send the code to sign in.")).message);
      setCodeEmail(normalizedEmail);
      setCodeStep("verify");
      setCode("");
      toast({ title: "Code sent", description: "Check your email for the code." });
    } catch (submitError: any) {
      setError(submitError.message || "We couldn't send the code to sign in. Please try again.");
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
      setError("Enter all six digits from the code in your email.");
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
      const result = await response.json();
      const returnTo = new URLSearchParams(window.location.search).get("returnTo");
      window.location.href = returnTo?.startsWith("/") && !returnTo.startsWith("//") && !/[\\\u0000-\u0020]/.test(returnTo)
        ? returnTo : result.user?.signupIntent === "vendor" ? "/vendor" : "/";
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

  function switchToChoice() {
    setMode("choice");
    setError("");
    setCode("");
  }

  if (mode === "choice") {
    return (
      <AuthShell
        title="Log in to Afrolandx"
        description="Choose how you’d like to sign in."
        layout="center"
      >
        <div className="space-y-3">
          <button type="button" onClick={switchToPassword}
            className="flex w-full items-center justify-center gap-3 rounded-md border border-[#dedbd4] bg-white px-4 py-3 text-sm font-medium text-[#20201f] transition hover:border-[#087f4f] hover:bg-[#f6faf7] focus:outline-none focus:ring-2 focus:ring-[#087f4f] focus:ring-offset-2">
            <Mail className="h-5 w-5" aria-hidden="true" />
            Continue with email and password
          </button>
          <button type="button" onClick={switchToCode}
            className="flex w-full items-center justify-center gap-3 rounded-md border border-[#dedbd4] bg-white px-4 py-3 text-sm font-medium text-[#20201f] transition hover:border-[#087f4f] hover:bg-[#f6faf7] focus:outline-none focus:ring-2 focus:ring-[#087f4f] focus:ring-offset-2">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
            Continue with an email code
          </button>
        </div>
        <p className="mt-6 text-center text-sm text-[#6d6d69]">
          New to Afrolandx? <Link href="/register" className="font-medium text-[#087f4f] hover:underline">Create an account</Link>
        </p>
      </AuthShell>
    );
  }

  if (mode === "code") {
    return (
      <AuthShell
        title={codeStep === "request" ? "Sign in with a code" : "Enter your code to sign in"}
        description={codeStep === "request" ? "We’ll email you a code that works once, so you won’t need a password." : `We sent a code to ${codeEmail}. Enter all six digits below.`}
        layout="center"
      >
         <button type="button" onClick={switchToChoice} className="mb-5 inline-flex items-center gap-1 text-sm text-[#6d6d69] hover:text-[#20201f] focus:outline-none focus:underline">
           <ArrowLeft className="h-4 w-4" /> Back to sign-in choices
        </button>
         {error && <div className="mb-5 rounded-[3px] border border-red-200 bg-red-50 px-3 py-2.5 text-sm leading-5 text-red-700" role="alert">{error}</div>}

        {codeStep === "request" ? (
          <form onSubmit={requestCode} className="space-y-5">
            <label className="block text-sm font-medium text-[#3c3c39]">
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
            <button type="submit" disabled={isLoading} className={authButtonClass}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending code...</> : "Send code to sign in"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="space-y-5">
            <div className="flex justify-center py-2">
              <InputOTP maxLength={6} value={code} onChange={setCode} aria-label="Enter the six digits of your code to sign in" autoComplete="one-time-code" autoFocus>
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
               <button type="button" onClick={() => { setCodeStep("request"); setError(""); }} className="text-[#6d6d69] hover:text-[#20201f] hover:underline">Use a different email address</button>
               <button type="button" onClick={resendCode} disabled={isLoading} className="font-medium text-[#087f4f] hover:underline disabled:opacity-50">Resend code</button>
            </div>
          </form>
        )}
      </AuthShell>
    );
  }

  return (
    <AuthShell
       title="Log in to your account"
       description="Welcome back. Enter your details to continue."
       layout="center"
    >
       <button type="button" onClick={switchToChoice} className="mb-5 inline-flex items-center gap-1 text-sm text-[#6d6d69] hover:text-[#20201f] focus:outline-none focus:underline">
         <ArrowLeft className="h-4 w-4" /> Back to sign-in choices
       </button>
       {error && <div className="mb-5 rounded-[3px] border border-red-200 bg-red-50 px-3 py-2.5 text-sm leading-5 text-red-700" role="alert">{error}</div>}
      <form onSubmit={loginWithPassword} className="space-y-5">
        <label className="block text-sm font-medium text-[#3c3c39]">
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
        <label className="block text-sm font-medium text-[#3c3c39]">
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
             <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-gray-400 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f5a000]" aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </span>
        </label>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm text-[#315cff] hover:underline">Forgot password?</Link>
        </div>
        <button type="submit" disabled={isLoading} className={authButtonClass} data-testid="button-login">
          {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Logging in...</> : "Log in"}
        </button>
      </form>
      <button type="button" onClick={switchToCode} className="mt-6 flex w-full items-center justify-center gap-2 text-sm font-medium text-[#6d6d69] hover:text-[#087f4f] focus:outline-none focus:underline">
        <KeyRound className="h-4 w-4" /> Use an email code to sign in instead
      </button>
    </AuthShell>
  );
}