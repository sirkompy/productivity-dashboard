# Milestone 1 — Social Data Foundation

## Goal

Build the first production-ready data foundation for creator monitoring.

This milestone must let us:
1. maintain a watchlist of creators;
2. ingest public LinkedIn and Instagram data through ScrapeCreators;
3. normalize provider responses into our own schema;
4. store creators, posts and metric snapshots in PostgreSQL/Supabase;
5. backfill enough history to establish a creator baseline;
6. calculate outlier scores without using an LLM;
7. keep provider-specific code isolated so LinkedIn can later fall back to Apify/Clay without changing downstream code.

Do not build publishing, content generation, UI, Telegram, X, comments mining, or OpenAI editing in this milestone.

## Architectural principles

- PostgreSQL is the source of truth. Supabase is only the initial managed host.
- Business logic must not depend on Supabase-specific features.
- All social providers sit behind a common interface.
- Preserve source URLs and provider metadata.
- Idempotent ingestion: rerunning a backfill must not duplicate posts.
- Metric history is append-only snapshots.
- Do not send every post to an LLM.
- Comments are optional enrichment and are out of scope for Milestone 1.
- LinkedIn fallback is intentionally not implemented yet; only make the provider abstraction ready for it.

## Recommended stack

Use TypeScript on Node.js.

Prefer a minimal backend/worker-oriented structure rather than a full frontend framework.

Suggested dependencies:
- TypeScript
- Zod for runtime validation
- PostgreSQL driver / lightweight query layer
- migration tooling
- Vitest or equivalent for tests

Avoid a heavy ORM unless there is a clear reason.

## Core domain model

### creators
- id
- display_name
- primary_topic
- creator_type: educator | performer | both
- priority
- active
- created_at
- updated_at

### creator_accounts
- id
- creator_id
- platform: linkedin | instagram
- handle
- profile_url
- provider
- provider_external_id nullable
- followers_count nullable
- last_collected_at nullable
- metadata jsonb
- created_at
- updated_at
- unique(platform, profile_url)

### posts
- id
- creator_account_id
- platform
- provider
- provider_post_id nullable
- canonical_url
- published_at
- text nullable
- media_type nullable
- raw_metadata jsonb
- first_seen_at
- last_seen_at
- unique(platform, canonical_url)

### post_metric_snapshots
- id
- post_id
- captured_at
- views nullable
- likes nullable
- comments nullable
- shares nullable
- reposts nullable
- saves nullable
- raw_metrics jsonb
- unique(post_id, captured_at)

### transcripts
- id
- post_id
- provider
- text
- language nullable
- captured_at
- metadata jsonb

### outlier_scores
- id
- post_id
- calculated_at
- baseline_window
- baseline_metric
- baseline_median
- post_metric_value
- multiplier
- bucket: normal | mild | strong | huge
- confidence: low | medium | high
- details jsonb

## Provider interface

Create a provider-neutral contract conceptually equivalent to:

- getCreator(profileUrlOrHandle)
- getCreatorPosts(profileUrlOrHandle, options)
- getPost(postUrl)
- getTranscript(postUrl)

Return normalized domain DTOs, never raw provider payloads to downstream logic.

Provider implementation for this milestone:
- ScrapeCreatorsProvider

Prepare interfaces so later we can add:
- ApifyLinkedInProvider
- XProvider
- TelegramProvider

## ScrapeCreators integration

Use SCRAPECREATORS_API_KEY from environment.

Requirements:
- central HTTP client
- timeout handling
- retry only for safe transient failures
- explicit error classes
- rate-limit aware behavior
- runtime validation of important response fields
- preserve raw metadata for debugging without coupling the domain to the provider
- never log API keys

Target initially:
- Instagram profile/posts/post/transcript
- LinkedIn public profile/recent posts/post/transcript where supported by the current API

Do not assume every LinkedIn profile exposes a complete feed. Missing posts must be represented as a provider limitation, not silently treated as an empty creator history.

## Backfill workflow

Input: active creator account.

1. fetch creator/profile;
2. update account metadata;
3. fetch available recent posts;
4. upsert each post by platform + canonical URL;
5. append a metric snapshot;
6. if the same run sees the same post twice, do not duplicate it;
7. return a run summary:
   - creator
   - discovered
   - inserted
   - updated
   - snapshots created
   - provider warnings/errors

Target baseline:
- attempt 20–50 recent posts per creator where the provider permits it.

## Outlier engine

No LLM.

Compute baseline separately per creator account and, where practical, per content format.

Primary approach:
- median over recent comparable posts;
- minimum sample under 10 => low confidence;
- 10–19 => medium confidence;
- 20+ => high confidence.

Directional buckets:
- <1.5x = normal
- 1.5x–<2x = mild
- 2x–<5x = strong
- 5x+ = huge

The chosen baseline metric must be explicit in the stored score.

Do not claim causality. This layer only detects performance deviation.

## CLI / worker entry points

Provide commands or worker functions for:
- ingest one creator account;
- ingest all active accounts;
- recompute outliers for one creator;
- recompute all outliers.

Commands must have dry-run support where mutations are meaningful.

## Configuration

Update .env.example with placeholders for:
- DATABASE_URL
- SCRAPECREATORS_API_KEY

No secrets in git.

## Tests

At minimum:
- normalization tests;
- idempotent post upsert;
- metric snapshot behavior;
- median/outlier bucket logic;
- low/medium/high confidence rules;
- provider error handling using mocked responses;
- rerunning a backfill does not duplicate posts.

## Deliverables

- package configuration / TypeScript project scaffold
- database migrations
- domain types/schemas
- SocialDataProvider interface
- ScrapeCreators provider
- repository/data access layer
- backfill service
- outlier service
- CLI or worker entry points
- tests
- README section with local setup and commands

## Acceptance criteria

Milestone 1 is complete when:

1. A fresh local database can be created entirely from migrations.
2. A creator account can be added to the watchlist.
3. Running ingestion against a supported public Instagram/LinkedIn account stores normalized posts and metric snapshots.
4. Rerunning ingestion is idempotent for posts.
5. Outlier scores can be calculated from stored data without an LLM.
6. Provider failures are visible and do not corrupt stored data.
7. ScrapeCreators-specific fields do not leak into downstream service contracts.
8. Tests pass.
9. The implementation is ready for a later LinkedIn fallback provider without a schema rewrite.

## Explicitly out of scope

- frontend/dashboard screens
- publishing
- OpenAI API editing
- content generation
- comments mining
- Telegram
- X
- Apify/Clay integration
- automated scheduling
- creator discovery

These belong to later milestones after we validate real LinkedIn/Instagram data quality.
