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
