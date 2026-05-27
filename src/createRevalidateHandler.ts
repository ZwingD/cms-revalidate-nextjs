// src/createRevalidateHandler.ts
/**
 * Factory that returns a Next.js App Router `POST` route handler for
 * `/api/revalidate`. Verifies HMAC, parses the payload, then calls
 * `revalidateTag` for each computed tag and `revalidatePath` for each
 * computed path.
 *
 * Usage in a Next.js consumer:
 *
 *   // app/api/revalidate/route.ts
 *   import { createRevalidateHandler } from "@zwingd/cms-revalidate-nextjs";
 *   export const POST = createRevalidateHandler({
 *     secret: process.env.CMS_WEBHOOK_SECRET!,
 *     realm: process.env.CMS_TENANT_REALM!,
 *   });
 *
 * Design notes:
 * - Never 500s a webhook (spec §7). All internal errors after HMAC
 *   verification ack with 200 so cms-backend doesn't retry-storm a bug
 *   on the consumer side.
 * - HMAC failures and replay-window violations DO return 4xx so
 *   cms-backend can surface them in its delivery logs.
 * - `payloadVersion` is checked early: if a future cms-backend emits a
 *   version this package doesn't understand, the handler returns 426
 *   so the misconfig is loud and the user is steered to upgrade the
 *   package.
 */
import { revalidatePath, revalidateTag } from "next/cache";

import { computePathsToInvalidate } from "./computePaths.ts";
import { computeTagsToInvalidate } from "./computeTags.ts";
import {
  DEFAULT_REPLAY_WINDOW_MS,
  MAX_ITEMS_PER_PAYLOAD,
  MAX_PAYLOAD_VERSION,
} from "./types.ts";
import type { HandlerOptions, WebhookPayload } from "./types.ts";
import { verifyWebhook } from "./verifyWebhook.ts";

let overflowWarned = false;

export function createRevalidateHandler(
  options: HandlerOptions,
): (req: Request) => Promise<Response> {
  const replayWindowMs = options.replayWindowMs ?? DEFAULT_REPLAY_WINDOW_MS;
  const tagsFn = options.tagsFor ?? computeTagsToInvalidate;
  const pathsFn = options.pathsFor ?? computePathsToInvalidate;

  return async function POST(req: Request): Promise<Response> {
    const body = await req.text();
    const sig = req.headers.get("x-cms-signature") ?? "";
    const v = verifyWebhook(body, sig, options.secret, replayWindowMs);
    if (!v.ok) return new Response("rejected", { status: v.status });

    let p: WebhookPayload;
    try {
      p = JSON.parse(body) as WebhookPayload;
    } catch {
      // Spec §7: never 500 a webhook. Malformed body acks 200 so the
      // sender doesn't retry-storm — bad payloads are a sender bug.
      return new Response("ok", { status: 200 });
    }

    // Version-compat check: reject payloads newer than this package
    // understands so the misconfig is loud, not silent.
    if (
      typeof p.payloadVersion === "number" &&
      p.payloadVersion > MAX_PAYLOAD_VERSION
    ) {
      return new Response("upgrade required", { status: 426 });
    }

    const realm = p.tenantRealm ?? options.realm;

    // v0.2.0 (Sprint 10A Task 11) — v2 coalesced payloads carry
    // `items[]` and `payloadVersion: 2`. Iterate, dedupe tags + paths
    // via Set, then call revalidateTag/Path once per unique entry.
    // v1 payloads (no `items`) fall through to the legacy single-item
    // path below — byte-identical to v0.1.x behaviour.
    if (p.items && Array.isArray(p.items) && p.items.length > 0) {
      // v0.2.1 — bound items to MAX_ITEMS_PER_PAYLOAD. cms-backend's
      // coalesce window caps batches at 500, so anything over the
      // package ceiling (2× headroom) is a sender bug or hostile
      // payload. Process the first slice deterministically and warn
      // once per process so the issue surfaces in logs without
      // flooding.
      let items = p.items;
      if (items.length > MAX_ITEMS_PER_PAYLOAD) {
        if (!overflowWarned) {
          overflowWarned = true;
          console.warn(
            `[cms-revalidate] items[] length ${items.length} exceeds ` +
              `MAX_ITEMS_PER_PAYLOAD (${MAX_ITEMS_PER_PAYLOAD}); ` +
              `processing first ${MAX_ITEMS_PER_PAYLOAD} only.`,
          );
        }
        items = items.slice(0, MAX_ITEMS_PER_PAYLOAD);
      }

      try {
        const tags = new Set<string>();
        const paths = new Set<string>();
        for (const item of items) {
          if (!item.contentType) continue;
          for (const tag of tagsFn({
            contentType: item.contentType,
            slug: item.slug,
            realm,
          })) {
            tags.add(tag);
          }
          for (const path of pathsFn({
            contentType: item.contentType,
            slug: item.slug,
            realm,
          })) {
            paths.add(path);
          }
        }
        for (const tag of tags) revalidateTag(tag);
        for (const path of paths) revalidatePath(path);
      } catch {
        return new Response("ok", { status: 200 });
      }
      return new Response("ok", { status: 200 });
    }

    if (!p.contentType) return new Response("ok", { status: 200 });

    try {
      for (const tag of tagsFn({
        contentType: p.contentType,
        slug: p.slug,
        realm,
      })) {
        revalidateTag(tag);
      }
      for (const path of pathsFn({
        contentType: p.contentType,
        slug: p.slug,
        realm,
      })) {
        revalidatePath(path);
      }
    } catch {
      // revalidateTag/revalidatePath failure: ack the webhook anyway
      // (spec §7). The signal that something is wrong lives in Sentry
      // or platform logs, not in a 500 to the sender.
      return new Response("ok", { status: 200 });
    }
    return new Response("ok", { status: 200 });
  };
}
