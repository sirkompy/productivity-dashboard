import { expect, it } from "vitest";
import {
  median,
  bucket,
  confidence,
  calculateOutliers,
} from "../src/services/outliers.js";
import type { ScorablePost } from "../src/domain/types.js";
export function posts(n: number): ScorablePost[] {
  return Array.from({ length: n }, (_, i) => ({
    id: String(i),
    publishedAt: new Date(Date.UTC(2025, 0, i + 1)).toISOString(),
    mediaType: i % 2 ? "video" : "image",
    metrics: {
      likes: 10,
      views: null,
      comments: null,
      reposts: null,
      shares: null,
      saves: null,
    },
  }));
}
it("uses median without mutating the input", () => {
  const input = [100, 1, 2];
  expect(median(input)).toBe(2);
  expect(input).toEqual([100, 1, 2]);
  expect(median([1, 2, 3, 4])).toBe(2.5);
  expect(median([])).toBeNull();
});
it.each([
  [0, "normal"],
  [1.499, "normal"],
  [1.5, "mild"],
  [1.999, "mild"],
  [2, "strong"],
  [4.999, "strong"],
  [5, "huge"],
  [8, "huge"],
])("buckets %s as %s", (n, b) => expect(bucket(Number(n))).toBe(b));
it.each([
  [0, "low"],
  [9, "low"],
  [10, "medium"],
  [19, "medium"],
  [20, "high"],
])("confidence %s is %s", (n, c) => expect(confidence(Number(n))).toBe(c));
it("excludes target and uses older posts, with format when enough samples exist", () => {
  const p = posts(30);
  p[29]!.metrics.likes = 100;
  const result = calculateOutliers(p);
  const score = result.scores.find((s) => s.postId === "29")!;
  expect(score.baselineMedian).toBe(10);
  expect(score.multiplier).toBe(10);
  expect(score.bucket).toBe("huge");
  expect(score.details.scope).toBe("format");
  expect(score.details.samplePostIds).not.toContain("29");
});
it("does not compare unavailable metrics or divide by zero", () => {
  expect(calculateOutliers(posts(10), "views").scores).toHaveLength(0);
  const p = posts(4);
  p.forEach((p) => (p.metrics.likes = 0));
  expect(calculateOutliers(p).scores).toHaveLength(0);
});
it("caps the baseline and falls back to account for sparse formats", () => {
  const p = posts(60);
  p[59]!.mediaType = "text";
  const s = calculateOutliers(p).scores.find((s) => s.postId === "59")!;
  expect(s.baselineWindow).toBe(50);
  expect(s.details.scope).toBe("account");
  expect(s.confidence).toBe("high");
});
