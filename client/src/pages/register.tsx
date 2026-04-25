import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { Loader2, Mail, Lock, User, CheckCircle, ShieldCheck, AlertCircle, Store } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Alert, AlertDescription } from "@/components/ui/alert";

const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

type EmailStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "taken"; accountType: "customer" | "vendor" | "admin"; emailVerified: boolean };

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"register" | "verify" | "done">("register");
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [emailStatus, setEmailStatus] = useState<EmailStatus>({ state: "idle" });
  const checkTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function checkEmail(email: string) {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailStatus({ state: "idle" });
      return;
    }
    setEmailStatus({ state: "checking" });
    try {
      const res = await fetch(`/api/check-email?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (data.exists) {
        setEmailStatus({ state: "taken", accountType: data.accountType, emailVerified: data.emailVerified });
      } else {
        setEmailStatus({ state: "available" });
      }
    } catch {
      setEmailStatus({ state: "idle" });
    }
  }

  function handleEmailChange(email: string) {
    setEmailStatus({ state: "idle" });
    if (checkTimeout.current) clearTimeout(checkTimeout.current);
    checkTimeout.current = setTimeout(() => checkEmail(email), 600);
  }

  async function onSubmit(data: RegisterForm) {
    if (emailStatus.state === "taken") return;
    setIsLoading(true);
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          password: data.password,
        }),
        credentials: "include",
      });

      const result = await response.json();

      if (response.status === 409) {
        setEmailStatus({ state: "taken", accountType: result.roles?.includes("vendor") ? "vendor" : "customer", emailVerified: false });
        return;
      }

      if (!response.ok) {
        throw new Error(result.message || "Registration failed");
      }

      setRegisteredEmail(data.email);
      setStep("verify");
      toast({ title: "Account created!", description: "Check your email for a verification code." });
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message || "Could not create account",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerify() {
    if (otp.length !== 6) return;
    setIsVerifying(true);
    try {
      const res = await fetch("/api/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: registeredEmail, otp }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      setStep("done");
    } catch (error: any) {
      toast({ title: "Invalid code", description: error.message || "Please try again", variant: "destructive" });
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleResend() {
    setIsResending(true);
    try {
      const res = await fetch("/api/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: registeredEmail }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      toast({ title: "Code resent!", description: "A new code has been sent to your email." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsResending(false);
    }
  }

  if (step === "done") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-amber-50 p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-8 space-y-4">
            <CheckCircle className="h-20 w-20 text-green-600 mx-auto" />
            <h2 className="text-2xl font-bold text-green-800">Email Verified!</h2>
            <p className="text-gray-600">Your account is fully set up and ready to go.</p>
            <Button className="w-full bg-green-700 hover:bg-green-800" onClick={async () => {
              await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
              setLocation("/");
            }}>
              Start Shopping
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "verify") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-amber-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-3">
              <ShieldCheck className="h-14 w-14 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-green-800">Verify Your Email</CardTitle>
            <CardDescription>
              We sent a 6-digit code to <strong>{registeredEmail}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={otp} onChange={setOtp}>
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
            <Button
              className="w-full bg-green-700 hover:bg-green-800"
              onClick={handleVerify}
              disabled={otp.length !== 6 || isVerifying}
            >
              {isVerifying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</> : "Verify Email"}
            </Button>
            <div className="text-center text-sm text-gray-500">
              <p>
                Didn't receive it?{" "}
                <button onClick={handleResend} disabled={isResending} className="text-green-700 hover:underline font-medium">
                  {isResending ? "Sending..." : "Resend code"}
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isTaken = emailStatus.state === "taken";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-amber-50 p-4">
      <Card className="w-full max-w-md" data-testid="register-card">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-green-800">Join Afrolandx</CardTitle>
          <CardDescription>Create your account to start shopping</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input {...field} placeholder="First" className="pl-10" data-testid="input-first-name" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Last" data-testid="input-last-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          {...field}
                          type="email"
                          placeholder="you@example.com"
                          className={`pl-10 pr-10 ${isTaken ? "border-red-400 focus-visible:ring-red-400" : emailStatus.state === "available" ? "border-green-400 focus-visible:ring-green-400" : ""}`}
                          data-testid="input-email"
                          onChange={(e) => { field.onChange(e); handleEmailChange(e.target.value); }}
                        />
                        <div className="absolute right-3 top-3">
                          {emailStatus.state === "checking" && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                          {emailStatus.state === "available" && <CheckCircle className="h-4 w-4 text-green-500" />}
                          {isTaken && <AlertCircle className="h-4 w-4 text-red-500" />}
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />

                    {isTaken && (
                      <Alert className="mt-2 border-red-200 bg-red-50 py-2">
                        <AlertDescription className="text-red-800 text-sm">
                          <div className="flex items-start gap-2">
                            {emailStatus.accountType === "vendor" ? (
                              <Store className="h-4 w-4 mt-0.5 shrink-0 text-red-600" />
                            ) : (
                              <User className="h-4 w-4 mt-0.5 shrink-0 text-red-600" />
                            )}
                            <div>
                              <p className="font-semibold">
                                {emailStatus.accountType === "vendor"
                                  ? "Vendor account already exists"
                                  : emailStatus.accountType === "admin"
                                  ? "Admin account already exists"
                                  : "Customer account already exists"}
                              </p>
                              <p className="text-xs mt-0.5">
                                {emailStatus.emailVerified === false
                                  ? "This account hasn't been verified yet. "
                                  : ""}
                                <Link href="/login" className="text-green-700 font-semibold hover:underline">Sign in</Link>
                                {" "}or{" "}
                                <Link href="/forgot-password" className="text-green-700 font-semibold hover:underline">reset your password</Link>.
                              </p>
                            </div>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input {...field} type="password" placeholder="At least 8 characters" className="pl-10" data-testid="input-password" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input {...field} type="password" placeholder="Confirm your password" className="pl-10" data-testid="input-confirm-password" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full bg-green-700 hover:bg-green-800"
                disabled={isLoading || isTaken || emailStatus.state === "checking"}
                data-testid="button-register"
              >
                {isLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account...</>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>
          </Form>
          <div className="mt-6 text-center text-sm">
            <span className="text-gray-600">Already have an account? </span>
            <Link href="/login" className="text-green-700 hover:underline font-medium" data-testid="link-login">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
