---
name: social-transcript-intelligence
description: Analyzes public social-video transcripts to extract hooks, claims, examples, stories, frameworks and explicit creator advice.
version: 0.1.0
upstream: ScrapeCreators/social-media-research-skills:transcript-intelligence
---

# Social Transcript Intelligence

## Purpose

Convert spoken LinkedIn/Instagram/YouTube/X social content into structured research.

## Extract

Segment into:
- opening/hook
- setup
- main claim
- evidence/examples
- framework
- payoff
- CTA

Also capture:
- explicit advice
- contrarian claims
- stories
- proof/authority
- memorable phrasing
- questions answered

## For Educator creators

Create an **Advice Ledger**.

Each advice item should contain:
- claim/advice
- source URL
- date
- platform
- exact or carefully paraphrased wording
- whether the creator appears to follow this advice in their own content
- supporting/contradicting examples
- confidence

This ledger feeds `competitor-social-intelligence`.

## Across multiple transcripts

Cluster:
- recurring recommendations
- repeated hook formulas
- repeated frameworks
- contradictions
- ideas that change over time

## Integrity

- Never invent transcript lines.
- Mark garbled auto-transcription as approximate.
- Preserve source attribution.
- Separate what the creator said from our interpretation.

## Output

- transcript notes
- Advice Ledger entries
- recurring themes
- strongest mechanisms/examples
- relevant content opportunities for our Personal Brand
