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
 * Currently only `blog-post` maps to known user-facing paths. Other
 * content types get path mappings here as more storefront routes ship —
 * or the consumer can override with `pathsFor` on the handler.
 */
import type { PathComputeInput } from "./types.ts";

export function computePathsToInvalidate(input: PathComputeInput): string[] {
  const { contentType, slug } = input;
  if (contentType === "blog-post") {
    return slug ? ["/blog", `/blog/${slug}`] : ["/blog"];
  }
  return [];
}
