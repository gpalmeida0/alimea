import { test } from "node:test";
import assert from "node:assert/strict";
import { clearAttempts, isLimited, recordAttempt } from "../src/lib/auth/rate-limit";

test("rate limit: blocks after max attempts, per key, and resets after the window", () => {
  const limit = { max: 3, windowMs: 1000 };
  const now = 1_000_000;
  for (let i = 0; i < 3; i++) {
    assert.equal(isLimited("a", limit, now), false);
    recordAttempt("a", limit, now);
  }
  assert.equal(isLimited("a", limit, now + 999), true);
  assert.equal(isLimited("b", limit, now), false);
  assert.equal(isLimited("a", limit, now + 1000), false);

  recordAttempt("a", limit, now + 1000);
  clearAttempts("a");
  assert.equal(isLimited("a", limit, now + 1000), false);
});
