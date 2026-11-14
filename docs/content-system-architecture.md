# Content System Architecture v0.1

## Goal

Create an evidence-driven personal media system for LinkedIn, X and Telegram, later surfaced inside the Productivity Dashboard.

## Logical layers

### 1. Sources
News, websites, competitors, public social, podcasts, ecosystem activity, internal approved notes.

### 2. Collection
- Crawl4AI for structured crawling/retrieval
- changedetection.io for page-change signals
- direct APIs/connectors when available

### 3. Intelligence
- personal-brand-strategy
- content-intelligence
- competitor profiles
- growth teardowns
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

## First external components

### marketingskills
Methodology/reference layer. High-priority upstream skills:
`content-strategy`, `social`, `competitor-profiling`, `reverse-engineer-marketing`, `marketing-loops`, `ai-seo`.

### Crawl4AI
Research ingestion and structured extraction.

### changedetection.io
Monitoring for competitor messaging, product, pricing, docs and other relevant page changes.

### claude-seo
SEO/GEO specialist reference layer. Use primarily for site/content audit and AI-search visibility, not as the core social-writing engine.

### Postiz
Reference and potential integration layer for multi-platform scheduling/publishing/analytics. Do not couple core content objects to Postiz-specific schemas.

## Data objects to implement next

- Source
- Signal
- Evidence
- Competitor
- Snapshot
- ContentOpportunity
- ContentItem
- ContentVersion
- PlatformVariant
- Approval
- PublishingJob
- PerformanceSnapshot

## Non-goals for v0.1

- fully autonomous publishing
- posting for the sake of cadence
- copying competitor content
- making employer-specific claims from private information
- treating blockchain ecosystems as isolated content pillars
