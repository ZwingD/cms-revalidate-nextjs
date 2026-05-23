// src/index.ts
/**
 * Public entrypoint for @zwingd/cms-revalidate-nextjs.
 *
 * The primary API is `createRevalidateHandler`. The helper exports
 * (`computeTagsToInvalidate`, `computePathsToInvalidate`,
 * `verifyWebhook`) are surfaced for advanced consumers who need to
 * extend or compose the default behavior — e.g. emitting a custom path
 * set for a non-blog content type, or testing the contract in isolation.
 */
export { createRevalidateHandler } from "./createRevalidateHandler.ts";
export { computeTagsToInvalidate } from "./computeTags.ts";
export { computePathsToInvalidate } from "./computePaths.ts";
export { verifyWebhook } from "./verifyWebhook.ts";

export {
  DEFAULT_REPLAY_WINDOW_MS,
  MAX_PAYLOAD_VERSION,
} from "./types.ts";

export type {
  HandlerOptions,
  PathComputeInput,
  TagComputeInput,
  VerifyResult,
  WebhookPayload,
} from "./types.ts";
