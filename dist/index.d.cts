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
 */
interface WebhookPayload {
    /** Schema version. Absent → treated as 1. */
    payloadVersion?: number;
    /** Event name. cms-backend currently aliases all content.* events into "frontend.revalidate". */
    event?: string;
    /** Content type (e.g. "blog-post", "page", "site-settings"). */
    contentType: string;
    /** Slug for slug-bearing content types. Absent for singletons or bulk operations. */
    slug?: string;
    /** Tenant realm (e.g. "feezy", "techademy"). Used to scope tag prefixes. */
    tenantRealm: string;
    /** ISO-8601 timestamp. Enforced against the replay window. */
    occurredAt: string;
}
/** Maximum payload version this package understands. Bump on coordinated schema changes. */
declare const MAX_PAYLOAD_VERSION = 1;
/** Default replay window — 5 minutes — matches the cms-backend spec §7 guard. */
declare const DEFAULT_REPLAY_WINDOW_MS: number;
/** Input to the tag-computation function. */
interface TagComputeInput {
    contentType: string;
    slug?: string;
    realm: string;
}
/** Input to the path-computation function. */
interface PathComputeInput {
    contentType: string;
    slug?: string;
    realm: string;
}
/** Options for `createRevalidateHandler`. */
interface HandlerOptions {
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
type VerifyResult = {
    ok: true;
} | {
    ok: false;
    status: 401 | 409 | 500;
};

declare function createRevalidateHandler(options: HandlerOptions): (req: Request) => Promise<Response>;

/**
 * Compute the Next.js data-cache tags to invalidate for a webhook payload.
 *
 * Pure function so the dual-tag contract (cms spec §5.4) is unit-testable
 * without spinning up next/cache or a Next route handler. Lifted from
 * feezy-website's `app/api/revalidate/_tags.ts` so other tenants can
 * consume the same logic by installing this package.
 *
 * Contract:
 * - Singleton content types ("site-settings", "navigation") → one tag
 *   `${realm}:${contentType}` (no slug, no list).
 * - Slug-bearing content with a slug present → BOTH tags
 *   `${realm}:${contentType}:${slug}` AND `${realm}:${contentType}:list`
 *   so the detail page AND any list pages indexing that content type
 *   both rebuild.
 * - Slug-bearing content WITHOUT a slug (rare: bulk operations without
 *   a single-row identity) → list tag only.
 */

declare function computeTagsToInvalidate(input: TagComputeInput): string[];

/**
 * Compute the Next.js paths to invalidate for a webhook payload.
 *
 * Tag-based revalidation (see `computeTags.ts`) only invalidates cached
 * HTML rendered by a build with `next: { tags: [...] }` attached to its
 * data fetches. If a cached HTML payload predates the tag-instrumented
 * build — e.g. an ISR cache entry that survives across a deploy — tag
 * invalidation silently no-ops against it.
 *
 * Path-based revalidation (`revalidatePath`) is robust against that race:
 * it forces a fresh render regardless of which tags the cached page does
 * or doesn't carry. Belt-and-suspenders defense for the known
 * user-facing paths.
 *
 * Currently only `blog-post` maps to known user-facing paths. Other
 * content types get path mappings here as more storefront routes ship —
 * or the consumer can override with `pathsFor` on the handler.
 */

declare function computePathsToInvalidate(input: PathComputeInput): string[];

declare function verifyWebhook(rawBody: string, signatureHeader: string, secret: string, replayWindowMs?: number): VerifyResult;

export { DEFAULT_REPLAY_WINDOW_MS, type HandlerOptions, MAX_PAYLOAD_VERSION, type PathComputeInput, type TagComputeInput, type VerifyResult, type WebhookPayload, computePathsToInvalidate, computeTagsToInvalidate, createRevalidateHandler, verifyWebhook };
