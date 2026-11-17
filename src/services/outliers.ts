import type { Metric, ScorablePost, OutlierScore } from "../domain/types.js";
import type { Store } from "../db/repository.js";
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}
export function confidence(n: number): OutlierScore["confidence"] {
  return n < 10 ? "low" : n < 20 ? "medium" : "high";
}
export function bucket(n: number): OutlierScore["bucket"] {
  return n < 1.5 ? "normal" : n < 2 ? "mild" : n < 5 ? "strong" : "huge";
}
export function calculateOutliers(
  posts: ScorablePost[],
  metric: Metric = "likes",
  window = 50,
) {
  const scores: OutlierScore[] = [];
  const warnings: string[] = [];
  for (const post of posts) {
    const value = post.metrics[metric];
    if (value === null) {
      warnings.push(`${post.id}: missing ${metric}`);
      continue;
    }
    // Leave target out; older posts only, with at most 50 comparable observations.
    const older = posts
      .filter(
        (p) =>
          p.id !== post.id &&
          p.publishedAt < post.publishedAt &&
          p.metrics[metric] !== null,
      )
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    const format = post.mediaType
      ? older.filter((p) => p.mediaType === post.mediaType)
      : [];
    const separate = format.length >= 10;
    const samples = (separate ? format : older).slice(0, window);
    const baseline = median(samples.map((p) => p.metrics[metric]!));
    if (baseline === null || baseline === 0) {
      warnings.push(`${post.id}: insufficient or zero median baseline`);
      continue;
    }
    const multiplier = value / baseline;
    scores.push({
      postId: post.id,
      baselineWindow: samples.length,
      baselineMetric: metric,
      baselineMedian: baseline,
      postMetricValue: value,
      multiplier,
      bucket: bucket(multiplier),
      confidence: confidence(samples.length),
      details: {
        scope: separate ? "format" : "account",
        mediaType: post.mediaType,
        windowLimit: window,
        samplePostIds: samples.map((p) => p.id),
        interpretation: "Performance deviation, not causality",
        targetExcluded: true,
      },
    });
  }
  return { scores, warnings };
}
export async function recompute(
  store: Store,
  creatorId?: string,
  dryRun = false,
  metric: Metric = "likes",
) {
  const summaries = [];
  for (const account of await store.accounts(creatorId)) {
    const result = calculateOutliers(await store.scorable(account.id), metric);
    if (!dryRun)
      await store.saveScores(result.scores, new Date().toISOString());
    summaries.push({
      account: account.id,
      calculated: result.scores.length,
      dryRun,
      warnings: result.warnings,
    });
  }
  return summaries;
}
