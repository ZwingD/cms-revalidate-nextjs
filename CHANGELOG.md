# Changelog

All notable changes to this package will be documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1] — 2026-05-27

### Added

- **Hardening: `MAX_ITEMS_PER_PAYLOAD = 1000` ceiling on `items[]`.** cms-backend's coalesce window caps batches at 500 (Sprint 10A spec); the package now enforces 2× headroom and drops anything beyond the cap rather than processing it. Overflow logs a single `console.warn` per process. Behaviour is graceful — never 500 a webhook (spec §7).
- `MAX_ITEMS_PER_PAYLOAD` exported from the package entrypoint for consumer reference.

### Note

- `v0.2.0` was tagged on GitHub (commit `6d5f712`) but never published to npm (publish call needed 2FA that wasn't available at the time). `v0.2.1` is the first npm-published release of the v2-payload-aware receiver; functionally identical to the intended `v0.2.0` plus the items cap.

## [0.2.0] — 2026-05-25 (never published to npm)

### Added

- **`payloadVersion: 2` support.** Handler accepts coalesced webhook payloads carrying `items[]` (per Sprint 10A `blog-scale-hardening-10k` plan). Tags + paths are computed per item, deduped via `Set`, then revalidated once per unique entry.
- v1 single-item payloads (no `items`, no `payloadVersion`) keep working unchanged — strictly backward compatible.

## [0.1.0-dev.0] — 2026-05-23

### Added

- Initial scaffold extracted from `feezy.one`'s production `apps/feezy-website/app/api/revalidate/` implementation.
- `createRevalidateHandler(options)` — primary factory that returns a Next.js App Router `POST` handler.
- `computeTagsToInvalidate` — dual-tag rule for slugged content + bare tag for singletons.
- `computePathsToInvalidate` — defense-in-depth path revalidation (currently maps `blog-post` only).
- `verifyWebhook` — length-safe HMAC-SHA256 + replay-window check.
- `payloadVersion` compatibility latch (returns HTTP 426 for newer schemas than `MAX_PAYLOAD_VERSION`).
- Ported test suite from `feezy-website`: 8 tag cases, 7 path cases, 7 verify cases (22 total — all pure-helper coverage).
- README with consumer usage, env-var contract, failure-mode table.

### Known coverage gaps

- **Handler integration tests deferred.** Mocking `next/cache` cleanly in raw Node 22 fought with the ESM resolver (`next/cache` resolves only inside a Next runtime). The handler wrapper is 30 lines of glue that calls the (fully tested) pure helpers; its production behavior was verified end-to-end on feezy.one on 2026-05-23 (L-10 verification: T+19s save → fresh title on /blog). Adding handler unit tests is a v0.2 follow-up — likely via a `__setCacheFunctions` test-only injection point.

### Not yet released

- Not published to npm. Awaiting `@zwingd` scope provisioning + publish token.
