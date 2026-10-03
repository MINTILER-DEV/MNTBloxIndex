import test from "node:test";
import assert from "node:assert/strict";
import { hashPasswordAsync, normalizeUsername, verifyPasswordAsync } from "../api/_lib/auth.js";
import { consumeRateLimit } from "../api/_lib/rate-limit.js";

test("passwords are salted and username validation is strict", async () => {
  const hash = await hashPasswordAsync("a long enough password");
  assert.match(hash, /^scrypt\$/); assert.equal(await verifyPasswordAsync("a long enough password", hash), true);
  assert.equal(await verifyPasswordAsync("wrong password", hash), false);
  assert.equal(normalizeUsername("  User_Name  "), "user_name"); assert.equal(normalizeUsername("no spaces"), "");
});

test("rate limits reject requests after their configured allowance", () => {
  const index = {}; const now = 100_000;
  assert.equal(consumeRateLimit(index, "add:account", 2, 60_000, now).allowed, true);
  assert.equal(consumeRateLimit(index, "add:account", 2, 60_000, now + 1).allowed, true);
  const limited = consumeRateLimit(index, "add:account", 2, 60_000, now + 2);
  assert.equal(limited.response.status, 429);
  assert.equal(consumeRateLimit(index, "add:account", 2, 60_000, now + 60_001).allowed, true);
});
