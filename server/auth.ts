import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { storage } from "./storage";
import { generateOtp, otpExpiryTime, sendVerificationEmail, sendPasswordResetEmail, sendLoginOtpEmail } from "./email";
import { pool } from "./db";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_RE = /^\d{6}$/;
const REQUEST_WINDOW_MS = 15 * 60 * 1000;
const MAX_OTP_REQUESTS = 5;
const MAX_OTP_ATTEMPTS = 8;
const requestLimits = new Map<string, number[]>();
const attemptLimits = new Map<string, number[]>();

class OtpRateLimitError extends Error {}

function canonicalEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return EMAIL_RE.test(email) && email.length <= 254 ? email : null;
}

function otpDigest(otp: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET environment variable is required");
  return crypto.createHmac("sha256", secret).update(otp).digest("hex");
}

function secureOtpMatches(digest: string | null, otp: unknown): boolean {
  if (!digest || typeof otp !== "string" || !OTP_RE.test(otp)) return false;
  const actual = Buffer.from(otpDigest(otp), "hex");
  const expected = Buffer.from(digest, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function permitted(limit: Map<string, number[]>, key: string, max: number): boolean {
  const now = Date.now();
  const recent = (limit.get(key) || []).filter(time => now - time < REQUEST_WINDOW_MS);
  if (recent.length >= max) {
    limit.set(key, recent);
    return false;
  }
  recent.push(now);
  limit.set(key, recent);
  return true;
}

function clientIp(req: any): string {
  const forwarded = req.headers["x-forwarded-for"];
  return typeof forwarded === "string" ? forwarded.split(",")[0].trim() : req.ip || "unknown";
}

export function sanitizeUser(user: any) {
  return {
    id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
    roles: user.roles, profileImageUrl: user.profileImageUrl, emailVerified: user.emailVerified,
    createdAt: user.createdAt, updatedAt: user.updatedAt,
  };
}

export function getSession() {
  if (!process.env.SESSION_SECRET) throw new Error("SESSION_SECRET environment variable is required");
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  return session({
    secret: process.env.SESSION_SECRET,
    store: new pgStore({ pool, createTableIfMissing: true, ttl: sessionTtl, tableName: "sessions" }),
    resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: sessionTtl },
  });
}

type RegisterHandlerDependencies = {
  storage: Pick<typeof storage, "getUserByEmail" | "upsertUser" | "getUser">;
  issueOtp: (req: any, user: any) => Promise<void>;
  hashPassword: (password: string) => Promise<string>;
  createId: () => string;
  isRateLimited: (error: unknown) => boolean;
};

export function createRegisterHandler(dependencies: RegisterHandlerDependencies) {
  return async (req: any, res: any) => {
    const email = canonicalEmail(req.body.email);
    const { password, firstName, lastName } = req.body;
    if (!email || typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ message: "A valid email and a password of at least 8 characters are required" });
    }
    try {
      const existing = await dependencies.storage.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ message: "An account already exists for this email. Log in or reset your password.", hint: "SIGN_IN" });
      }
      const id = dependencies.createId();
      await dependencies.storage.upsertUser({
        id,
        email,
        password: await dependencies.hashPassword(password),
        firstName: firstName || null,
        lastName: lastName || null,
      });
      const user = await dependencies.storage.getUser(id);
      if (!user) return res.status(500).json({ message: "User creation failed" });
      try {
        await dependencies.issueOtp(req, user);
      } catch (error) {
        const rateLimited = dependencies.isRateLimited(error);
        return res.status(201).json({
          message: rateLimited
            ? "Account created. Please wait before requesting a verification code."
            : "Account created, but we couldn't send the verification email. Please use resend when email service is available.",
          email,
          emailVerificationSent: false,
          ...(rateLimited ? { hint: "RATE_LIMITED" } : {}),
        });
      }
      return res.json({ message: "Account created. Please verify your email.", email, emailVerificationSent: true });
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(409).json({ message: "An account already exists for this email. Log in or reset your password.", hint: "SIGN_IN" });
      }
      console.error("Registration error:", error);
      return res.status(500).json({ message: "Registration failed" });
    }
  };
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(new LocalStrategy({ usernameField: "email" }, async (rawEmail, password, done) => {
    try {
      const email = canonicalEmail(rawEmail);
      if (!email || typeof password !== "string" || password.length < 8) return done(null, false, { message: "Invalid email or password" });
      const user = await storage.getUserByEmail(email);
      if (!user || !user.password || !await bcrypt.compare(password, user.password)) return done(null, false, { message: "Invalid email or password" });
      if (!user.emailVerified) {
        return done(
          null,
          false,
          { message: "Please verify your email before signing in", hint: "EMAIL_UNVERIFIED" } as any,
        );
      }
      return done(null, user);
    } catch (error) { return done(error); }
  }));
  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try { done(null, await storage.getUser(id)); } catch (error) { done(error); }
  });

  async function finalizeLogin(req: any, res: any, user: any, onSuccess: () => void) {
    req.session.regenerate((regenerateError: any) => {
      if (regenerateError) return res.status(500).json({ message: "Login failed" });
      req.login(user, async (loginError: any) => {
        if (loginError) return res.status(500).json({ message: "Login failed" });
        try {
          await storage.updateActiveSession(user.id, req.sessionID);
        } catch {
          return req.logout(() => {
            req.session.destroy(() => res.status(500).json({ message: "Login failed" }));
          });
        }
        onSuccess();
      });
    });
  }

  async function issueOtp(req: any, user: any, type: "email" | "login" | "reset") {
    const email = user.email;
    if (!email) throw new Error("User has no email address");
    if (
      !permitted(requestLimits, `${type}:ip:${clientIp(req)}`, MAX_OTP_REQUESTS) ||
      !permitted(requestLimits, `${type}:email:${email}`, MAX_OTP_REQUESTS)
    ) {
      throw new OtpRateLimitError("Too many code requests");
    }
    const otp = generateOtp();
    const save = type === "email" ? storage.updateEmailOtp : type === "login" ? storage.updateLoginOtp : storage.updatePasswordResetOtp;
    try {
      if (type === "email") await sendVerificationEmail(email, user.firstName || "there", otp);
      else if (type === "login") await sendLoginOtpEmail(email, user.firstName || "there", otp);
      else await sendPasswordResetEmail(email, user.firstName || "there", otp);
      await save(user.id, otpDigest(otp), otpExpiryTime());
    } catch (error) {
      await save(user.id, null, null);
      throw error;
    }
  }

  app.post("/api/register", createRegisterHandler({
    storage,
    issueOtp: (req, user) => issueOtp(req, user, "email"),
    hashPassword: (password) => bcrypt.hash(password, 10),
    createId: () => crypto.randomUUID(),
    isRateLimited: (error) => error instanceof OtpRateLimitError,
  }));

  app.post("/api/login", (req, res, next) => passport.authenticate("local", (err: any, user: any, info: any) => {
    if (err) return res.status(500).json({ message: "Authentication error" });
    if (!user) return res.status(401).json({ message: info?.message || "Invalid credentials", ...(info?.hint ? { hint: info.hint } : {}) });
    finalizeLogin(req, res, user, () => res.json({ user: sanitizeUser(user) }));
  })(req, res, next));

  app.post("/api/logout", (req, res) => {
    const userId = (req.user as any)?.id;
    const sessionId = req.sessionID;
    req.logout(async (err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      try {
        // A superseded session must not invalidate the newer session on logout.
        const user = userId ? await storage.getUser(userId) : undefined;
        if (user?.activeSessionId === sessionId) await storage.updateActiveSession(userId, null);
      }
      finally { req.session?.destroy(() => res.clearCookie("connect.sid").json({ message: "Logged out successfully" })); }
    });
  });

  app.get("/api/auth/user", isAuthenticated, (req, res) => res.json(sanitizeUser(req.user)));

  app.post("/api/send-login-otp", async (req, res) => {
    const email = canonicalEmail(req.body.email);
    if (!email) return res.status(400).json({ message: "A valid email is required" });
    try {
      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(404).json({ message: "No account found with that email. Please create one first." });
      await issueOtp(req, user, "login");
      return res.json({ message: "Sign-in code sent to your email" });
    } catch (error) {
      if (error instanceof OtpRateLimitError) {
        return res.status(429).json({ message: "Too many code requests. Please try again later.", hint: "RATE_LIMITED" });
      }
      return res.status(503).json({ message: "Failed to send sign-in code" });
    }
  });

  async function verifyOtp(req: any, user: any, otp: unknown, kind: "email" | "login" | "reset") {
    const digest = kind === "email" ? user.emailOtp : kind === "login" ? user.loginOtp : user.passwordResetOtp;
    const expiry = kind === "email" ? user.emailOtpExpiry : kind === "login" ? user.loginOtpExpiry : user.passwordResetOtpExpiry;
    const clear = kind === "email" ? storage.updateEmailOtp : kind === "login" ? storage.updateLoginOtp : storage.updatePasswordResetOtp;
    if (
      !permitted(attemptLimits, `${kind}:ip:${clientIp(req)}`, MAX_OTP_ATTEMPTS) ||
      !permitted(attemptLimits, `${kind}:email:${user.email}`, MAX_OTP_ATTEMPTS)
    ) return "limited";
    if (!expiry || new Date() > expiry) { await clear(user.id, null, null); return "expired"; }
    if (!secureOtpMatches(digest, otp)) return "invalid";
    await clear(user.id, null, null);
    return "valid";
  }

  app.post("/api/login-with-otp", async (req, res) => {
    const email = canonicalEmail(req.body.email);
    if (!email || !OTP_RE.test(req.body.otp || "")) return res.status(400).json({ message: "Email and a six-digit code are required" });
    try {
      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(400).json({ message: "Invalid or expired sign-in code" });
      const result = await verifyOtp(req, user, req.body.otp, "login");
      if (result !== "valid") return res.status(result === "limited" ? 429 : 400).json({ message: result === "expired" ? "Sign-in code has expired. Please request a new one." : "Invalid sign-in code", ...(result === "limited" ? { hint: "RATE_LIMITED" } : {}) });
      if (!user.emailVerified) await storage.verifyUserEmail(user.id);
      finalizeLogin(req, res, user, () => res.json({ user: sanitizeUser({ ...user, emailVerified: true }) }));
    } catch { return res.status(500).json({ message: "Sign-in failed" }); }
  });

  app.post("/api/verify-email", async (req, res) => {
    const email = canonicalEmail(req.body.email);
    if (!email || !OTP_RE.test(req.body.otp || "")) return res.status(400).json({ message: "Email and a six-digit code are required" });
    try {
      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(404).json({ message: "Account not found" });
      if (user.emailVerified) return res.json({ message: "Email already verified" });
      const result = await verifyOtp(req, user, req.body.otp, "email");
      if (result !== "valid") return res.status(result === "limited" ? 429 : 400).json({ message: result === "expired" ? "Verification code has expired. Please request a new one." : "Invalid verification code" });
      await storage.verifyUserEmail(user.id);
      finalizeLogin(req, res, user, () => res.json({ message: "Email verified successfully", user: sanitizeUser({ ...user, emailVerified: true }) }));
    } catch { return res.status(500).json({ message: "Verification failed" }); }
  });

  app.post("/api/resend-verification", async (req, res) => {
    const email = canonicalEmail(req.body.email);
    if (!email) return res.status(400).json({ message: "A valid email is required" });
    try {
      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(404).json({ message: "Account not found" });
      if (user.emailVerified) return res.json({ message: "Email is already verified" });
      await issueOtp(req, user, "email");
      return res.json({ message: "Verification code sent to your email" });
    } catch (error) {
      if (error instanceof OtpRateLimitError) {
        return res.status(429).json({ message: "Too many code requests. Please try again later.", hint: "RATE_LIMITED" });
      }
      return res.status(503).json({ message: "Failed to resend verification code" });
    }
  });

  app.post("/api/forgot-password", async (req, res) => {
    const email = canonicalEmail(req.body.email);
    if (!email) return res.status(400).json({ message: "A valid email is required" });
    const genericResponse = { message: "If that email is registered, you'll receive a reset code shortly." };

    // Apply the same public response and IP limit before lookup to prevent account enumeration.
    if (!permitted(requestLimits, `reset:public-ip:${clientIp(req)}`, MAX_OTP_REQUESTS)) {
      return res.json(genericResponse);
    }

    try {
      const user = await storage.getUserByEmail(email);
      if (user) {
        try {
          await issueOtp(req, user, "reset");
        } catch (error) {
          console.error("Password reset code delivery failed:", error);
        }
      }
      return res.json(genericResponse);
    } catch (error) {
      console.error("Password reset request failed:", error);
      return res.json(genericResponse);
    }
  });

  app.post("/api/reset-password", async (req, res) => {
    const email = canonicalEmail(req.body.email);
    const { otp, newPassword } = req.body;
    if (!email || !OTP_RE.test(otp || "") || typeof newPassword !== "string" || newPassword.length < 8) return res.status(400).json({ message: "A valid email, six-digit code, and password of at least 8 characters are required" });
    try {
      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(400).json({ message: "Invalid or expired reset code" });
      const result = await verifyOtp(req, user, otp, "reset");
      if (result !== "valid") return res.status(result === "limited" ? 429 : 400).json({ message: result === "expired" ? "Reset code has expired. Please request a new one." : "Invalid reset code" });
      await storage.updateUserPassword(user.id, await bcrypt.hash(newPassword, 10));
      await storage.updateActiveSession(user.id, null);
      return res.json({ message: "Password reset successfully. You can now sign in." });
    } catch { return res.status(500).json({ message: "Failed to reset password" }); }
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (!req.isAuthenticated() || !req.user) return res.status(401).json({ message: "Unauthorized" });
  const user = req.user as any;
  if (user.activeSessionId !== req.sessionID) {
    req.logout(() => req.session?.destroy(() => {}));
    return res.status(401).json({ message: "SESSION_SUPERSEDED" });
  }
  return next();
};