// src/computeTags.ts
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
import type { TagComputeInput } from "./types.ts";

const SINGLETONS: ReadonlySet<string> = new Set([
  "site-settings",
  "navigation",
]);

export function computeTagsToInvalidate(input: TagComputeInput): string[] {
  const { contentType, slug, realm } = input;
  if (SINGLETONS.has(contentType)) return [`${realm}:${contentType}`];
  if (slug) {
    return [
      `${realm}:${contentType}:${slug}`,
      `${realm}:${contentType}:list`,
    ];
  }
  return [`${realm}:${contentType}:list`];
}
