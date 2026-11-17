# Productivity Dashboard

Private workspace for the personal productivity, outreach, research, and content automation system.

## Content system

The core content stack is built around four internal skills:

1. **personal-brand-strategy** — positioning, audience, topic boundaries, voice.
2. **content-intelligence** — research, competitor intelligence, signals, idea scoring.
3. **personal-brand-writer** — master drafts and platform-specific LinkedIn, X, and Telegram versions.
4. **content-operator** — queues, versions, approval gates, publishing, analytics, and feedback loops.

## Social Intelligence

The creator-analysis layer adds five local skills:

- **creator-outlier-analysis** — find posts that beat a creator's own baseline.
- **competitor-social-intelligence** — compare creators/competitors and identify repeatable patterns and gaps.
- **social-comment-mining** — extract questions, objections, reactions and audience language from comments.
- **social-transcript-intelligence** — analyze spoken content, hooks, claims, stories and CTAs.
- **viral-mechanism-analysis** — reverse-engineer the mechanism behind an overperforming post without copying it.

The upstream ScrapeCreators research pack and social-media-skills repository are pinned as reference/data layers. Live ScrapeCreators collection requires `SCRAPECREATORS_API_KEY`.

## External components

Pinned in `config/content-stack.sources.json`:

- coreyhaines31/marketingskills
- unclecode/crawl4ai
- dgtlmoon/changedetection.io
- AgriciDaniel/claude-seo
- gitroomhq/postiz-app
- ScrapeCreators/social-media-research-skills
- social-media-skills/skills

Run `scripts/bootstrap-content-stack.sh` locally to clone/update the external components into `.vendor/`. The vendor directory is intentionally not committed.

## Principle

Research and drafting may be automated. Publishing stays human-approved until explicit publishing guardrails are configured.

Creator research is baseline-aware and evidence-backed: compare an account against itself, preserve source URLs, distinguish observed data from inference, and learn mechanisms rather than copying posts.

## Milestone 1: Social Data Foundation

A minimal TypeScript/Node.js worker stores public Instagram and LinkedIn research
in PostgreSQL. It has no frontend and no publishing workflow. Existing skills and
content architecture remain unchanged. See
[implementation notes](docs/social-data-implementation.md) for provider assumptions
and baseline policy.

### Local setup

Requirements: Node.js 22+, npm, and PostgreSQL 14+ (a normal PostgreSQL server or a
Supabase PostgreSQL connection). Create a dedicated database using your PostgreSQL
administration tools. No Supabase SDK or Supabase-specific features are used.

```bash
npm ci
cp .env.example .env
# Fill DATABASE_URL and, for live ingestion, SCRAPECREATORS_API_KEY securely.
npm run migrate
npm run typecheck
npm test
npm run build
```

The CLI loads `.env` when present; exported environment variables take precedence.
Use TLS verification for hosted databases (for example, `sslmode=verify-full` and
an appropriate trusted CA). Do not disable certificate verification. Tests do not
need credentials or a running database: they use mocked HTTP and PGlite's embedded
PostgreSQL engine, including SQL migrations, transactions, constraints and triggers.

### Watchlist and worker commands

```bash
npm run watchlist:add -- --platform instagram --url https://www.instagram.com/example/ --name "Example" --topic "B2B GTM" --type both
npm run watchlist:add -- --platform linkedin --url https://www.linkedin.com/in/example/ --name "Example" --topic "B2B GTM" --type educator
# Use the returned accountId and creatorId below.
npm run ingest -- --account ACCOUNT_UUID --limit 30 --dry-run
npm run ingest -- --account ACCOUNT_UUID --limit 30
npm run ingest -- --all
npm run outliers -- --creator CREATOR_UUID --metric likes --dry-run
npm run outliers -- --creator CREATOR_UUID --metric likes
npm run outliers -- --all --metric views
```

`watchlist:add`, `ingest`, and `outliers` support `--dry-run`. Ingestion dry runs
still make provider requests and may consume API credits, but write nothing.
Their inserted/updated/snapshot counts remain zero; `discovered` reports unique
normalized posts. Normal runs return creator/account IDs, discovered, inserted,
updated, snapshots created, completeness, warnings and errors. A failed account
sets a nonzero CLI exit status; `--all` continues ingesting the other accounts.
The watchlist is idempotent by platform and canonical profile URL. To deactivate a
creator, set `creators.active=false` using a parameterized SQL administration tool.
Only active creators participate in ingestion/recomputation.

SQL migrations live in `migrations/` and run in filename order in a transaction,
with a PostgreSQL advisory lock and SHA-256 checksum ledger (`schema_migrations`).
Reruns are safe; modifying an already applied migration is rejected. Add a new
numbered migration for future changes. `001_social_data.sql` creates `creators`,
`creator_accounts`, `posts`, `post_metric_snapshots`, `transcripts`, `outlier_scores`,
constraints, indexes and the append-only metric trigger. UUIDs are generated by
Node.js; no database extensions are needed. Migration dry-run is intentionally
unsupported; test migrations on a disposable database.

Live verification against your hosted database and ScrapeCreators account requires
`DATABASE_URL` and `SCRAPECREATORS_API_KEY`. The fixture tests establish local
behavior, not current live provider availability or completeness.
