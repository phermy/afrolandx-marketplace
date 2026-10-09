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
import { registrationTurnstileConfig, verifyRegistrationTurnstile } from "./turnstile";
import { normalizeAccountPhone } from "@shared/account-registration";
import { getLogisticsAccess } from "./logistics-access";
import { requestRateLimit } from "./request-rate-limit";
import { accountNameProblem, passwordProblem } from "../shared/account-security";
import { queueAccountEmail } from "./account-notifications";
import { assessPassword, PasswordCheckUnavailable } from "./password-safety";
import { growingLoginDelay } from "./login-delay";
import { createLoginCodeRequestHandler } from "./login-code-request";

const DUMMY_PASSWORD_HASH = bcrypt.hashSync("not-an-account-password-timing-only", 10);

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
  return req.ip || req.socket?.remoteAddress || "unknown";
}

export function sanitizeUser(user: any) {
  return {
    id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
    roles: user.roles, profileImageUrl: user.profileImageUrl, emailVerified: user.emailVerified,
    phone: user.phone, signupIntent: user.signupIntent,
    closedAt: user.closedAt,
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
  assessPassword: typeof assessPassword;
  storage: Pick<typeof storage, "getUserByEmail" | "upsertUser" | "getUser">;
  issueOtp: (req: any, user: any) => Promise<void>;
  hashPassword: (password: string) => Promise<string>;
  createId: () => string;
  isRateLimited: (error: unknown) => boolean;
  verifyBotToken?: (token: string) => Promise<boolean>;
};

export function createRegisterHandler(dependencies: RegisterHandlerDependencies) {
  return async (req: any, res: any) => {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ message: "Enter valid account details." });
    }
    const email = canonicalEmail(req.body.email);
    const { password, firstName, lastName } = req.body;
    const passwordError = passwordProblem(password, email || undefined);
    if (!email || passwordError) {
      return res.status(400).json({ message: passwordError || "Enter a valid email address." });
    }
    const nameError = accountNameProblem(firstName, lastName);
    if (nameError) {
      return res.status(400).json({ message: nameError });
    }
    const phone = normalizeAccountPhone(req.body.phone);
    if (!phone) return res.status(400).json({ message: "Enter a valid phone number with 7 to 15 digits." });
    const signupIntent = req.body.signupIntent ?? "customer";
    if (signupIntent !== "customer" && signupIntent !== "vendor") {
      return res.status(400).json({ message: "Choose customer or vendor signup." });
    }
    if (dependencies.verifyBotToken) {
      const token = req.body.turnstileToken;
      if (typeof token !== "string" || !token || token.length > 2048) {
        return res.status(400).json({ message: "Complete the security check before creating your account." });
      }
      try {
        if (!await dependencies.verifyBotToken(token)) {
          return res.status(400).json({ message: "The security check expired or could not be verified. Please try again." });
        }
      } catch (error) {
        console.error("Registration security check unavailable:", error);
        return res.status(503).json({ message: "The security check is temporarily unavailable. Please try again later." });
      }
    }
    try {
      const safetyProblem = await dependencies.assessPassword(password, email);
      if (safetyProblem) return res.status(400).json({ message: safetyProblem });
      const existing = await dependencies.storage.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ message: "An account already exists for this email. Log in or reset your password.", hint: "SIGN_IN" });
      }
      const id = dependencies.createId();
      await dependencies.storage.upsertUser({
        id,
        email,
        password: await dependencies.hashPassword(password),
        firstName: firstName.trim(),
        lastName: lastName?.trim() || null,
        phone,
        signupIntent,
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
      if (error instanceof PasswordCheckUnavailable) {
        return res.status(503).json({ message: error.message });
      }
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
      const matches = await bcrypt.compare(password, user?.password || DUMMY_PASSWORD_HASH);
      if (!user?.password || !matches) return done(null, false, { message: "Invalid email or password" });
      if (user.closedAt) return done(null, false, { message: "This account has been closed. Contact support." });
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
    try {
      const user = await storage.getUser(id);
      done(null, user?.closedAt ? false : user);
    } catch (error) { done(error); }
  });

  async function finalizeLogin(req: any, res: any, user: any, onSuccess: () => void) {
    const guestBuyerId = req.session.guestBuyerId;
    req.session.regenerate((regenerateError: any) => {
      if (regenerateError) return res.status(500).json({ message: "Login failed" });
      req.login(user, async (loginError: any) => {
        if (loginError) return res.status(500).json({ message: "Login failed" });
        try {
          await storage.updateActiveSession(user.id, req.sessionID);
          if (guestBuyerId) {
            const { claimGuestPaidOrders } = await import("./guest-checkout");
            await claimGuestPaidOrders(guestBuyerId, user);
          }
        } catch (error) {
          return req.logout(() => {
            req.session.destroy(() => res.status(error instanceof Error && error.message === "ACCOUNT_CLOSED" ? 403 : 500)
              .json({ message: error instanceof Error && error.message === "ACCOUNT_CLOSED" ? "This account has been closed. Contact support." : "Login failed" }));
          });
        }
        await queueAccountEmail(user.email, "New sign-in to your Afrolandx account",
          "A sign-in to your Afrolandx account was completed. If this was not you, reset your password to end the other session and contact support@afrolandx.com. Never send your password or verification code by email."
        ).catch(() => console.error("Sign-in notice could not be queued."));
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

  app.get("/api/auth/turnstile-config", (_req, res) => {
    const config = registrationTurnstileConfig();
    res.setHeader("Cache-Control", "no-store");
    if (config.incomplete) return res.status(503).json({ message: "Registration security check is not configured correctly." });
    res.json({ enabled: config.enabled, siteKey: config.siteKey, testMode: config.testMode });
  });

  app.post("/api/register", requestRateLimit("register", 6, 900), createRegisterHandler({
    assessPassword,
    storage,
    issueOtp: (req, user) => issueOtp(req, user, "email"),
    hashPassword: (password) => bcrypt.hash(password, 10),
    createId: () => crypto.randomUUID(),
    isRateLimited: (error) => error instanceof OtpRateLimitError,
    verifyBotToken: registrationTurnstileConfig().incomplete
      ? async () => { throw new Error("Turnstile keys are incomplete"); }
      : registrationTurnstileConfig().enabled ? verifyRegistrationTurnstile : undefined,
  }));

  app.post("/api/login", requestRateLimit("password-login", 10, 900), growingLoginDelay("password"), (req, res, next) => passport.authenticate("local", (err: any, user: any, info: any) => {
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

  app.get("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const access = await getLogisticsAccess((req.user as any).id);
      res.json({ ...sanitizeUser(req.user), isShippingPartner: access.partnerIds.length > 0 || access.invitations.length > 0 });
    } catch (error) {
      if (!((req.user as any)?.emailVerified)) return res.json(sanitizeUser(req.user));
      res.status(503).json({ message: "Could not load account access. Please retry." });
    }
  });

  app.post("/api/send-login-otp", requestRateLimit("login-code-request", 6, 900), createLoginCodeRequestHandler({
    getUserByEmail: email => storage.getUserByEmail(email),
    issueOtp: (req, user) => issueOtp(req, user, "login"),
    onDeliveryError: () => console.warn("Sign-in code could not be issued."),
  }));

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

  app.post("/api/login-with-otp", requestRateLimit("login-code-verify", 10, 900), growingLoginDelay("code"), async (req, res) => {
    const email = canonicalEmail(req.body.email);
    if (!email || !OTP_RE.test(req.body.otp || "")) return res.status(400).json({ message: "Email and a six-digit code are required" });
    try {
      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(400).json({ message: "Invalid or expired sign-in code" });
      if (user.closedAt) return res.status(403).json({ message: "This account has been closed. Contact support." });
      const result = await verifyOtp(req, user, req.body.otp, "login");
      if (result !== "valid") return res.status(result === "limited" ? 429 : 400).json({ message: result === "expired" ? "Sign-in code has expired. Please request a new one." : "Invalid sign-in code", ...(result === "limited" ? { hint: "RATE_LIMITED" } : {}) });
      if (!user.emailVerified) await storage.verifyUserEmail(user.id);
      finalizeLogin(req, res, user, () => res.json({ user: sanitizeUser({ ...user, emailVerified: true }) }));
    } catch { return res.status(500).json({ message: "Sign-in failed" }); }
  });

  app.post("/api/verify-email", requestRateLimit("email-code-verify", 10, 900), async (req, res) => {
    const email = canonicalEmail(req.body.email);
    if (!email || !OTP_RE.test(req.body.otp || "")) return res.status(400).json({ message: "Email and a six-digit code are required" });
    try {
      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(404).json({ message: "Account not found" });
      if (user.closedAt) return res.status(403).json({ message: "This account has been closed. Contact support." });
      if (user.emailVerified) return res.json({ message: "Email already verified" });
      const result = await verifyOtp(req, user, req.body.otp, "email");
      if (result !== "valid") return res.status(result === "limited" ? 429 : 400).json({ message: result === "expired" ? "Verification code has expired. Please request a new one." : "Invalid verification code" });
      await storage.verifyUserEmail(user.id);
      finalizeLogin(req, res, user, () => res.json({ message: "Email verified successfully", user: sanitizeUser({ ...user, emailVerified: true }) }));
    } catch { return res.status(500).json({ message: "Verification failed" }); }
  });

  app.post("/api/resend-verification", requestRateLimit("verification-request", 6, 900), createLoginCodeRequestHandler({
    getUserByEmail: email => storage.getUserByEmail(email),
    issueOtp: (req, user) => issueOtp(req, user, "email"),
    eligible: user => !user.emailVerified,
    response: { message: "If an eligible account needs verification, a code will be sent. Check your inbox and spam folder." },
    onDeliveryError: () => console.warn("Verification code could not be issued."),
  }));

  app.post("/api/forgot-password", requestRateLimit("password-reset-request", 6, 900), createLoginCodeRequestHandler({
    getUserByEmail: email => storage.getUserByEmail(email),
    issueOtp: (req, user) => issueOtp(req, user, "reset"),
    response: { message: "If an eligible account exists, a password reset code will be sent. Check your inbox and spam folder." },
    onDeliveryError: () => console.warn("Password reset code could not be issued."),
  }));

  app.post("/api/reset-password", requestRateLimit("password-reset-verify", 10, 900), async (req, res) => {
    const email = canonicalEmail(req.body.email);
    const { otp, newPassword } = req.body;
    const passwordError = passwordProblem(newPassword, email || undefined);
    if (!email || !OTP_RE.test(otp || "") || passwordError) return res.status(400).json({ message: passwordError || "A valid email and six-digit code are required" });
    try {
      const safetyProblem = await assessPassword(newPassword, email);
      if (safetyProblem) return res.status(400).json({ message: safetyProblem });
      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(400).json({ message: "Invalid or expired reset code" });
      if (user.closedAt) return res.status(403).json({ message: "This account has been closed. Contact support." });
      const result = await verifyOtp(req, user, otp, "reset");
      if (result !== "valid") return res.status(result === "limited" ? 429 : 400).json({ message: result === "expired" ? "Reset code has expired. Please request a new one." : "Invalid reset code" });
      await storage.updateUserPassword(user.id, await bcrypt.hash(newPassword, 10));
      await storage.updateActiveSession(user.id, null);
      await queueAccountEmail(user.email, "Your Afrolandx password was changed",
        "Your password was changed successfully, and previous signed-in sessions have been ended. If you did not make this change, request a password reset and contact support@afrolandx.com immediately. Never send your password or verification code by email."
      ).catch(() => console.error("Password change notice could not be queued."));
      return res.json({ message: "Password reset successfully. You can now sign in." });
    } catch (error) {
      return res.status(error instanceof PasswordCheckUnavailable ? 503 : 500).json({
        message: error instanceof PasswordCheckUnavailable ? error.message : "Failed to reset password",
      });
    }
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (!req.isAuthenticated() || !req.user) return res.status(401).json({ message: "Unauthorized" });
  const user = req.user as any;
  if (user.closedAt) {
    req.logout(() => req.session?.destroy(() => {}));
    return res.status(401).json({ message: "ACCOUNT_CLOSED" });
  }
  if (user.activeSessionId !== req.sessionID) {
    req.logout(() => req.session?.destroy(() => {}));
    return res.status(401).json({ message: "SESSION_SUPERSEDED" });
  }
  return next();
};