import { revalidateTag, revalidatePath } from 'next/cache';
import { createHmac, timingSafeEqual } from 'crypto';

// src/createRevalidateHandler.ts

// src/computePaths.ts
function computePathsToInvalidate(input) {
  const { contentType, slug } = input;
  if (contentType === "blog-post") {
    return slug ? ["/blog", `/blog/${slug}`] : ["/blog"];
  }
  return [];
}

// src/computeTags.ts
var SINGLETONS = /* @__PURE__ */ new Set([
  "site-settings",
  "navigation"
]);
function computeTagsToInvalidate(input) {
  const { contentType, slug, realm } = input;
  if (SINGLETONS.has(contentType)) return [`${realm}:${contentType}`];
  if (slug) {
    return [
      `${realm}:${contentType}:${slug}`,
      `${realm}:${contentType}:list`
    ];
  }
  return [`${realm}:${contentType}:list`];
}

// src/types.ts
var MAX_PAYLOAD_VERSION = 1;
var DEFAULT_REPLAY_WINDOW_MS = 5 * 60 * 1e3;
function verifyWebhook(rawBody, signatureHeader, secret, replayWindowMs = DEFAULT_REPLAY_WINDOW_MS) {
  if (!secret) return { ok: false, status: 500 };
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const sig = Buffer.from(signatureHeader);
  const exp = Buffer.from(expected);
  if (sig.length !== exp.length || !timingSafeEqual(sig, exp)) {
    return { ok: false, status: 401 };
  }
  let occurredAt;
  try {
    occurredAt = JSON.parse(rawBody).occurredAt;
  } catch {
    occurredAt = void 0;
  }
  const ts = occurredAt ? Date.parse(occurredAt) : NaN;
  if (Number.isNaN(ts) || Date.now() - ts > replayWindowMs) {
    return { ok: false, status: 409 };
  }
  return { ok: true };
}

// src/createRevalidateHandler.ts
function createRevalidateHandler(options) {
  const replayWindowMs = options.replayWindowMs ?? DEFAULT_REPLAY_WINDOW_MS;
  const tagsFn = options.tagsFor ?? computeTagsToInvalidate;
  const pathsFn = options.pathsFor ?? computePathsToInvalidate;
  return async function POST(req) {
    const body = await req.text();
    const sig = req.headers.get("x-cms-signature") ?? "";
    const v = verifyWebhook(body, sig, options.secret, replayWindowMs);
    if (!v.ok) return new Response("rejected", { status: v.status });
    let p;
    try {
      p = JSON.parse(body);
    } catch {
      return new Response("ok", { status: 200 });
    }
    if (typeof p.payloadVersion === "number" && p.payloadVersion > MAX_PAYLOAD_VERSION) {
      return new Response("upgrade required", { status: 426 });
    }
    const realm = p.tenantRealm ?? options.realm;
    if (!p.contentType) return new Response("ok", { status: 200 });
    try {
      for (const tag of tagsFn({
        contentType: p.contentType,
        slug: p.slug,
        realm
      })) {
        revalidateTag(tag);
      }
      for (const path of pathsFn({
        contentType: p.contentType,
        slug: p.slug,
        realm
      })) {
        revalidatePath(path);
      }
    } catch {
      return new Response("ok", { status: 200 });
    }
    return new Response("ok", { status: 200 });
  };
}

export { DEFAULT_REPLAY_WINDOW_MS, MAX_PAYLOAD_VERSION, computePathsToInvalidate, computeTagsToInvalidate, createRevalidateHandler, verifyWebhook };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map