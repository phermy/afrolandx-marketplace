import { useState } from "react";
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
import { Loader2, Mail, Lock, KeyRound, ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const otpEmailSchema = z.object({
  email: z.string().email("Please enter a valid email"),
});

type LoginForm = z.infer<typeof loginSchema>;
type OtpEmailForm = z.infer<typeof otpEmailSchema>;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // OTP flow state
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
    setIsLoading(true);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Login failed");
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Welcome back!", description: "You have been logged in successfully." });
      setLocation("/");
    } catch (error: any) {
      toast({ title: "Login failed", description: error.message || "Invalid email or password", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  async function onSendOtp(data: OtpEmailForm) {
    setIsSendingOtp(true);
    try {
      const res = await fetch("/api/send-login-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      setOtpEmail(data.email);
      setOtpStep("code");
      toast({ title: "Code sent!", description: "Check your email for the 6-digit sign-in code." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to send code", variant: "destructive" });
    } finally {
      setIsSendingOtp(false);
    }
  }

  async function onVerifyOtp() {
    if (otp.length !== 6) return;
    setIsVerifyingOtp(true);
    try {
      const res = await fetch("/api/login-with-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail, otp }),
        credentials: "include",
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Welcome!", description: "You have been signed in successfully." });
      setLocation("/");
    } catch (error: any) {
      toast({ title: "Invalid code", description: error.message || "Please try again", variant: "destructive" });
    } finally {
      setIsVerifyingOtp(false);
    }
  }

  async function resendOtp() {
    setIsSendingOtp(true);
    try {
      const res = await fetch("/api/send-login-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      setOtp("");
      toast({ title: "Code resent!", description: "A new sign-in code has been sent." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSendingOtp(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-amber-50 p-4">
      <Card className="w-full max-w-md" data-testid="login-card">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-green-800">Welcome to Afrolandx</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="password" onValueChange={() => { setOtpStep("email"); setOtp(""); }}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="password" className="flex items-center gap-2">
                <Lock className="h-4 w-4" /> Password
              </TabsTrigger>
              <TabsTrigger value="otp" className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" /> Email Code
              </TabsTrigger>
            </TabsList>

            {/* Password Login Tab */}
            <TabsContent value="password">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onPasswordSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input {...field} type="email" placeholder="you@example.com" className="pl-10" data-testid="input-email" />
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
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input {...field} type="password" placeholder="Your password" className="pl-10" data-testid="input-password" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end">
                    <Link href="/forgot-password" className="text-sm text-green-700 hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                  <Button type="submit" className="w-full bg-green-700 hover:bg-green-800" disabled={isLoading} data-testid="button-login">
                    {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...</> : "Sign In"}
                  </Button>
                </form>
              </Form>
            </TabsContent>

            {/* Email OTP Login Tab */}
            <TabsContent value="otp">
              {otpStep === "email" ? (
                <Form {...otpEmailForm}>
                  <form onSubmit={otpEmailForm.handleSubmit(onSendOtp)} className="space-y-4">
                    <p className="text-sm text-gray-500 mb-2">
                      Enter your email and we'll send you a 6-digit sign-in code — no password needed.
                    </p>
                    <FormField
                      control={otpEmailForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                              <Input {...field} type="email" placeholder="you@example.com" className="pl-10" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full bg-green-700 hover:bg-green-800" disabled={isSendingOtp}>
                      {isSendingOtp ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending code...</> : "Send Sign-In Code"}
                    </Button>
                  </form>
                </Form>
              ) : (
                <div className="space-y-5">
                  <button
                    onClick={() => { setOtpStep("email"); setOtp(""); }}
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                  >
                    <ArrowLeft className="h-3 w-3" /> Back
                  </button>
                  <p className="text-sm text-gray-600">
                    We sent a 6-digit code to <strong>{otpEmail}</strong>. Enter it below to sign in.
                  </p>
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
                    onClick={onVerifyOtp}
                    disabled={otp.length !== 6 || isVerifyingOtp}
                  >
                    {isVerifyingOtp ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...</> : "Sign In"}
                  </Button>
                  <p className="text-center text-sm text-gray-500">
                    Didn't receive it?{" "}
                    <button onClick={resendOtp} disabled={isSendingOtp} className="text-green-700 hover:underline font-medium">
                      {isSendingOtp ? "Sending..." : "Resend code"}
                    </button>
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center text-sm">
            <span className="text-gray-600">Don't have an account? </span>
            <Link href="/register" className="text-green-700 hover:underline font-medium" data-testid="link-register">
              Create one
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
