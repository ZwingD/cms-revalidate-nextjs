# Changelog

All notable changes to this package will be documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
