import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ArrowLeft, CheckCircle, Loader2 } from "lucide-react";
import { AuthShell, authInputClass } from "@/components/auth-shell";

const normalizeEmail = (email: string) => email.trim().toLowerCase();

async function responseMessage(response: Response, fallback: string) {
  const text = await response.text();
  try {
    const body = JSON.parse(text);
    return typeof body?.message === "string" ? body.message : fallback;
  } catch {
    return fallback;
  }
}

export default function ForgotPasswordPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<"email" | "code" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function requestReset(event: React.FormEvent) {
    event.preventDefault();
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      setError("Enter the email address on your account.");
      return;
    }
    setEmail(normalizedEmail);
    setError("");
    setIsLoading(true);
    try {
      const response = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      if (!response.ok) throw new Error(await responseMessage(response, "We couldn't send a reset code."));
      setStep("code");
      toast({ title: "Check your email", description: "If that email is registered, a reset code will arrive shortly." });
    } catch (submitError: any) {
      setError(submitError.message || "We couldn't send a reset code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function resetPassword(event: React.FormEvent) {
    event.preventDefault();
    if (code.length !== 6) {
      setError("Enter all six digits from the code in your email.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Your new password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      const response = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: code, newPassword }),
      });
      if (!response.ok) throw new Error(await responseMessage(response, "That code is invalid or expired."));
      setStep("done");
    } catch (submitError: any) {
      setError(submitError.message || "That code is invalid or expired.");
    } finally {
      setIsLoading(false);
    }
  }

  async function resendCode() {
    setError("");
    setIsLoading(true);
    try {
      const response = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error(await responseMessage(response, "We couldn't resend the reset code."));
      toast({ title: "Code requested", description: "If your email is registered, a new code will arrive shortly." });
    } catch (submitError: any) {
      setError(submitError.message || "We couldn't resend the code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (step === "done") {
    return (
      <AuthShell title="Password updated" description="Your password has been changed successfully." headerLink={{ href: "/login", label: "Log in" }}>
        <div className="text-center">
          <CheckCircle className="mx-auto h-14 w-14 text-green-600" />
          <p className="mt-4 text-sm text-gray-600">You can now sign in with your new password.</p>
          <button type="button" onClick={() => setLocation("/login")} className="mt-6 flex h-11 w-full items-center justify-center rounded-md bg-[#087f4f] px-4 text-sm font-semibold text-white transition hover:bg-[#06683f] focus:outline-none focus:ring-2 focus:ring-[#087f4f] focus:ring-offset-2">
            Go to sign in
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={step === "email" ? "Reset your password" : "Create a new password"}
      description={step === "email" ? "Enter your email and we’ll send a reset code." : `Enter the code sent to ${email}, then choose a new password.`}
      headerLink={{ href: "/login", label: "Log in" }}
    >
      <Link href="/login" className="mb-5 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 focus:outline-none focus:underline">
        <ArrowLeft className="h-4 w-4" /> Back to login
      </Link>
      {error && <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm leading-5 text-red-700" role="alert">{error}</div>}
      {step === "email" ? (
        <form onSubmit={requestReset} className="space-y-5">
          <label className="block text-sm font-medium text-gray-700">
            Email address
            <input value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" className={authInputClass} autoFocus required />
          </label>
          <button type="submit" disabled={isLoading} className="flex h-11 w-full items-center justify-center rounded-md bg-[#087f4f] px-4 text-sm font-semibold text-white transition hover:bg-[#06683f] focus:outline-none focus:ring-2 focus:ring-[#087f4f] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
            {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending code...</> : "Send reset code"}
          </button>
        </form>
      ) : (
        <form onSubmit={resetPassword} className="space-y-5">
          <div className="flex justify-center py-1">
            <InputOTP maxLength={6} value={code} onChange={setCode} aria-label="Enter the six digits of your password reset code" autoComplete="one-time-code" autoFocus required>
              <InputOTPGroup>
                <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2}
                /><InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <label className="block text-sm font-medium text-gray-700">
            New password
            <input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} type="password" autoComplete="new-password" placeholder="At least 8 characters" className={authInputClass} minLength={8} required />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Confirm new password
            <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" autoComplete="new-password" placeholder="Enter it again" className={authInputClass} minLength={8} required />
          </label>
          <button type="submit" disabled={isLoading || code.length !== 6} className="flex h-11 w-full items-center justify-center rounded-md bg-[#087f4f] px-4 text-sm font-semibold text-white transition hover:bg-[#06683f] focus:outline-none focus:ring-2 focus:ring-[#087f4f] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
            {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating password...</> : "Update password"}
          </button>
          <p className="text-center text-sm text-gray-500">
            Didn’t get the code?{" "}
            <button type="button" onClick={resendCode} disabled={isLoading} className="font-medium text-[#087f4f] hover:underline disabled:opacity-50">Resend code</button>
          </p>
        </form>
      )}
    </AuthShell>
  );
}