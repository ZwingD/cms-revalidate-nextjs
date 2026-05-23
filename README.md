# @zwingd/cms-revalidate-nextjs

Drop-in Next.js route handler + HMAC-verified webhook receiver for revalidating ISR pages when content changes in Zwingd CMS.

Use this in any tenant storefront that wants its `/blog`, `/page/:slug`, etc. to stay near-instant-fresh after editorial changes — without rolling your own HMAC verification, replay-window check, or dual-tag dispatch logic.

## Why

Zwingd CMS fires HMAC-signed webhooks at your storefront when content changes. Your storefront has to (a) verify the signature, (b) bound replay attacks, (c) invalidate the Next.js data-cache tags AND paths that map to the affected content. Hand-rolled, that's ~150 lines of code, three pure helpers, and a contract that has to stay in lockstep with cms-backend forever.

This package is the canonical implementation, lifted out of `feezy.one`'s production codebase.

## Install

```bash
pnpm add @zwingd/cms-revalidate-nextjs
# or: npm install / yarn add
```

Peer dependency: `next >= 14` (uses `revalidateTag` + `revalidatePath` from `next/cache`).

## Usage

Drop a 3-line route handler into your storefront:

```ts
// app/api/revalidate/route.ts
import { createRevalidateHandler } from "@zwingd/cms-revalidate-nextjs";

export const POST = createRevalidateHandler({
  secret: process.env.CMS_WEBHOOK_SECRET!,
  realm: process.env.CMS_TENANT_REALM!,
});
```

Then attach `next: { tags: [...] }` to the fetches that back your pages. The tag scheme matches what this package emits:

| Content type | Tag(s) you should attach to the fetch |
|---|---|
| `blog-post` detail page | `feezy:blog-post:<slug>` (substitute your realm) |
| `blog-post` list page (e.g. `/blog`) | `feezy:blog-post:list` |
| `site-settings` (singleton) | `feezy:site-settings` |
| `navigation` (singleton) | `feezy:navigation` |
| any other slugged type | `<realm>:<contentType>:<slug>` + `<realm>:<contentType>:list` |
| any other listed type | `<realm>:<contentType>:list` |

```ts
const res = await fetch(`${CMS_BASE}/api/v1/blog`, {
  headers: { realm: realm },
  next: { tags: [`${realm}:blog-post:list`] },
});
```

The list page should also carry an ISR backstop in case the cached HTML predates a tag-instrumented build:

```ts
// app/blog/page.tsx
export const revalidate = 30;
```

## Env vars the consumer storefront needs

| Variable | Required | Example | Notes |
|---|---|---|---|
| `CMS_BASE` | Yes | `https://cms-api-dev.zwingd.com` | Where your storefront fetches CMS data from. Set in Vercel project env. |
| `CMS_TENANT_REALM` | Yes | `techademy` | Your tenant slug — sent as the `realm` header on every CMS read. |
| `CMS_WEBHOOK_SECRET` | Yes | 32-byte hex | Shared HMAC secret. Must match what's registered for this tenant in cms-backend. |
| `CMS_BLOG_SOURCE` | No | `CMS` or `STATIC` | Application-level flag — your storefront's reader uses this. Not consumed by this package. |

## API

### `createRevalidateHandler(options)` — primary export

Returns a Next.js App Router `POST` handler.

```ts
type HandlerOptions = {
  secret: string;          // HMAC secret
  realm: string;           // fallback realm if payload omits tenantRealm
  replayWindowMs?: number; // default 5 * 60 * 1000
  tagsFor?: (input: TagComputeInput) => string[];   // override default tag rules
  pathsFor?: (input: PathComputeInput) => string[]; // override default path rules
};
```

Response codes:

| Status | When |
|---|---|
| 200 | Webhook handled (or harmlessly ignored — e.g. malformed body, missing contentType) |
| 401 | HMAC signature invalid |
| 409 | Timestamp outside the replay window (or missing) |
| 426 | Payload `payloadVersion` is newer than this package understands — upgrade |
| 500 | Handler misconfigured (no secret) |

### Helper exports (advanced)

- `computeTagsToInvalidate({ contentType, slug, realm })`
- `computePathsToInvalidate({ contentType, slug, realm })`
- `verifyWebhook(rawBody, signatureHeader, secret, replayWindowMs?)`
- `MAX_PAYLOAD_VERSION`, `DEFAULT_REPLAY_WINDOW_MS`

Use these to test your storefront's revalidation expectations in isolation, or to compose a custom handler that adds project-specific behavior on top.

## Failure modes & fixes

| Symptom | Likely cause | Fix |
|---|---|---|
| Detail page updates, list doesn't | Cached list HTML predates tag instrumentation | Confirm path revalidation is wired (default `pathsFor` covers `blog-post`); trigger one manual Vercel deploy to prime the edge cache |
| Webhook returns 401 | HMAC secret mismatch | Re-register the webhook in cms-backend with the same `CMS_WEBHOOK_SECRET` |
| Webhook returns 409 | Clock skew or stale payload | Sync clocks; or increase `replayWindowMs` in handler options |
| Webhook returns 426 | cms-backend emitting newer payload schema | Upgrade this package |

## Versioning

Semver-major bumps reserved for:

- Payload schema changes that break older handlers
- Breaking changes to the helper signatures
- Peer-dependency upgrades that move the floor (e.g. Next.js minimum)

The `payloadVersion` field in the webhook body is the compatibility latch — if a future cms-backend release emits `payloadVersion > MAX_PAYLOAD_VERSION` (currently 1), the handler responds 426 so misconfigurations are loud.

## Source

This package mirrors the production implementation in `feezy.one` (`apps/feezy-website/app/api/revalidate/`). Issue tracker: https://github.com/ZwingD/cms-revalidate-nextjs/issues
