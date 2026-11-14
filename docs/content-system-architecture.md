# Content System Architecture v0.2

## Goal

Create an evidence-driven personal media system for LinkedIn, X and Telegram, surfaced inside the Productivity Dashboard.

## Logical layers

### 1. Sources
News, websites, competitors, public social profiles/posts/comments, podcasts, ecosystem activity, internal approved notes.

### 2. Collection
- Crawl4AI for structured crawling/retrieval
- changedetection.io for page-change signals
- ScrapeCreators-compatible public social data collection where configured
- direct APIs/connectors when available

### 3. Intelligence
- personal-brand-strategy
- content-intelligence
- competitor profiles and growth teardowns
- creator profile analysis
- outlier detection versus each creator's own baseline
- comment and transcript intelligence
- viral mechanism analysis
- SEO / GEO / AI-search checks

### 4. Creation
- master thesis
- master draft
- LinkedIn version
- X version/thread
- Telegram version

### 5. Operations
- queue
- immutable versions
- conflict-safe agent patches
- approval
- scheduling
- publishing
- analytics

### 6. Feedback
Use outcomes to update topic priority, format preference and platform strategy without letting engagement metrics redefine positioning.

## Social Intelligence flow

`creator -> profile snapshot -> recent posts -> baseline -> outliers -> transcript/comments -> mechanism -> patterns -> lesson -> content opportunity`

Two creator classes are useful:

- **Educators** — creators who teach how LinkedIn/Instagram/content should work. Capture their explicit advice.
- **Performers** — creators who repeatedly produce strong outlier content. Capture what they actually do.

The useful comparison is **what creators say works vs. what their own successful posts show works**.

## External components

### marketingskills
Methodology/reference layer. High-priority upstream skills:
`content-strategy`, `social`, `competitor-profiling`, `reverse-engineer-marketing`, `marketing-loops`, `ai-seo`.

### Crawl4AI
Research ingestion and structured extraction.

### changedetection.io
Monitoring for competitor messaging, product, pricing, docs and other relevant page changes.

### claude-seo
SEO/GEO specialist reference layer.

### Postiz
Reference/potential integration layer for multi-platform scheduling, publishing and analytics.

### ScrapeCreators social-media-research-skills
Public social research workflows. We adapt:
`outlier-post-finder`, `competitor-social-research`, `comment-mining`, `transcript-intelligence`.

### social-media-skills/skills
Methodology layer. We adapt `viral-reverse-engineering` into our local `viral-mechanism-analysis` skill.

## Data objects to implement next

- Source
- Signal
- Evidence
- Competitor
- Creator
- CreatorSnapshot
- SocialPostSnapshot
- OutlierScore
- CommentTheme
- TranscriptArtifact
- ContentPattern
- ContentOpportunity
- ContentItem
- ContentVersion
- PlatformVariant
- Approval
- PublishingJob
- PerformanceSnapshot

## Non-goals for v0.2

- fully autonomous publishing
- posting for the sake of cadence
- copying competitor/creator content
- claiming causality from correlation or one viral post
- making employer-specific claims from private information
- treating blockchain ecosystems as isolated content pillars
