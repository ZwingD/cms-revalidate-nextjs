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
 * - Singleton content types ("site-settings", "navigation") → bust the
 *   singleton tag `${realm}:${contentType}` AND a generic
 *   `${realm}:layout` tag. The layout tag lets consumers subscribe ONE
 *   tag to every page's layout fetch (header/footer/SEO) instead of
 *   subscribing to each singleton individually. Mirrors the
 *   `revalidatePath('/', 'layout')` cascade idiom.
 * - Slug-bearing content with a slug present → BOTH tags
 *   `${realm}:${contentType}:${slug}` AND `${realm}:${contentType}:list`
 *   so the detail page AND any list pages indexing that content type
 *   both rebuild.
 * - Slug-bearing content WITHOUT a slug (rare: bulk operations without
 *   a single-row identity) → list tag only.
 * - **v0.2.2 cascade rule** — author/tag/category updates additionally
 *   bust `${realm}:blog-post:list`. These three entity types render on
 *   every blog post page (byline, tag chips, category labels) AND on
 *   the blog index. Without the cascade tag, an author bio rename
 *   would refresh the author archive but leave every blog post page
 *   serving the stale byline until the next blog write. Individual
 *   /blog/<slug> pages are also refreshed if the consumer has tagged
 *   each post's fetch with the matching facet tag
 *   (e.g. `${realm}:author:${slug}`); the package itself only emits
 *   the tags, it cannot enumerate per-post relationships.
 */
import type { TagComputeInput } from "./types.ts";

const SINGLETONS: ReadonlySet<string> = new Set([
  "site-settings",
  "navigation",
]);

/**
 * Content types whose updates fan out to the blog tag space because
 * every blog post page renders one or more of these. See the §
 * "v0.2.2 cascade rule" block above for the failure mode this prevents.
 */
const BLOG_FACET_TYPES: ReadonlySet<string> = new Set([
  "author",
  "tag",
  "category",
]);

export function computeTagsToInvalidate(input: TagComputeInput): string[] {
  const { contentType, slug, realm } = input;

  if (SINGLETONS.has(contentType)) {
    return [`${realm}:${contentType}`, `${realm}:layout`];
  }

  const tags: string[] = [];
  if (slug) {
    tags.push(`${realm}:${contentType}:${slug}`);
  }
  tags.push(`${realm}:${contentType}:list`);

  if (BLOG_FACET_TYPES.has(contentType)) {
    tags.push(`${realm}:blog-post:list`);
  }

  return tags;
}
