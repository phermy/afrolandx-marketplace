import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ArrowLeft, ArrowUpRight, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { RegistrationTurnstile } from "@/components/registration-turnstile";
import logoImage from "@assets/Group 1000002646_1749631956471.png";
import { normalizeAccountPhone } from "@shared/account-registration";

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

type FormState = { name: string; email: string; phone: string; password: string; confirmPassword: string };

function BrandPanel() {
  return (
    <aside className="relative isolate flex min-h-[260px] flex-col overflow-hidden bg-[#183b35] px-6 py-7 text-[#f4eedf] sm:px-10 sm:py-9 lg:min-h-screen lg:w-[47%] lg:px-[clamp(2.5rem,6vw,6.5rem)] lg:py-10">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_17%_0%,rgba(217,157,75,.18),transparent_42%),linear-gradient(145deg,#183b35_0%,#12332f_58%,#102b29_100%)]" />
        <svg className="absolute -bottom-44 -left-16 hidden h-[77%] min-h-[360px] w-[118%] opacity-95 lg:block" viewBox="0 0 820 620" fill="none" preserveAspectRatio="xMidYMax slice">
          <path d="M-40 598C106 501 204 487 276 382C361 258 356 149 470 134C580 120 595 235 851 254V650H-40V598Z" fill="#D98B55" />
          <path d="M-48 608C105 516 209 499 291 391C373 283 373 177 478 164C594 150 615 267 856 279V650H-48V608Z" fill="#E9B65E" />
          <path d="M-58 622C108 533 216 516 306 405C394 296 389 197 491 192C606 186 635 298 866 306V650H-58V622Z" fill="#C6533D" />
          <path d="M-67 636C113 550 225 531 322 419C416 309 410 218 503 220C623 223 650 325 876 333V650H-67V636Z" fill="#347C62" />
          <path d="M-74 650C119 566 234 546 337 433C434 326 428 240 516 247C641 257 665 352 887 359V650H-74Z" fill="#E8C985" />
          <path d="M-55 650C132 581 251 559 355 450C453 347 448 268 531 278C659 293 681 382 899 386V650H-55Z" fill="#B84E3D" />
          <path d="M-19 650C153 596 270 576 375 470C473 372 470 298 552 309C680 327 700 411 920 412V650H-19Z" fill="#E5A34E" />
          <path d="M23 650C180 610 295 592 399 491C494 399 494 330 571 342C697 361 719 442 938 441V650H23Z" fill="#2C6956" />
          <path d="M70 650C207 625 318 610 423 513C516 427 518 364 591 376C714 397 738 472 956 470V650H70Z" fill="#E7C37B" />
          <path d="M122 650C239 640 344 629 449 535C537 457 545 396 610 410C730 436 760 504 974 500V650H122Z" fill="#C85E43" />
          <path d="M180 650C276 652 372 646 474 561C557 492 569 434 628 448C746 476 780 536 993 532V650H180Z" fill="#1E5148" />
          <g opacity=".22" stroke="#F6E7C9" strokeWidth="1">
            <path d="M32 617C177 554 256 532 338 431" /><path d="M62 634C199 576 281 553 365 454" />
            <path d="M102 647C226 598 306 574 392 477" /><path d="M153 655C255 618 333 591 421 500" />
          </g>
        </svg>
        <div className="absolute inset-0 opacity-[.11]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 48 48' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M24 0 48 24 24 48 0 24Z' fill='none' stroke='%23f3dfb4' stroke-width='1'/%3E%3Cpath d='M24 10 38 24 24 38 10 24Z' fill='none' stroke='%23f3dfb4' stroke-width='1'/%3E%3C/svg%3E\")", backgroundSize: "48px 48px" }} />
      </div>

      <Link href="/" className="relative z-10 inline-flex w-fit items-center gap-3 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e8bb6b]" aria-label="Afrolandx home">
        <img src={logoImage} alt="" className="h-9 w-9 object-contain sm:h-10 sm:w-10" />
        <span className="font-['Space_Grotesk'] text-[1.3rem] font-semibold tracking-[-.045em] text-[#fbf5e8]">Afrolandx</span>
      </Link>

      <div className="relative z-10 mt-10 max-w-[36rem] pb-4 lg:mt-[clamp(4rem,13vh,9rem)]">
        <p className="mb-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-[.16em] text-[#f3ce91]">
          <span className="h-px w-8 bg-[#e6bb72]" /> Made of many stories
        </p>
        <h2 className="max-w-[34rem] font-['Space_Grotesk'] text-[clamp(2.15rem,4.4vw,4.25rem)] font-semibold leading-[1.04] tracking-[-.055em] text-[#fbf5e8]">
          African creativity,<br className="hidden lg:block" /> closer to you.
        </h2>
        <p className="mt-5 max-w-[31rem] text-[1.0625rem] leading-8 text-[#f5f2e9] sm:text-lg sm:leading-8">
          Discover authentic fashion, craftsmanship and the stories behind them. Join a marketplace connecting African makers with the world.
        </p>
      </div>

      <div className="relative z-10 mt-auto hidden items-center justify-between border-t border-[#e8e3d3]/30 pt-5 text-xs tracking-[.08em] text-[#f5f2e9] lg:flex">
        <span>AN OPEN DOOR TO AFRICAN CRAFT</span>
        <span className="flex items-center gap-2">Explore with us <ArrowUpRight className="h-3.5 w-3.5 text-[#e6bb72]" /></span>
      </div>
    </aside>
  );
}

