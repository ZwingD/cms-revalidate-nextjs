// src/verifyWebhook.ts
/**
 * Pure webhook verification — HMAC-SHA256 (length-safe) + replay-window
 * check. Mirrors the cms-backend spec §5.3/§7 guard. No Next imports
 * so it stays unit-testable under `node --test`.
 *
 * Returns a discriminated result instead of throwing — route handlers
 * map status codes 401/409/500 to the appropriate HTTP response without
 * leaking stack traces.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

import { DEFAULT_REPLAY_WINDOW_MS } from "./types.ts";
import type { VerifyResult } from "./types.ts";

export function verifyWebhook(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  replayWindowMs: number = DEFAULT_REPLAY_WINDOW_MS,
): VerifyResult {
  if (!secret) return { ok: false, status: 500 };

  const expected =
    "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const sig = Buffer.from(signatureHeader);
  const exp = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch — pre-check to return 401, not 500.
  if (sig.length !== exp.length || !timingSafeEqual(sig, exp)) {
    return { ok: false, status: 401 };
  }

  let occurredAt: string | undefined;
  try {
    occurredAt = (JSON.parse(rawBody) as { occurredAt?: string }).occurredAt;
  } catch {
    occurredAt = undefined;
  }
  const ts = occurredAt ? Date.parse(occurredAt) : NaN;
  if (Number.isNaN(ts) || Date.now() - ts > replayWindowMs) {
    return { ok: false, status: 409 };
  }
  return { ok: true };
}
