import assert from "node:assert/strict";
import test from "node:test";
import { registrationTurnstileConfig } from "./turnstile";

test("explicit Preview opt-out removes the widget; restoring the flag re-enables key validation", () => {
  const oldNodeEnv = process.env.NODE_ENV;
  const oldFlag = process.env.TURNSTILE_REGISTER_ENABLED;
  try {
    process.env.NODE_ENV = "development";
    process.env.TURNSTILE_REGISTER_ENABLED = "false";
    assert.deepEqual(registrationTurnstileConfig(), {
      enabled: false, incomplete: false, siteKey: null, testMode: false,
    });
    delete process.env.TURNSTILE_REGISTER_ENABLED;
    assert.equal(registrationTurnstileConfig().enabled, true);
    assert.equal(registrationTurnstileConfig().testMode, true);
    process.env.TURNSTILE_REGISTER_ENABLED = "true";
    assert.equal(registrationTurnstileConfig().testMode, false);
    const restored = registrationTurnstileConfig();
    assert.equal(restored.enabled || restored.incomplete, true);
  } finally {
    if (oldNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldNodeEnv;
    if (oldFlag === undefined) delete process.env.TURNSTILE_REGISTER_ENABLED;
    else process.env.TURNSTILE_REGISTER_ENABLED = oldFlag;
  }
});

test("live signup uses the configured widget in Preview and production, never test mode", () => {
  const keys = ["NODE_ENV", "TURNSTILE_REGISTER_ENABLED", "TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"] as const;
  const old = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    process.env.TURNSTILE_REGISTER_ENABLED = "true";
    process.env.TURNSTILE_SITE_KEY = "site-key-fixture";
    process.env.TURNSTILE_SECRET_KEY = "secret-key-fixture";
    for (const environment of ["development", "production"]) {
      process.env.NODE_ENV = environment;
      assert.deepEqual(registrationTurnstileConfig(), {
        enabled: true, incomplete: false, siteKey: "site-key-fixture", testMode: false,
      });
      delete process.env.TURNSTILE_SECRET_KEY;
      assert.deepEqual(registrationTurnstileConfig(), {
        enabled: false, incomplete: true, siteKey: null, testMode: false,
      });
      process.env.TURNSTILE_SECRET_KEY = "secret-key-fixture";
    }
  } finally {
    for (const key of keys) {
      if (old[key] === undefined) delete process.env[key];
      else process.env[key] = old[key];
    }
  }
});

test("production cannot silently use the development test widget", () => {
  const oldEnvironment = process.env.NODE_ENV;
  const oldFlag = process.env.TURNSTILE_REGISTER_ENABLED;
  try {
    process.env.NODE_ENV = "production";
    delete process.env.TURNSTILE_REGISTER_ENABLED;
    assert.deepEqual(registrationTurnstileConfig(), {
      enabled: false, incomplete: false, siteKey: null, testMode: false,
    });
  } finally {
    if (oldEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldEnvironment;
    if (oldFlag === undefined) delete process.env.TURNSTILE_REGISTER_ENABLED;
    else process.env.TURNSTILE_REGISTER_ENABLED = oldFlag;
  }
});
