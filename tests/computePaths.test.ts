// tests/computePaths.test.ts
/**
 * Ported from feezy-website's `app/api/revalidate/_paths.test.ts`.
 *
 * Path-based revalidation supplements the dual-tag contract. The cases
 * here mirror `computeTags.test.ts` shape so a future content-type
 * addition touches both files in lockstep.
 *
 * **v0.2.2 cascade** — author/tag/category updates revalidate `/blog`
 * for the same cascade reason called out in computeTags. Page edits
 * revalidate the page's own route. Singletons return no paths (layout
 * tag handles the cascade).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { computePathsToInvalidate } from "../src/computePaths.ts";

test("blog-post with slug → /blog AND /blog/<slug> (detail + list)", () => {
  assert.deepEqual(
    computePathsToInvalidate({
      contentType: "blog-post",
      slug: "hello-world",
      realm: "feezy",
    }),
    ["/blog", "/blog/hello-world"],
  );
});

test("blog-post with slug — list path FIRST so list regen is not gated on detail success", () => {
  const paths = computePathsToInvalidate({
    contentType: "blog-post",
    slug: "x",
    realm: "feezy",
  });
  assert.equal(paths[0], "/blog");
  assert.equal(paths[1], "/blog/x");
});

test("blog-post WITHOUT slug → just /blog (bulk op, no single-row identity)", () => {
  assert.deepEqual(
    computePathsToInvalidate({ contentType: "blog-post", realm: "feezy" }),
    ["/blog"],
  );
});

test("singleton (site-settings) → no paths (layout tag handles the cascade)", () => {
  assert.deepEqual(
    computePathsToInvalidate({ contentType: "site-settings", realm: "feezy" }),
    [],
  );
});

test("singleton (navigation) → no paths (layout tag handles the cascade)", () => {
  assert.deepEqual(
    computePathsToInvalidate({ contentType: "navigation", realm: "feezy" }),
    [],
  );
});

test("v0.2.2 cascade: author → /blog (any /blog/* may render the byline)", () => {
  assert.deepEqual(
    computePathsToInvalidate({
      contentType: "author",
      slug: "jane-doe",
      realm: "feezy",
    }),
    ["/blog"],
  );
});

test("v0.2.2 cascade: tag → /blog (chips on the index)", () => {
  assert.deepEqual(
    computePathsToInvalidate({
      contentType: "tag",
      slug: "javascript",
      realm: "feezy",
    }),
    ["/blog"],
  );
});

test("v0.2.2 cascade: category → /blog (labels on the index)", () => {
  assert.deepEqual(
    computePathsToInvalidate({
      contentType: "category",
      slug: "fee-collection",
      realm: "feezy",
    }),
    ["/blog"],
  );
});

test("v0.2.2: page with slug → /<slug> (revalidate the page's own route)", () => {
  assert.deepEqual(
    computePathsToInvalidate({
      contentType: "page",
      slug: "about",
      realm: "feezy",
    }),
    ["/about"],
  );
});

test("page without slug → no paths (bulk op, ambiguous target)", () => {
  assert.deepEqual(
    computePathsToInvalidate({ contentType: "page", realm: "feezy" }),
    [],
  );
});

test("unknown content type (e.g. media) → no paths (tag fallback only)", () => {
  assert.deepEqual(
    computePathsToInvalidate({
      contentType: "media",
      slug: "logo.png",
      realm: "feezy",
    }),
    [],
  );
});

test("realm field is ignored for default path mapping (single-realm sites)", () => {
  // Today both realms produce identical paths. Future per-realm subpaths
  // can override via `pathsFor` on the handler without changing this default.
  const a = computePathsToInvalidate({
    contentType: "blog-post",
    slug: "x",
    realm: "feezy",
  });
  const b = computePathsToInvalidate({
    contentType: "blog-post",
    slug: "x",
    realm: "techademy",
  });
  assert.deepEqual(a, b);
});
