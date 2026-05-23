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

test("singleton site-settings — bare tag, no slug, no list", () => {
  const tags = computeTagsToInvalidate({
    contentType: "site-settings",
    realm: "feezy",
  });
  assert.deepEqual(tags, ["feezy:site-settings"]);
});

test("singleton navigation — bare tag, no slug, no list", () => {
  const tags = computeTagsToInvalidate({
    contentType: "navigation",
    realm: "feezy",
  });
  assert.deepEqual(tags, ["feezy:navigation"]);
});

test("singleton with slug present — slug is ignored (bare tag only)", () => {
  // Defensive: even if cms-backend accidentally emits a slug for a
  // singleton, the FE collapses to the singleton tag — never indexes
  // a slug under a singleton content type.
  const tags = computeTagsToInvalidate({
    contentType: "site-settings",
    slug: "shouldnt-be-here",
    realm: "feezy",
  });
  assert.deepEqual(tags, ["feezy:site-settings"]);
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

test("non-singleton non-slug content type (e.g. category) — list-tag only", () => {
  const tags = computeTagsToInvalidate({
    contentType: "category",
    realm: "feezy",
  });
  assert.deepEqual(tags, ["feezy:category:list"]);
});
