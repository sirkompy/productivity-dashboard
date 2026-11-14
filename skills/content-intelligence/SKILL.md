---
name: content-intelligence
description: Turns market, competitor, customer, product and ecosystem signals into evidence-backed content opportunities.
version: 0.1.0
---

# Content Intelligence

## Purpose

Find things worth saying. Do not manufacture posting volume.

## Inputs

Potential inputs include:
- competitor sites and changelogs
- public company announcements
- industry news
- public social discussions
- search and AI-search results
- podcasts and interviews
- product launches and funding
- Stellar, Solana and other ecosystem activity
- internal project/build notes explicitly approved for content use

## Evidence model

Every meaningful finding must be separated into:

**Observed** — what a source actually shows, with URL/date/source metadata.

**Inferred** — interpretation based on observed evidence. Never present it as fact.

**Implication** — why it might matter for B2B Sales, BD, GTM, AI, fintech infrastructure or distribution.

## Opportunity scoring

Score 0-5:
- brand fit
- novelty / information gain
- evidence strength
- practical usefulness
- author advantage: can the author add a real perspective?
- timeliness
- platform potential

Reject ideas that are only summaries with no author advantage.

## Competitor intelligence

Use dated snapshots. A missing feature or message means "not observed on pages checked", not "does not exist".

Track:
- positioning and homepage messaging
- product launches
- pricing/package changes
- content themes
- customer proof
- partnerships
- hiring signals
- SEO / AI-search presence when data exists

## External methodology

Reference, do not blindly copy, the pinned components in `config/content-stack.sources.json`.

Highest-value upstream methods:
- marketingskills: content-strategy
- competitor-profiling
- reverse-engineer-marketing
- marketing-loops
- ai-seo
- claude-seo: SEO/GEO auditing

## Output

A content opportunity should contain:
- signal
- sources
- observed facts
- inference
- thesis
- counterargument or uncertainty
- brand pillar
- ecosystem tags if relevant
- suggested format
- priority score

Then hand off to `personal-brand-writer`.
