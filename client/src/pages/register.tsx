import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ArrowLeft, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { AuthShell, authButtonClass, authInputClass } from "@/components/auth-shell";

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

type FormState = { name: string; email: string; password: string; confirmPassword: string };

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>({ name: "", email: "", password: "", confirmPassword: "" });
  const [step, setStep] = useState<"form" | "verify">("form");
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [deliveryMessage, setDeliveryMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  async function createAccount(event: React.FormEvent) {
    event.preventDefault();
    const name = form.name.trim();
    const email = normalizeEmail(form.email);
    if (!name || !email || !form.password || !form.confirmPassword) {
      setError("Complete all fields to create your account.");
      return;
    }
    if (form.password.length < 8) {
      setError("Your password must be at least 8 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      const names = name.split(/\s+/);
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: names[0],
          lastName: names.slice(1).join(" "),
          email,
          password: form.password,
        }),
        credentials: "include",
      });
      if (!response.ok) throw new Error(await responseMessage(response, "We couldn't create your account."));
      const result = await response.json().catch(() => ({}));
      setRegisteredEmail(result.email || email);
      setDeliveryMessage(result.emailVerificationSent === false ? result.message || "We couldn't send the verification email yet." : "");
      setCode("");
      setStep("verify");
      toast({
        title: "Account created",
        description: result.emailVerificationSent === false ? "Your account is saved. Try sending the code again." : "Check your email for your verification code.",
        variant: result.emailVerificationSent === false ? "destructive" : "default",
      });
    } catch (submitError: any) {
      setError(submitError.message || "We couldn't create your account. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function verifyEmail(event: React.FormEvent) {
    event.preventDefault();
    if (code.length !== 6) {
      setError("Enter all six digits from the code in your email.");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      const response = await fetch("/api/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: registeredEmail, otp: code }),
        credentials: "include",
      });
      if (!response.ok) throw new Error(await responseMessage(response, "That code is invalid or expired."));
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Email verified", description: "Your account is ready." });
      window.location.href = "/";
    } catch (submitError: any) {
      setError(submitError.message || "That code is invalid or expired.");
    } finally {
      setIsLoading(false);
    }
  }

  async function resendCode(event?: React.MouseEvent) {
    event?.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const response = await fetch("/api/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: registeredEmail }),
      });
      if (!response.ok) throw new Error(await responseMessage(response, "We couldn't send a new code."));
      setDeliveryMessage("");
      toast({ title: "Code sent", description: "Check your email for the new verification code." });
    } catch (submitError: any) {
      setError(submitError.message || "We couldn't send a new code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (step === "verify") {
    return (
      <AuthShell title="Check your email" description={`We sent a verification code to ${registeredEmail}. Enter all six digits below.`} headerLink={{ href: "/login", label: "Log in" }}>
         <button type="button" onClick={() => { setStep("form"); setError(""); }} className="mb-5 inline-flex items-center gap-1 text-sm text-[#6d6d69] hover:text-[#20201f] focus:outline-none focus:underline">
          <ArrowLeft className="h-4 w-4" /> Use a different email
        </button>
         <div className="mb-6 flex items-start gap-3 rounded-[3px] bg-[#f2f8f3] px-3 py-3 text-sm leading-5 text-[#315b3d]">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-700" />
          <span>Verification keeps your account secure. The code expires in 15 minutes.</span>
        </div>
         {deliveryMessage && <div className="mb-5 rounded-[3px] border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm leading-5 text-amber-800" role="alert">{deliveryMessage}</div>}
         {error && <div className="mb-5 rounded-[3px] border border-red-200 bg-red-50 px-3 py-2.5 text-sm leading-5 text-red-700" role="alert">{error}</div>}
        <form onSubmit={verifyEmail} className="space-y-5">
          <div className="flex justify-center py-2">
            <InputOTP maxLength={6} value={code} onChange={setCode} aria-label="Enter the six digits of your verification code" autoComplete="one-time-code" autoFocus>
              <InputOTPGroup>
                <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2}
                /><InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
           <button type="submit" disabled={isLoading || code.length !== 6} className={authButtonClass}>
            {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</> : "Verify email"}
          </button>
           <p className="text-center text-sm text-[#6d6d69]">
            Didn’t get the code?{" "}
             <button type="button" onClick={() => resendCode()} disabled={isLoading} className="font-medium text-[#087f4f] hover:underline disabled:opacity-50">
              Resend code
            </button>
          </p>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your account" description="Shop authentic African fashion, track orders, and more." headerLink={{ href: "/login", label: "Log in" }}>
       {error && <div className="mb-5 rounded-[3px] border border-red-200 bg-red-50 px-3 py-2.5 text-sm leading-5 text-red-700" role="alert">{error}</div>}
      <form onSubmit={createAccount} className="space-y-5">
        <label className="block text-sm font-medium text-[#3c3c39]">
          Full name
          <input value={form.name} onChange={(event) => updateField("name", event.target.value)} type="text" autoComplete="name" placeholder="Your name" className={authInputClass} autoFocus required data-testid="input-name" />
        </label>
        <label className="block text-sm font-medium text-[#3c3c39]">
          Email address
          <input value={form.email} onChange={(event) => updateField("email", event.target.value)} type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" className={authInputClass} required data-testid="input-email" />
        </label>
        <label className="block text-sm font-medium text-[#3c3c39]">
          Password
          <span className="relative block">
            <input value={form.password} onChange={(event) => updateField("password", event.target.value)} type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="At least 8 characters" className={`${authInputClass} pr-11`} minLength={8} required data-testid="input-password" />
             <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-gray-400 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f5a000]" aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </span>
           <span className="mt-1.5 block text-xs font-normal text-[#858581]">Use at least 8 characters.</span>
        </label>
        <label className="block text-sm font-medium text-[#3c3c39]">
          Confirm password
          <span className="relative block">
            <input value={form.confirmPassword} onChange={(event) => updateField("confirmPassword", event.target.value)} type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" placeholder="Enter it again" className={`${authInputClass} pr-11`} minLength={8} required data-testid="input-confirm-password" />
             <button type="button" onClick={() => setShowConfirmPassword((visible) => !visible)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-gray-400 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f5a000]" aria-label={showConfirmPassword ? "Hide password" : "Show password"}>
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </span>
        </label>
        <button type="submit" disabled={isLoading} className={authButtonClass} data-testid="button-register">
          {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account...</> : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}