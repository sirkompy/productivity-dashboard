# Social Data Foundation implementation notes

The milestone specification remains `milestone-1-social-data-foundation.md`.

## Architecture

- `src/domain/types.ts`: Zod-validated posts/metrics and provider-neutral DTOs.
- `src/providers/`: central safe GET client, explicit provider errors,
  ScrapeCreators adapter and defensive normalization. Opaque metadata is preserved
  for debugging; services never interpret upstream fields.
- `src/db/`: portable parameterized PostgreSQL access, transaction boundaries,
  checksum-protected SQL migration runner.
- `src/services/`: transactional backfills and deterministic median outlier scoring.
- `src/cli.ts`: watchlist, migrations, single/all ingestion and creator/all scoring.
- `tests/`: synthetic fixture normalization and HTTP tests, outlier boundaries,
  embedded PostgreSQL migration/persistence tests. Vendor tests are excluded.

No provider, database or HTTP call is needed by the pure outlier engine. Additional
providers can implement `SocialDataProvider` without changing storage or services.
`getTranscript()` is exposed and `Repository.saveTranscript()` persists normalized
transcripts; automatic transcript enrichment is not part of a baseline backfill.

## Provider routes and assumptions

Endpoint routes and pagination names are based on the repository's pinned
`ScrapeCreators/social-media-research-skills` reference at
`64ba7b4dea71e130d2712ffb6c1c1024b3b7c4b2`. The hosted docs returned HTTP 403 during
implementation, and no live API key was available. Fixtures are synthetic,
**not recorded live responses**. Verify the routes and fixtures with current
provider responses before relying on live collection in production.

| Capability   | Instagram                                       | LinkedIn                                                                                                         |
| ------------ | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Profile      | `/v1/instagram/profile?handle=`                 | `/v1/linkedin/profile?url=` or `/v1/linkedin/company?url=`                                                       |
| Recent posts | `/v2/instagram/user/posts?handle=&next_max_id=` | `/v1/linkedin/company/posts?url=&page=` for companies; embedded `recentPosts`/`posts` only for personal profiles |
| Single post  | `/v1/instagram/post?url=`                       | `/v1/linkedin/post?url=`                                                                                         |
| Transcript   | `/v2/instagram/media/transcript?url=`           | `/v1/linkedin/post/transcript?url=`                                                                              |

The pinned reference does not document a standalone personal LinkedIn feed route.
An absent embedded feed raises an explicit `unsupported` error rather than returning
an empty complete history. All LinkedIn feeds carry partial-history warnings.
Bounded Instagram windows are also reported as partial: reaching a requested recent
window does not establish an entire account's history. Instagram pagination uses
`next_max_id`; company pagination advances `page` only when a more/next indicator
exists. Ten requests maximum prevent loops. Defaults request 30 unique posts;
CLI limits must be 20–50. Short windows and malformed posts generate warnings.

Supported defensive response variants:

- Profiles: root, `data`, `user`, or `data.user`; full name and follower count
  aliases used by common public profile payloads.
- Feeds: `items`/`posts` at root or under `data`; Instagram `node` wrappers.
- Posts: `url`, `permalink`, `postUrl`, `post_url`, `linkedinUrl`, or Instagram
  `code`/`shortcode`; epoch-second/millisecond `taken_at` or ISO publication time;
  captions, text, nullable format; common count aliases and nested metrics.
- Single posts: root, `post`, `data`, or `data.post`.
- Transcripts: text, a transcript string or arrays of text segments. Missing public
  transcripts are explicit unsupported results, not empty strings.

Unknown critical fields fail validation; missing counts remain null, never zero.
No synthetic publication dates or metrics are invented. Social URLs are validated,
tracking removed, host normalized, and Instagram reel/p aliases share a post key.
Only the adapter interprets provider-specific payload shapes. A new unrecognized
live shape should be added here with a sanitized regression fixture.

HTTP uses the environment-only `SCRAPECREATORS_API_KEY`, 30-second timeouts,
up to two retries for network failures, HTTP 429/500/502/503/504, exponential delay
and `Retry-After`. Long cooldowns are exposed rather than retried too early.
Authentication/validation/not-found failures are not retried. No raw upstream error
bodies, connection strings, headers or keys are logged. Redirects are rejected to
avoid forwarding credentials. No local OpenAI integration is used; the upstream
Instagram transcript service may itself use AI, as noted in the pinned reference.

## Persistence and scoring policy

A backfill retrieves and normalizes before writing. Each account's profile, posts
and snapshots commit atomically. Canonical `(platform, canonical_url)` uniqueness
prevents duplicate posts; a conflict owned by a different account aborts the
transaction instead of moving ownership. Account row locks serialize concurrent
backfills. One unique post is processed once per run; every new capture appends a
snapshot. A retry with the same `capturedAt` preserves the existing snapshot through
`ON CONFLICT DO NOTHING`. Updates/deletes of snapshots are forbidden by a database
trigger. Profile collection times are advanced only after successful persistence.
A partial feed may be persisted with its warnings; it never asserts full history.

Scores use each account independently and only older posts than the target,
excluding the target itself. Read up to 200 recent stored posts with their latest
metric capture; take at most 50 older comparable samples. Split by known media
format when at least 10 older metric-bearing posts of that format exist; otherwise
use the account baseline. Missing metrics are excluded. Default metric is `likes`
for cross-platform availability; select `views` explicitly for video analysis.
A missing or zero median produces a warning and no score (no infinite multipliers).
Confidence uses actual baseline samples: <10 low, 10–19 medium, >=20 high.
Buckets use exact boundaries: <1.5 normal, <2 mild, <5 strong, >=5 huge.
The stored baseline window is the actual sample count. Details include sampled post
IDs, format scope and window limit. Score recomputations append historical records;
select latest `calculated_at` per post for the latest result. Historical scoring uses
current latest metrics, not a reconstructed point-in-time metric history. Scores
measure performance deviation and do not claim causality.

## Verification boundaries

PGlite runs the actual schema, SQL constraints, triggers, transactions, backfills
and scoring queries. Its test adapter bypasses the server-only advisory lock and
uses the embedded engine's multi-statement executor for the migration body.
Hosted PostgreSQL connectivity/TLS, advisory locking across processes and live
provider shape/availability still need verification with real credentials.
