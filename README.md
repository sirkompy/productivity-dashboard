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
