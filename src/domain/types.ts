import { z } from "zod";
export const platformSchema = z.enum(["instagram", "linkedin"]);
export type Platform = z.infer<typeof platformSchema>;
export const metricNames = [
  "views",
  "likes",
  "comments",
  "shares",
  "reposts",
  "saves",
] as const;
export type Metric = (typeof metricNames)[number];
const count = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER)
  .nullable();
export const metricsSchema = z.object({
  views: count,
  likes: count,
  comments: count,
  shares: count,
  reposts: count,
  saves: count,
});
export type Metrics = z.infer<typeof metricsSchema>;
export const postSchema = z.object({
  platform: platformSchema,
  provider: z.string().min(1),
  providerPostId: z.string().nullable(),
  canonicalUrl: z.url(),
  publishedAt: z.iso.datetime(),
  text: z.string().nullable(),
  mediaType: z.string().nullable(),
  metrics: metricsSchema,
  rawMetadata: z.record(z.string(), z.unknown()),
  rawMetrics: z.record(z.string(), z.unknown()),
});
export type SocialPost = z.infer<typeof postSchema>;
export interface CreatorProfile {
  platform: Platform;
  profileUrl: string;
  handle: string;
  displayName: string;
  externalId: string | null;
  followersCount: number | null;
  metadata: Record<string, unknown>;
}
export interface Transcript {
  text: string;
  language: string | null;
  metadata: Record<string, unknown>;
}
export interface Feed {
  posts: SocialPost[];
  completeness: "partial" | "exhausted";
  warnings: string[];
}
export interface CreatorAccount {
  id: string;
  creatorId: string;
  platform: Platform;
  handle: string;
  profileUrl: string;
  provider: string;
}
export interface SocialDataProvider {
  readonly name: string;
  getCreator(
    platform: Platform,
    profileUrlOrHandle: string,
  ): Promise<CreatorProfile>;
  getCreatorPosts(
    platform: Platform,
    profileUrlOrHandle: string,
    options?: { limit?: number },
  ): Promise<Feed>;
  getPost(platform: Platform, postUrl: string): Promise<SocialPost>;
  getTranscript(platform: Platform, postUrl: string): Promise<Transcript>;
}
export interface ScorablePost {
  id: string;
  publishedAt: string;
  mediaType: string | null;
  metrics: Metrics;
}
export interface OutlierScore {
  postId: string;
  baselineWindow: number;
  baselineMetric: Metric;
  baselineMedian: number;
  postMetricValue: number;
  multiplier: number;
  bucket: "normal" | "mild" | "strong" | "huge";
  confidence: "low" | "medium" | "high";
  details: Record<string, unknown>;
}
