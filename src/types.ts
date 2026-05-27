// src/types.ts
/**
 * Shared types for the Zwingd CMS revalidation handler.
 *
 * The webhook payload contract is the load-bearing inter-repo artifact
 * between cms-backend (sender) and any tenant storefront (receiver).
 * Lock it down here; bump `MAX_PAYLOAD_VERSION` only with coordinated
 * cms-backend + package releases.
 */

/**
 * Inbound webhook payload from cms-backend.
 *
 * `payloadVersion` is OPTIONAL today — payloads without the field are
 * treated as v1 (the current shape). When cms-backend starts emitting a
 * field, set it to a positive integer; the handler will compare against
 * `MAX_PAYLOAD_VERSION` and reject anything newer with HTTP 426 so
 * misconfigured tenants get a clear error instead of silent no-ops.
 *
 * **v0.2.0 (Sprint 10A Task 11)** — adds `items[]` for coalesced
 * payloads (`payloadVersion: 2`). When `items` is present, the handler
 * iterates and computes the union of tags/paths across all items.
 * v1 single-item payloads (no `items`, no `payloadVersion`) keep
 * working unchanged — strictly backward compatible.
 */
export interface WebhookPayloadItem {
  /** Content type for this item (e.g. "blog-post", "page"). */
  contentType: string;
  /** Slug for this item. Absent for singletons. */
  slug?: string;
}

export interface WebhookPayload {
  /** Schema version. Absent → treated as 1. */
  payloadVersion?: number;
  /** Event name. cms-backend currently aliases all content.* events into "frontend.revalidate". */
  event?: string;
  /**
   * Content type (e.g. "blog-post", "page", "site-settings").
   * v1: required. v2: ignored when `items` is present.
   */
  contentType?: string;
  /**
   * Slug for slug-bearing content types. Absent for singletons or
   * bulk operations. v1 only — v2 carries slugs inside `items[]`.
   */
  slug?: string;
  /**
   * v2 (`payloadVersion: 2`) only — coalesced batch of items from one
   * tenant's drain cycle. Each item is processed identically to a v1
   * single-item payload; tags/paths are deduped across items.
   */
  items?: WebhookPayloadItem[];
  /** Tenant realm (e.g. "feezy", "techademy"). Used to scope tag prefixes. */
  tenantRealm: string;
  /** ISO-8601 timestamp. Enforced against the replay window. */
  occurredAt: string;
}

/** Maximum payload version this package understands. Bump on coordinated schema changes. */
export const MAX_PAYLOAD_VERSION = 2;

/** Default replay window — 5 minutes — matches the cms-backend spec §7 guard. */
export const DEFAULT_REPLAY_WINDOW_MS = 5 * 60 * 1000;

/**
 * Hard ceiling on `items[]` length per webhook. cms-backend coalesces in
 * windows of ≤500 (Sprint 10A spec); 2× headroom catches a buggy or
 * hostile sender without rejecting plausible traffic. Items beyond the
 * cap are dropped (process the first slice) and a single warn is logged
 * per process — never 500 a webhook (spec §7).
 */
export const MAX_ITEMS_PER_PAYLOAD = 1000;

/** Input to the tag-computation function. */
export interface TagComputeInput {
  contentType: string;
  slug?: string;
  realm: string;
}

/** Input to the path-computation function. */
export interface PathComputeInput {
  contentType: string;
  slug?: string;
  realm: string;
}

/** Options for `createRevalidateHandler`. */
export interface HandlerOptions {
  /** Shared HMAC secret. Must match the secret registered for this tenant in cms-backend. */
  secret: string;
  /**
   * Fallback realm used when the webhook payload doesn't carry one.
   * In practice cms-backend always emits `tenantRealm`; this is a defensive default.
   */
  realm: string;
  /** Replay window override in milliseconds. Default: 5 minutes. */
  replayWindowMs?: number;
  /** Override the default tag-computation rules. Receives the same input the default does. */
  tagsFor?: (input: TagComputeInput) => string[];
  /** Override the default path-computation rules. Receives the same input the default does. */
  pathsFor?: (input: PathComputeInput) => string[];
}

/** Result type for `verifyWebhook`. */
export type VerifyResult =
  | { ok: true }
  | { ok: false; status: 401 | 409 | 500 };
