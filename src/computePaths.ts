// src/computePaths.ts
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
 * **v0.2.2 cascade rule** — author/tag/category updates revalidate
 * `/blog` (the blog tree root) for the same cascade reason described
 * in `computeTags.ts`. Individual `/blog/<slug>` pages refresh via the
 * tag pathway when consumers tag fetches with the matching facet tag.
 *
 * Singletons (navigation, site-settings) intentionally return no paths:
 * the layout tag from `computeTags` is the cascade mechanism. A
 * path-level cascade across the entire site would require either
 * `revalidatePath('/', 'layout')` (which busts everything — broad blast
 * radius the consumer should opt into via `pathsFor` override if they
 * want it) or enumeration of every page route (impossible without
 * knowing the consumer's app router shape). The layout tag is the
 * surgical alternative.
 */
import type { PathComputeInput } from "./types.ts";

/** Mirrors `BLOG_FACET_TYPES` in computeTags — keep in lockstep. */
const BLOG_FACET_TYPES: ReadonlySet<string> = new Set([
  "author",
  "tag",
  "category",
]);

export function computePathsToInvalidate(input: PathComputeInput): string[] {
  const { contentType, slug } = input;

  if (contentType === "blog-post") {
    return slug ? ["/blog", `/blog/${slug}`] : ["/blog"];
  }

  if (BLOG_FACET_TYPES.has(contentType)) {
    return ["/blog"];
  }

  if (contentType === "page" && slug) {
    return [`/${slug}`];
  }

  return [];
}
