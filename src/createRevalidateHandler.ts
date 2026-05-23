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
  MAX_PAYLOAD_VERSION,
} from "./types.ts";
import type { HandlerOptions, WebhookPayload } from "./types.ts";
import { verifyWebhook } from "./verifyWebhook.ts";

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
