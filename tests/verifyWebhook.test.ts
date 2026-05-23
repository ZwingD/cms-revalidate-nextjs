// tests/verifyWebhook.test.ts
/**
 * Ported from feezy-website's `app/lib/cms/webhook-verify.test.ts`,
 * plus an additional case for the configurable replay window.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import { verifyWebhook } from "../src/verifyWebhook.ts";

const SECRET = "s3cret";
const sign = (body: string): string =>
  "sha256=" + createHmac("sha256", SECRET).update(body).digest("hex");

test("valid signature + fresh timestamp → ok", () => {
  const body = JSON.stringify({ occurredAt: new Date().toISOString() });
  assert.deepEqual(verifyWebhook(body, sign(body), SECRET), { ok: true });
});

test("wrong signature → 401", () => {
  const body = JSON.stringify({ occurredAt: new Date().toISOString() });
  assert.deepEqual(verifyWebhook(body, "sha256=deadbeef", SECRET), {
    ok: false,
    status: 401,
  });
});

test("length-mismatched signature → 401 (no throw)", () => {
  const body = JSON.stringify({ occurredAt: new Date().toISOString() });
  assert.deepEqual(verifyWebhook(body, "sha256=ab", SECRET), {
    ok: false,
    status: 401,
  });
});

test("stale timestamp (>5 min default window) → 409", () => {
  const old = new Date(Date.now() - 6 * 60 * 1000).toISOString();
  const body = JSON.stringify({ occurredAt: old });
  assert.deepEqual(verifyWebhook(body, sign(body), SECRET), {
    ok: false,
    status: 409,
  });
});

test("custom replayWindowMs honored — 1s window with 2s-old payload → 409", () => {
  const old = new Date(Date.now() - 2000).toISOString();
  const body = JSON.stringify({ occurredAt: old });
  assert.deepEqual(verifyWebhook(body, sign(body), SECRET, 1000), {
    ok: false,
    status: 409,
  });
});

test("missing secret → 500 (config error, never confuse with auth failure)", () => {
  const body = "{}";
  assert.deepEqual(verifyWebhook(body, sign(body), ""), {
    ok: false,
    status: 500,
  });
});

test("missing occurredAt → 409 (cannot validate replay window)", () => {
  const body = JSON.stringify({ event: "frontend.revalidate" });
  assert.deepEqual(verifyWebhook(body, sign(body), SECRET), {
    ok: false,
    status: 409,
  });
});
