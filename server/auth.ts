import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import crypto from "crypto";
import { generateOtp, otpExpiryTime, sendVerificationEmail, sendPasswordResetEmail, sendLoginOtpEmail } from "./email";

export function getSession() {
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET environment variable is required");
  }
  
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  return session({
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user) {
            return done(null, false, { message: "Invalid email or password" });
          }
          if (!user.password) {
            return done(null, false, { message: "Please set a password for your account" });
          }
          const isValid = await bcrypt.compare(password, user.password);
          if (!isValid) {
            return done(null, false, { message: "Invalid email or password" });
          }
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Register endpoint
  app.post("/api/register", async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ 
          message: "This email is already registered",
          hint: "sign_in"
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = crypto.randomUUID();

      await storage.upsertUser({
        id: userId,
        email,
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
      });

      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(500).json({ message: "User creation failed" });
      }

      // Send verification email (non-blocking)
      const otp = generateOtp();
      const expiry = otpExpiryTime();
      await storage.updateEmailOtp(userId, otp, expiry);
      sendVerificationEmail(email, firstName || "there", otp).catch(err =>
        console.error("Failed to send verification email:", err)
      );

      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Login failed after registration" });
        }
        return res.json({ 
          user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, roles: user.roles },
          emailVerificationSent: true
        });
      });
    } catch (error) {
      console.error("Registration error:", error);
      return res.status(500).json({ message: "Registration failed" });
    }
  });

  // Login endpoint
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ message: "Authentication error" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Login failed" });
        }
        return res.json({ user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, roles: user.roles } });
      });
    })(req, res, next);
  });

  // Logout endpoint
  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  // Get current user endpoint
  app.get("/api/auth/user", (req, res) => {
    if (req.isAuthenticated() && req.user) {
      const user = req.user as any;
      return res.json({ 
        id: user.id, 
        email: user.email, 
        firstName: user.firstName, 
        lastName: user.lastName, 
        roles: user.roles,
        profileImageUrl: user.profileImageUrl,
        emailVerified: user.emailVerified
      });
    }
    return res.status(401).json({ message: "Not authenticated" });
  });

  // Send login OTP to email (passwordless sign-in)
  app.post("/api/send-login-otp", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "No account found with that email. Please create one first." });
      }

      const otp = generateOtp();
      const expiry = otpExpiryTime();
      await storage.updateLoginOtp(user.id, otp, expiry);

      sendLoginOtpEmail(email, user.firstName || "there", otp).catch(err =>
        console.error("Failed to send login OTP email:", err)
      );

      return res.json({ message: "Sign-in code sent to your email" });
    } catch (error) {
      console.error("Send login OTP error:", error);
      return res.status(500).json({ message: "Failed to send sign-in code" });
    }
  });

  // Login with OTP (passwordless)
  app.post("/api/login-with-otp", async (req, res) => {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) {
        return res.status(400).json({ message: "Email and code are required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired sign-in code" });
      }

      if (!user.loginOtp || user.loginOtp !== otp) {
        return res.status(400).json({ message: "Invalid sign-in code" });
      }

      if (!user.loginOtpExpiry || new Date() > user.loginOtpExpiry) {
        return res.status(400).json({ message: "Sign-in code has expired. Please request a new one." });
      }

      // Clear the OTP after use
      await storage.updateLoginOtp(user.id, null, null);

      // Also mark email as verified if not already
      if (!user.emailVerified) {
        await storage.verifyUserEmail(user.id);
      }

      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Login failed" });
        }
        return res.json({
          user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, roles: user.roles }
        });
      });
    } catch (error) {
      console.error("Login with OTP error:", error);
      return res.status(500).json({ message: "Sign-in failed" });
    }
  });

  // Verify email with OTP
  app.post("/api/verify-email", async (req, res) => {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) {
        return res.status(400).json({ message: "Email and OTP are required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "Account not found" });
      }

      if (user.emailVerified) {
        return res.json({ message: "Email already verified" });
      }

      if (!user.emailOtp || user.emailOtp !== otp) {
        return res.status(400).json({ message: "Invalid verification code" });
      }

      if (!user.emailOtpExpiry || new Date() > user.emailOtpExpiry) {
        return res.status(400).json({ message: "Verification code has expired. Please request a new one." });
      }

      await storage.verifyUserEmail(user.id);
      return res.json({ message: "Email verified successfully" });
    } catch (error) {
      console.error("Email verification error:", error);
      return res.status(500).json({ message: "Verification failed" });
    }
  });

  // Resend email verification OTP
  app.post("/api/resend-verification", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "Account not found" });
      }

      if (user.emailVerified) {
        return res.json({ message: "Email is already verified" });
      }

      const otp = generateOtp();
      const expiry = otpExpiryTime();
      await storage.updateEmailOtp(user.id, otp, expiry);
      await sendVerificationEmail(email, user.firstName || "there", otp);

      return res.json({ message: "Verification code sent to your email" });
    } catch (error) {
      console.error("Resend verification error:", error);
      return res.status(500).json({ message: "Failed to resend verification code" });
    }
  });

  // Forgot password — sends OTP to email
  app.post("/api/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);
      // Always respond success to avoid leaking registered emails
      if (!user) {
        return res.json({ message: "If that email is registered, you'll receive a reset code shortly." });
      }

      const otp = generateOtp();
      const expiry = otpExpiryTime();
      await storage.updatePasswordResetOtp(user.id, otp, expiry);
      sendPasswordResetEmail(email, user.firstName || "there", otp).catch(err =>
        console.error("Failed to send password reset email:", err)
      );

      return res.json({ message: "If that email is registered, you'll receive a reset code shortly." });
    } catch (error) {
      console.error("Forgot password error:", error);
      return res.status(500).json({ message: "Failed to process request" });
    }
  });

  // Reset password with OTP
  app.post("/api/reset-password", async (req, res) => {
    try {
      const { email, otp, newPassword } = req.body;

      if (!email || !otp || !newPassword) {
        return res.status(400).json({ message: "Email, code, and new password are required" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired reset code" });
      }

      if (!user.passwordResetOtp || user.passwordResetOtp !== otp) {
        return res.status(400).json({ message: "Invalid reset code" });
      }

      if (!user.passwordResetOtpExpiry || new Date() > user.passwordResetOtpExpiry) {
        return res.status(400).json({ message: "Reset code has expired. Please request a new one." });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUserPassword(user.id, hashedPassword);

      return res.json({ message: "Password reset successfully. You can now sign in." });
    } catch (error) {
      console.error("Reset password error:", error);
      return res.status(500).json({ message: "Failed to reset password" });
    }
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};
