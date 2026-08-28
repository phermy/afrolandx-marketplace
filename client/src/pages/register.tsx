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
import { Loader2, Mail, Lock, User, CheckCircle, AlertCircle, Store } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().trim().toLowerCase().email("Please enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});
const normalizeEmail = (email: string) => email.trim().toLowerCase();

async function responseMessage(response: Response, fallback: string) {
  const text = await response.text();
  try {
    const body = JSON.parse(text);
    if (typeof body?.message === "string") return body.message;
    if (typeof body?.error === "string") return body.error;
  } catch {
    // Non-JSON failures should still leave the form usable.
  }
  return fallback;
}

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
  const [emailStatus, setEmailStatus] = useState<EmailStatus>({ state: "idle" });
  const checkTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emailCheckRequest = useRef(0);

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
    const normalizedEmail = normalizeEmail(email);
    const request = ++emailCheckRequest.current;
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setEmailStatus({ state: "idle" });
      return;
    }
    setEmailStatus({ state: "checking" });
    try {
      const res = await fetch(`/api/check-email?email=${encodeURIComponent(normalizedEmail)}`);
      if (!res.ok) throw new Error("Email check failed");
      const data = await res.json().catch(() => {
        throw new Error("Email check returned an invalid response");
      });
      if (request !== emailCheckRequest.current) return;
      if (data.exists) {
        setEmailStatus({ state: "taken", accountType: data.accountType, emailVerified: data.emailVerified });
      } else {
        setEmailStatus({ state: "available" });
      }
    } catch {
      if (request === emailCheckRequest.current) setEmailStatus({ state: "idle" });
    }
  }

  function handleEmailChange(email: string) {
    emailCheckRequest.current++;
    setEmailStatus({ state: "idle" });
    if (checkTimeout.current) clearTimeout(checkTimeout.current);
    checkTimeout.current = setTimeout(() => checkEmail(email), 600);
  }

  async function onSubmit(data: RegisterForm) {
    const email = normalizeEmail(data.email);
    if (checkTimeout.current) clearTimeout(checkTimeout.current);
    emailCheckRequest.current++;
    if (emailStatus.state === "taken") {
      form.setError("email", { message: "An account already exists for this email." });
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: data.firstName,
          lastName: data.lastName,
          email,
          password: data.password,
        }),
        credentials: "include",
      });

      if (response.status === 409) {
        const text = await response.text();
        let result: { roles?: unknown; emailVerified?: unknown } = {};
        try { result = JSON.parse(text); } catch { /* use safe duplicate defaults */ }
        setEmailStatus({
          state: "taken",
          accountType: Array.isArray(result.roles) && result.roles.includes("vendor") ? "vendor" : "customer",
          emailVerified: result.emailVerified === true,
        });
        form.setError("email", { message: "An account already exists for this email." });
        return;
      }

      if (!response.ok) throw new Error(await responseMessage(response, "Registration failed"));

      const responseText = await response.text();
      let result: { message?: string } = {};
      try { result = JSON.parse(responseText); } catch { /* use the default success message */ }
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Account created!",
        description: result.message || "You are now signed in.",
      });
      setLocation("/");
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
                          <Input {...field} autoComplete="given-name" placeholder="First" className="pl-10" data-testid="input-first-name" />
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
                          <Input {...field} autoComplete="family-name" placeholder="Last" data-testid="input-last-name" />
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
                           autoComplete="email"
                           inputMode="email"
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
                        <Input {...field} type="password" autoComplete="new-password" placeholder="At least 8 characters" className="pl-10" data-testid="input-password" />
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
                        <Input {...field} type="password" autoComplete="new-password" placeholder="Confirm your password" className="pl-10" data-testid="input-confirm-password" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full bg-green-700 hover:bg-green-800"
                disabled={isLoading || isTaken}
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
