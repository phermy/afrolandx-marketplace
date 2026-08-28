import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2, Lock, Mail } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import logoImage from "@assets/Group 1000002646_1749631956471.png";

const normalizeEmail = (email: string) => email.trim().toLowerCase();

async function responseMessage(response: Response, fallback: string) {
  const text = await response.text();
  try {
    const body = JSON.parse(text);
    if (typeof body?.message === "string") return body.message;
    if (typeof body?.error === "string") return body.error;
  } catch {
    // A proxy or server error may be HTML rather than JSON.
  }
  return fallback;
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const otpEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email"),
});

type LoginForm = z.infer<typeof loginSchema>;
type OtpEmailForm = z.infer<typeof otpEmailSchema>;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<"password" | "otp">("password");

  const [otpStep, setOtpStep] = useState<"email" | "code">("email");
  const [otpEmail, setOtpEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const otpEmailForm = useForm<OtpEmailForm>({
    resolver: zodResolver(otpEmailSchema),
    defaultValues: { email: "" },
  });

  async function onPasswordSubmit(data: LoginForm) {
    const email = normalizeEmail(data.email);
    setIsLoading(true);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, email }),
        credentials: "include",
      });
      if (!response.ok) {
        const message = await responseMessage(response, "Invalid email or password");
        const isUnverified = /not\s+verified|unverified|verify\s+(your\s+)?email/i.test(message);
        if (isUnverified) {
          setOtpEmail(email);
          otpEmailForm.setValue("email", email, { shouldValidate: true });
          setMode("otp");
          setOtpStep("email");
          toast({
            title: "Verify your email to continue",
            description: "Request an email sign-in code to verify your account and sign in.",
          });
          return;
        }
        throw new Error(message);
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Welcome back!", description: "You have been logged in successfully." });
      setLocation("/");
    } catch (error: any) {
      toast({
        title: "Unable to log in",
        description: error.message || "Please check your email and password and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function onSendOtp(data: OtpEmailForm) {
    const email = normalizeEmail(data.email);
    setIsSendingOtp(true);
    try {
      const response = await fetch("/api/send-login-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error(await responseMessage(response, "Failed to send sign-in code"));

      setOtpEmail(email);
      setOtpStep("code");
      toast({ title: "Code sent", description: "Check your email for the 6-digit sign-in code." });
    } catch (error: any) {
      toast({
        title: "Could not send code",
        description: error.message || "Please try again or use your password to log in.",
        variant: "destructive",
      });
    } finally {
      setIsSendingOtp(false);
    }
  }

  async function onVerifyOtp() {
    if (otp.length !== 6) return;
    setIsVerifyingOtp(true);
    try {
      const response = await fetch("/api/login-with-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail, otp }),
        credentials: "include",
      });
      if (!response.ok) throw new Error(await responseMessage(response, "Invalid or expired sign-in code"));

      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Welcome!", description: "You have been signed in successfully." });
      setLocation("/");
    } catch (error: any) {
      toast({
        title: "Invalid code",
        description: error.message || "Please request a new code and try again.",
        variant: "destructive",
      });
    } finally {
      setIsVerifyingOtp(false);
    }
  }

  async function resendOtp() {
    setIsSendingOtp(true);
    try {
      const response = await fetch("/api/send-login-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail }),
      });
      if (!response.ok) throw new Error(await responseMessage(response, "Failed to resend code"));

      setOtp("");
      toast({ title: "Code resent", description: "A new sign-in code has been sent." });
    } catch (error: any) {
      toast({
        title: "Could not resend code",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSendingOtp(false);
    }
  }

  function showPasswordLogin() {
    setMode("password");
    setOtpStep("email");
    setOtp("");
  }

  function showOtpLogin() {
    setMode("otp");
    setOtpStep("email");
    setOtp("");
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#fbfcfa] pattern-bg">
      <header className="flex items-center justify-between px-6 py-6 sm:px-8 lg:px-12">
        <Link href="/" className="inline-flex items-center gap-3" aria-label="Go to Afrolandx home">
          <img src={logoImage} alt="" className="h-10 w-10 object-contain" />
          <span className="text-2xl font-bold tracking-tight text-[#087f4f]">Afrolandx</span>
        </Link>
        <Link
          href="/register"
          className="rounded-md bg-[#087f4f] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#06683f] focus:outline-none focus:ring-2 focus:ring-[#087f4f] focus:ring-offset-2"
        >
          Create account
        </Link>
      </header>

      <main className="flex flex-1 items-center px-6 pb-16 pt-4 sm:px-8 lg:items-start lg:px-24 lg:pt-24">
        <section className="w-full max-w-[360px]" aria-labelledby="login-title">
          <div className="border border-gray-100 bg-white px-7 py-8 shadow-[0_10px_35px_rgba(20,40,30,0.06)] sm:px-8">
            {mode === "password" ? (
              <>
                <h1 id="login-title" className="text-xl font-semibold tracking-tight text-gray-900">
                  Log in to your account
                </h1>
                <p className="mt-2 text-sm text-gray-500">Welcome back to Afrolandx.</p>

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onPasswordSubmit)} className="mt-7 space-y-5">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-gray-700">Email address</FormLabel>
                          <FormControl>
                            <div className="relative mt-1.5">
                              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                              <Input
                                {...field}
                                type="email"
                                autoComplete="email"
                                 inputMode="email"
                                placeholder="you@example.com"
                                className="h-11 rounded-md border-gray-200 pl-10 pr-3 shadow-none focus:border-[#087f4f] focus:ring-[#087f4f]"
                                data-testid="input-email"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-gray-700">Password</FormLabel>
                          <div className="relative mt-1.5">
                            <FormControl>
                              <Input
                                {...field}
                                type={showPassword ? "text" : "password"}
                                autoComplete="current-password"
                                placeholder="Your password"
                                className="h-11 rounded-md border-gray-200 pl-10 pr-11 shadow-none focus:border-[#087f4f] focus:ring-[#087f4f]"
                                data-testid="input-password"
                              />
                            </FormControl>
                            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <button
                              type="button"
                              onClick={() => setShowPassword((visible) => !visible)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#087f4f]"
                              aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end">
                      <Link href="/forgot-password" className="text-sm text-[#315cff] hover:underline">
                        Forgot password?
                      </Link>
                    </div>

                    <button
                      type="submit"
                      className="flex h-11 w-full items-center justify-center rounded-md bg-[#087f4f] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#06683f] focus:outline-none focus:ring-2 focus:ring-[#087f4f] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={isLoading}
                      data-testid="button-login"
                    >
                      {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Logging in...</> : "Log in"}
                    </button>
                  </form>
                </Form>

                <button
                  type="button"
                  onClick={showOtpLogin}
                  className="mt-6 flex w-full items-center justify-center gap-2 text-sm font-medium text-gray-500 hover:text-[#087f4f] focus:outline-none focus:underline"
                >
                  <KeyRound className="h-4 w-4" />
                  Use an email sign-in code instead
                </button>

              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={showPasswordLogin}
                  className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 focus:outline-none focus:underline"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to password login
                </button>
                <h1 id="login-title" className="text-xl font-semibold tracking-tight text-gray-900">
                  Sign in with an email code
                </h1>
                <p className="mt-2 text-sm leading-6 text-gray-500">
                  We’ll send a one-time 6-digit code to your email.
                </p>

                {otpStep === "email" ? (
                  <Form {...otpEmailForm}>
                    <form onSubmit={otpEmailForm.handleSubmit(onSendOtp)} className="mt-7 space-y-5">
                      <FormField
                        control={otpEmailForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-gray-700">Email address</FormLabel>
                            <FormControl>
                              <div className="relative mt-1.5">
                                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                <Input
                                  {...field}
                                  type="email"
                                  autoComplete="email"
                                 inputMode="email"
                                  placeholder="you@example.com"
                                  className="h-11 rounded-md border-gray-200 pl-10 shadow-none focus:border-[#087f4f] focus:ring-[#087f4f]"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <button
                        type="submit"
                        className="flex h-11 w-full items-center justify-center rounded-md bg-[#087f4f] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#06683f] focus:outline-none focus:ring-2 focus:ring-[#087f4f] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isSendingOtp}
                      >
                        {isSendingOtp ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending code...</> : "Send sign-in code"}
                      </button>
                    </form>
                  </Form>
                ) : (
                  <div className="mt-7 space-y-5">
                    <p className="text-sm leading-6 text-gray-600">
                      We sent a code to <strong className="break-all">{otpEmail}</strong>.
                    </p>
                    <div className="flex justify-center">
                      <InputOTP maxLength={6} value={otp} onChange={setOtp} aria-label="6-digit sign-in code" autoComplete="one-time-code">
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    <button
                      type="button"
                      onClick={onVerifyOtp}
                      className="flex h-11 w-full items-center justify-center rounded-md bg-[#087f4f] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#06683f] focus:outline-none focus:ring-2 focus:ring-[#087f4f] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={otp.length !== 6 || isVerifyingOtp || isSendingOtp}
                    >
                      {isVerifyingOtp ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</> : "Verify and log in"}
                    </button>
                    <p className="text-center text-sm text-gray-500">
                      Didn’t receive it?{" "}
                      <button type="button" onClick={resendOtp} disabled={isSendingOtp} className="font-medium text-[#315cff] hover:underline">
                        {isSendingOtp ? "Sending..." : "Resend code"}
                      </button>
                    </p>
                  </div>
                )}
              </>
            )}

            <p className="mt-7 border-t border-gray-100 pt-6 text-center text-sm text-gray-600">
              Don’t have an account?{" "}
              <Link href="/register" className="font-semibold text-[#087f4f] hover:underline" data-testid="link-register">
                Create one
              </Link>
            </p>
          </div>
        </section>
      </main>

      <footer className="px-6 py-5 text-center text-xs text-gray-500 sm:px-8 lg:px-12 lg:text-left">
        Secure access to Afrolandx marketplace
      </footer>
    </div>
  );
}