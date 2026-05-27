// tests/computeTags.test.ts
/**
 * Ported from feezy-website's `app/api/revalidate/_tags.test.ts`.
 *
 * Issue #3 (the stale-index regression) hinged on whether a slug'd
 * webhook payload produces BOTH the detail tag AND the list tag.
 * Without these tests a future refactor could silently drop the
 * list-tag arm (causing /blog to stay stale on edits while detail pages
 * still work). Pairs with cms-backend's webhook-firing regression test
 * which asserts the wire body that drives these inputs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { computeTagsToInvalidate } from "../src/computeTags.ts";

test("issue #3: slug'd blog-post payload returns BOTH detail-tag AND list-tag", () => {
  const tags = computeTagsToInvalidate({
    contentType: "blog-post",
    slug: "closeout-probe-2026-05-23-renamed",
    realm: "feezy",
  });
  assert.deepEqual(tags, [
    "feezy:blog-post:closeout-probe-2026-05-23-renamed",
    "feezy:blog-post:list",
  ]);
});

test("slug'd payload — order is detail-tag first, list-tag second", () => {
  const tags = computeTagsToInvalidate({
    contentType: "blog-post",
    slug: "abc",
    realm: "feezy",
  });
  assert.equal(tags.length, 2);
  assert.equal(tags[0], "feezy:blog-post:abc");
  assert.equal(tags[1], "feezy:blog-post:list");
});

test("slug'd payload WITHOUT slug — list-tag only", () => {
  const tags = computeTagsToInvalidate({
    contentType: "blog-post",
    realm: "feezy",
  });
  assert.deepEqual(tags, ["feezy:blog-post:list"]);
});

test("singleton site-settings — bare tag + layout cascade tag (v0.2.2)", () => {
  // v0.2.2 cascade: singletons render in every page's layout. Bust the
  // singleton tag for direct consumers + a generic `layout` tag for
  // consumers that tag every page's layout fetch with one tag.
  const tags = computeTagsToInvalidate({
    contentType: "site-settings",
    realm: "feezy",
  });
  assert.deepEqual(tags, ["feezy:site-settings", "feezy:layout"]);
});

test("singleton navigation — bare tag + layout cascade tag (v0.2.2)", () => {
  const tags = computeTagsToInvalidate({
    contentType: "navigation",
    realm: "feezy",
  });
  assert.deepEqual(tags, ["feezy:navigation", "feezy:layout"]);
});

test("singleton with slug present — slug is ignored (bare tag + layout only)", () => {
  // Defensive: even if cms-backend accidentally emits a slug for a
  // singleton, the FE collapses to the singleton tag — never indexes
  // a slug under a singleton content type.
  const tags = computeTagsToInvalidate({
    contentType: "site-settings",
    slug: "shouldnt-be-here",
    realm: "feezy",
  });
  assert.deepEqual(tags, ["feezy:site-settings", "feezy:layout"]);
});

test("different realm — realm prefix carries through both tags", () => {
  const tags = computeTagsToInvalidate({
    contentType: "blog-post",
    slug: "abc",
    realm: "techademy",
  });
  assert.deepEqual(tags, [
    "techademy:blog-post:abc",
    "techademy:blog-post:list",
  ]);
});

test("category without slug — list-tag + blog-post:list cascade (v0.2.2)", () => {
  // v0.2.2 cascade rule: category renders on every blog post (label
  // chip) AND on the blog index (filter). Bulk category op without
  // a single-row identity still busts blog-post:list so the index
  // refreshes.
  const tags = computeTagsToInvalidate({
    contentType: "category",
    realm: "feezy",
  });
  assert.deepEqual(tags, ["feezy:category:list", "feezy:blog-post:list"]);
});

test("v0.2.2 cascade: author with slug → detail + list + blog-post:list", () => {
  // Author bio / socials edit must refresh every blog post page that
  // shows the byline. The blog-post:list tag busts the blog index;
  // individual /blog/<slug> pages refresh too IF the consumer tagged
  // each post's fetch with `feezy:author:<slug>`.
  const tags = computeTagsToInvalidate({
    contentType: "author",
    slug: "jane-doe",
    realm: "feezy",
  });
  assert.deepEqual(tags, [
    "feezy:author:jane-doe",
    "feezy:author:list",
    "feezy:blog-post:list",
  ]);
});

test("v0.2.2 cascade: tag with slug → detail + list + blog-post:list", () => {
  const tags = computeTagsToInvalidate({
    contentType: "tag",
    slug: "javascript",
    realm: "feezy",
  });
  assert.deepEqual(tags, [
    "feezy:tag:javascript",
    "feezy:tag:list",
    "feezy:blog-post:list",
  ]);
});

test("v0.2.2 cascade: category with slug → detail + list + blog-post:list", () => {
  const tags = computeTagsToInvalidate({
    contentType: "category",
    slug: "fee-collection",
    realm: "feezy",
  });
  assert.deepEqual(tags, [
    "feezy:category:fee-collection",
    "feezy:category:list",
    "feezy:blog-post:list",
  ]);
});

test("v0.2.2 cascade order — detail first, own list second, blog-post:list third", () => {
  // Order matters for log readability + for consumers that bail early.
  // Detail tag carries the most specific identity; own list rebuilds
  // the entity's own archive; blog-post:list is the secondary cascade.
  const tags = computeTagsToInvalidate({
    contentType: "author",
    slug: "abc",
    realm: "feezy",
  });
  assert.equal(tags.length, 3);
  assert.equal(tags[0], "feezy:author:abc");
  assert.equal(tags[1], "feezy:author:list");
  assert.equal(tags[2], "feezy:blog-post:list");
});

test("non-cascade content type (page) — own tags only, no blog-post cascade", () => {
  // Regression guard — only author/tag/category cascade into the blog
  // tag space. A page edit must NOT bust blog-post:list.
  const tags = computeTagsToInvalidate({
    contentType: "page",
    slug: "about",
    realm: "feezy",
  });
  assert.deepEqual(tags, ["feezy:page:about", "feezy:page:list"]);
});

test("non-cascade content type (course-landing) — own tags only", () => {
  const tags = computeTagsToInvalidate({
    contentType: "course-landing",
    slug: "iit-jee",
    realm: "feezy",
  });
  assert.deepEqual(tags, [
    "feezy:course-landing:iit-jee",
    "feezy:course-landing:list",
  ]);
});