export default function RegisterPage() {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>({ name: "", email: "", phone: "", password: "", confirmPassword: "" });
  const [signupIntent, setSignupIntent] = useState<"customer" | "vendor">(
    new URLSearchParams(window.location.search).get("as") === "vendor" ? "vendor" : "customer",
  );
  const [step, setStep] = useState<"form" | "verify">("form");
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [deliveryMessage, setDeliveryMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [turnstileConfig, setTurnstileConfig] = useState<{ enabled: boolean; siteKey: string | null; testMode: boolean } | null>(null);
  const [turnstileError, setTurnstileError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetNonce, setTurnstileResetNonce] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/turnstile-config", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("The security check is temporarily unavailable. Please try again later.");
        return response.json();
      })
      .then(config => { if (active) setTurnstileConfig(config); })
      .catch(() => { if (active) setTurnstileError("The security check is temporarily unavailable. Please refresh and try again."); });
    return () => { active = false; };
  }, []);

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  async function createAccount(event: React.FormEvent) {
    event.preventDefault();
    const name = form.name.trim();
    const email = normalizeEmail(form.email);
    const phone = normalizeAccountPhone(form.phone);
    if (!phone) {
      setError("Enter a valid phone number with 7 to 15 digits.");
      return;
    }
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
    if (!turnstileConfig || turnstileError || (turnstileConfig.enabled && !turnstileToken)) {
      setError("Complete the security check before creating your account.");
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
          phone,
          signupIntent,
          password: form.password,
          ...(turnstileConfig.enabled ? { turnstileToken } : {}),
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
      if (turnstileConfig.enabled) setTurnstileResetNonce(nonce => nonce + 1);
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
      const result = await response.json();
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Email verified", description: "Your account is ready." });
      window.location.href = (result.user?.signupIntent ?? signupIntent) === "vendor" ? "/vendor" : "/";
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

  const inputClass = "mt-2 h-[50px] w-full rounded-[4px] border border-[#cbd5cd] bg-white px-3.5 text-base text-[#1d2e28] outline-none transition placeholder:text-[#637269] hover:border-[#9aa89d] focus:border-[#236c53] focus:ring-4 focus:ring-[#236c53]/10";
  const buttonClass = "flex h-[50px] w-full items-center justify-center rounded-[4px] bg-[#d99b48] px-4 text-base font-semibold text-[#172e27] transition-colors hover:bg-[#e5aa5b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#236c53] disabled:cursor-not-allowed disabled:opacity-55";

  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-[#f7f8f5] text-left lg:flex">
      <BrandPanel />
      <section className="flex min-w-0 flex-1 flex-col bg-[#fbfcfa]">
        <div className="mx-auto flex w-full max-w-[620px] flex-1 flex-col px-5 pb-8 pt-5 sm:px-9 sm:pb-10 sm:pt-8 lg:max-w-[670px] lg:justify-center lg:px-[clamp(2.5rem,6vw,6.5rem)] lg:py-12">
          {step === "form" ? (
            <>
              <div className="mt-9 flex items-center justify-between gap-4 lg:mt-0">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[.14em] text-[#8b542d]">Your next chapter</p>
                  <h1 className="font-['Space_Grotesk'] text-[2rem] font-semibold leading-tight tracking-[-.045em] text-[#183b35] sm:text-[2.25rem]">{signupIntent === "vendor" ? "Create your vendor account" : "Create your account"}</h1>
                  <p className="mt-2 text-base leading-6 text-[#41564b]">{signupIntent === "vendor" ? "Verify your email, then complete your business application. Selling requires admin approval." : "A world of considered African craft, just ahead."}</p>
                </div>
                <p className="hidden shrink-0 text-sm text-[#46574c] sm:block">
                  Already have an account?{" "}
                  <Link href="/login" className="font-semibold text-[#236c53] underline decoration-[#236c53]/35 underline-offset-4 hover:decoration-[#236c53] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#236c53]">Log in</Link>
                </p>
              </div>

              <div className="mt-7 border-t border-[#e7ebe5] pt-6 sm:mt-8 sm:pt-7">
                {error && <div className="mb-5 rounded-[4px] border border-[#ecc7c0] bg-[#fff5f2] px-3.5 py-3 text-sm leading-5 text-[#a43e31]" role="alert">{error}</div>}
                <form onSubmit={createAccount} className="space-y-[17px]">
                  <label className="block text-[15px] font-semibold text-[#33473e]">
                    I want to
                    <select className={inputClass} value={signupIntent} onChange={event => setSignupIntent(event.target.value as "customer" | "vendor")} data-testid="select-signup-intent">
                      <option value="customer">Shop as a customer</option>
                      <option value="vendor">Sell as a vendor</option>
                    </select>
                  </label>
                  <label className="block text-[15px] font-semibold text-[#33473e]">
                    Full name
                    <input value={form.name} onChange={(event) => updateField("name", event.target.value)} type="text" autoComplete="name" placeholder="Your name" className={inputClass} autoFocus required data-testid="input-name" />
                  </label>
                  <label className="block text-[15px] font-semibold text-[#33473e]">
                    Email address
                    <input value={form.email} onChange={(event) => updateField("email", event.target.value)} type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" className={inputClass} required data-testid="input-email" />
                  </label>
                  <label className="block text-[15px] font-semibold text-[#33473e]">
                    Phone number
                    <input value={form.phone} onChange={event => updateField("phone", event.target.value)} type="tel" autoComplete="tel" placeholder="+234 800 000 0000" maxLength={30} className={inputClass} required data-testid="input-phone" />
                    <span className="mt-1.5 block text-[13px] font-normal text-[#53655a]">Include your country code for an international number.</span>
                  </label>
                  <label className="block text-[15px] font-semibold text-[#33473e]">
                    Password
                    <span className="relative block">
                      <input value={form.password} onChange={(event) => updateField("password", event.target.value)} type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="At least 8 characters" className={`${inputClass} pr-12`} minLength={8} required data-testid="input-password" />
                      <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-2 text-[#849087] hover:text-[#183b35] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#236c53]" aria-label={showPassword ? "Hide password" : "Show password"}>
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </span>
                    <span className="mt-1.5 block text-[13px] font-normal text-[#53655a]">Use at least 8 characters.</span>
                  </label>
                  <label className="block text-[15px] font-semibold text-[#33473e]">
                    Confirm password
                    <span className="relative block">
                      <input value={form.confirmPassword} onChange={(event) => updateField("confirmPassword", event.target.value)} type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" placeholder="Enter it again" className={`${inputClass} pr-12`} minLength={8} required data-testid="input-confirm-password" />
                      <button type="button" onClick={() => setShowConfirmPassword((visible) => !visible)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-2 text-[#849087] hover:text-[#183b35] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#236c53]" aria-label={showConfirmPassword ? "Hide password" : "Show password"}>
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </span>
                  </label>
                  {turnstileError && <p role="alert" className="text-sm text-[#a43e31]">{turnstileError}</p>}
                  {turnstileConfig?.enabled && turnstileConfig.siteKey && (
                    <>
                      <RegistrationTurnstile siteKey={turnstileConfig.siteKey} onToken={setTurnstileToken} resetNonce={turnstileResetNonce} />
                      {turnstileConfig.testMode && <p className="text-xs text-[#70706d]">Preview security check: test mode, not live bot protection.</p>}
                    </>
                  )}
                  <button type="submit" disabled={isLoading || !turnstileConfig || Boolean(turnstileError) || (turnstileConfig.enabled && !turnstileToken)} className={buttonClass} data-testid="button-register">
                    {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account...</> : "Create account"}
                  </button>
                </form>
                <p className="mt-5 text-center text-sm text-[#46574c] sm:hidden">
                  Already have an account? <Link href="/login" className="font-semibold text-[#236c53] underline underline-offset-4">Log in</Link>
                </p>
              </div>
              <p className="mt-auto hidden pt-8 text-[13px] leading-5 text-[#53655a] lg:block">By creating an account, you’ll be part of a community for makers and curious shoppers alike.</p>
            </>
          ) : (
            <div className="mt-9 lg:mt-0">
              <button type="button" onClick={() => { setStep("form"); setError(""); }} className="mb-7 inline-flex items-center gap-2 text-[13px] font-medium text-[#68756e] transition-colors hover:text-[#183b35] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#236c53]">
                <ArrowLeft className="h-4 w-4" /> Use a different email
              </button>
              <p className="mb-2 text-xs font-bold uppercase tracking-[.14em] text-[#8b542d]">One last step</p>
              <h1 className="font-['Space_Grotesk'] text-[2rem] font-semibold leading-tight tracking-[-.045em] text-[#183b35] sm:text-[2.25rem]">Check your email</h1>
              <p className="mt-2 text-base leading-6 text-[#41564b]">We sent a verification code to <strong className="break-all font-semibold text-[#33473e]">{registeredEmail}</strong>. Enter all six digits below.</p>
              <div className="mb-6 mt-6 flex items-start gap-3 rounded-[4px] border border-[#dce8dd] bg-[#f2f7f0] px-3.5 py-3 text-[13px] leading-5 text-[#42664c]">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#34734d]" />
                <span>Verification keeps your account secure. The code expires in 15 minutes.</span>
              </div>
              {deliveryMessage && <div className="mb-5 rounded-[4px] border border-amber-200 bg-amber-50 px-3.5 py-3 text-[13px] leading-5 text-amber-800" role="alert">{deliveryMessage}</div>}
              {error && <div className="mb-5 rounded-[4px] border border-[#ecc7c0] bg-[#fff5f2] px-3.5 py-3 text-[13px] leading-5 text-[#a43e31]" role="alert">{error}</div>}
              <form onSubmit={verifyEmail} className="space-y-5">
                <div className="flex justify-center py-2">
                  <InputOTP maxLength={6} value={code} onChange={setCode} aria-label="Enter the six digits of your verification code" autoComplete="one-time-code" autoFocus>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
                      <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <button type="submit" disabled={isLoading || code.length !== 6} className={buttonClass}>
                  {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</> : "Verify email"}
                </button>
                <p className="text-center text-[13px] text-[#758078]">
                  Didn’t get the code?{" "}
                  <button type="button" onClick={() => resendCode()} disabled={isLoading} className="font-semibold text-[#236c53] underline decoration-[#236c53]/35 underline-offset-4 hover:decoration-[#236c53] disabled:opacity-50">Resend code</button>
                </p>
              </form>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}