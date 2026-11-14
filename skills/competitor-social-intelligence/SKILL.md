---
name: competitor-social-intelligence
description: Compares creators and competitors across LinkedIn, Instagram and other public social channels to identify content pillars, outliers, gaps and strategy patterns.
version: 0.1.0
upstream: ScrapeCreators/social-media-research-skills:competitor-social-research
---

# Competitor Social Intelligence

## Purpose

Understand what selected creators or competitors actually publish and what appears to work.

## Creator classes

Tag each monitored creator as one or both:

### Educator
Teaches how content, LinkedIn, Instagram, growth or distribution should work.

Capture:
- explicit advice
- frameworks
- claims about algorithms/platform behavior
- recommended formats/cadence/hooks
- evidence they cite

### Performer
Regularly produces notable content.

Capture:
- actual posting behavior
- recurring outlier patterns
- formats and hooks used
- deviations from their own advice

The most valuable output is often:
**what they say works vs. what their own successful posts show works.**

## Workflow

1. Snapshot profile positioning and public metadata.
2. Pull a comparable recent window per creator.
3. Route each creator through `creator-outlier-analysis`.
4. Classify content pillars and formats.
5. Analyze hook styles, proof, structure, cadence and CTA behavior.
6. Use transcripts/comments for top outliers when available.
7. Find cross-creator patterns.
8. Find whitespace relevant to our Personal Brand.

## Comparison rules

- Never compare only raw views/followers.
- Normalize against each creator's own baseline.
- Keep LinkedIn and Instagram behavior separate.
- Label inferred strategy as inferred.
- A pattern needs multiple examples; one post is an anecdote.

## Output

For each creator:
- positioning
- creator class
- content pillars
- frequency/format mix
- strongest outliers
- repeatable mechanisms
- explicit advice, if Educator

Across the group:
- recurring successful mechanisms
- advice vs behavior discrepancies
- saturated patterns
- content gaps
- useful tests for our brand
- rejected patterns that conflict with our positioning
