---
name: creator-outlier-analysis
description: Finds LinkedIn, Instagram and other social posts that materially outperform a creator's own normal baseline, then extracts repeatable patterns without copying surface details.
version: 0.1.0
upstream: ScrapeCreators/social-media-research-skills:outlier-post-finder
---

# Creator Outlier Analysis

Read `.agents/personal-brand.md` before turning findings into recommendations.

## Purpose

Find posts worth studying because they overperformed **for that creator**, not merely because they have large raw numbers.

## Inputs

- creator/profile identifier
- platform
- recent public posts
- available metrics: views/plays, likes, comments, shares/reposts, saves
- optional transcripts
- optional comments

Live collection may use the pinned ScrapeCreators research layer when `SCRAPECREATORS_API_KEY` is configured.

## Baseline rules

- Prefer at least 20 recent posts when available.
- Use median, not mean, for the main baseline.
- Keep each creator and platform separate.
- Split baselines by format when sample size allows: text, carousel, reel/video, etc.
- Under 10 comparable posts = low confidence.

## Outlier scoring

Preserve raw metrics first.

Possible lifts:
- `view_lift = views / median_views`
- `engagement_lift = engagement / median_engagement`

Directional labels:
- huge: 5x+
- strong: 2x–5x
- mild: 1.5x–2x

Do not treat these thresholds as universal performance standards.

## Analysis

For top outliers, extract:
- first-line/hook
- topic and angle
- format
- structure
- proof/authority
- novelty/timeliness
- emotional or practical trigger
- CTA
- comment reaction
- possible distribution confounds

## Evidence contract

Separate:
- **Observed** — public post/metric/transcript/comment evidence
- **Inferred** — likely explanation
- **Implication** — what we should test in our own content

Never say "this caused the post to go viral" unless causality is actually established.

## Output

Return:
- sample size and confidence
- creator baseline
- ranked outliers
- repeatable patterns with multiple examples
- one-off/non-replicable features
- 3–5 mechanisms worth testing
- possible content opportunities routed through `personal-brand-strategy`

Do not copy exact posts or build derivative rewrites.
