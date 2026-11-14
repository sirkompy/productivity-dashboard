# Productivity Dashboard

Private workspace for the personal productivity, outreach, research, and content automation system.

## Content system

The content stack is built around four internal skills:

1. **personal-brand-strategy** — positioning, audience, topic boundaries, voice.
2. **content-intelligence** — research, competitor intelligence, signals, idea scoring.
3. **personal-brand-writer** — master drafts and platform-specific LinkedIn, X, and Telegram versions.
4. **content-operator** — queues, versions, approval gates, publishing, analytics, and feedback loops.

## External components

The first integration set is pinned in `config/content-stack.sources.json`:

- coreyhaines31/marketingskills
- unclecode/crawl4ai
- dgtlmoon/changedetection.io
- AgriciDaniel/claude-seo
- gitroomhq/postiz-app

Run `scripts/bootstrap-content-stack.sh` locally to clone/update the external components into `.vendor/`. The vendor directory is intentionally not committed.

## Principle

Research and drafting may be automated. Publishing stays human-approved until explicit publishing guardrails are configured.
