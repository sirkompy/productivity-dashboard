import { z } from "zod";
import {
  postSchema,
  metricsSchema,
  type Platform,
  type CreatorProfile,
  type SocialPost,
} from "../domain/types.js";
import { ProviderError } from "./http.js";
export type Obj = Record<string, unknown>;
export function object(value: unknown): Obj {
  const parsed = z.record(z.string(), z.unknown()).safeParse(value);
  if (!parsed.success)
    throw new ProviderError("invalid_response", "Expected a provider object");
  return parsed.data;
}
export function envelope(value: unknown): Obj {
  const o = object(value);
  if (o.success === false)
    throw new ProviderError(
      "unavailable",
      "Provider reported unsuccessful collection",
    );
  return o;
}
export function record(value: unknown): Obj {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Obj)
    : {};
}
export function string(...values: unknown[]): string | null {
  for (const v of values)
    if ((typeof v === "string" && v.trim()) || typeof v === "number")
      return String(v);
  return null;
}
export function count(...values: unknown[]): number | null {
  const v = values.find((v) => v !== undefined && v !== null);
  if (v === undefined) return null;
  const n = typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v;
  if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 0)
    throw new ProviderError("invalid_response", "Invalid provider metric");
  return n;
}
/** Retain useful payloads while excluding credential-bearing fields. */
export function metadata(value: unknown): Obj {
  function clean(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(clean);
    if (v && typeof v === "object")
      return Object.fromEntries(
        Object.entries(v)
          .filter(
            ([k]) =>
              !/api.?key|authorization|password|secret|access.?token/i.test(k),
          )
          .map(([k, x]) => [k, clean(x)]),
      );
    const key = process.env.SCRAPECREATORS_API_KEY;
    if (typeof v === "string" && key) return v.replaceAll(key, "[REDACTED]");
    return v;
  }
  return record(clean(value));
}
export function canonicalUrl(
  platform: Platform,
  input: string,
  profile = false,
): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new ProviderError("invalid_response", "Invalid social URL");
  }
  const domain = platform === "instagram" ? "instagram.com" : "linkedin.com";
  if (
    !["http:", "https:"].includes(url.protocol) ||
    ![domain, `www.${domain}`].includes(url.hostname) ||
    url.username ||
    url.password
  )
    throw new ProviderError("invalid_response", "Unexpected social URL host");
  const path = url.pathname.replace(/\/+$/, "");
  if (
    !path ||
    (profile
      ? platform === "instagram"
        ? !/^\/[\w.]+$/.test(path)
        : !/^\/(in|company)\/[^/]+$/.test(path)
      : platform === "instagram"
        ? !/^\/(p|reel|tv)\/[^/]+$/.test(path)
        : !/^\/(posts|feed\/update|pulse)\/.+/.test(path))
  )
    throw new ProviderError("invalid_response", "Unexpected social URL path");
  // Instagram reel/p links for a shortcode identify the same media.
  const canonicalPath =
    !profile && platform === "instagram"
      ? path.replace(/^\/(reel|tv)\//, "/p/")
      : path;
  return `https://www.${domain}${canonicalPath}/`;
}
export function profileUrl(platform: Platform, value: string): string {
  return canonicalUrl(
    platform,
    value.includes("://")
      ? value
      : platform === "instagram"
        ? `https://www.instagram.com/${value.replace(/^@/, "")}`
        : `https://www.linkedin.com/in/${value.replace(/^@/, "")}`,
    true,
  );
}
export function normalizeCreator(
  platform: Platform,
  input: string,
  value: unknown,
): CreatorProfile {
  const root = envelope(value);
  const data = record(root.data);
  const o = record(root.user ?? data.user ?? root.data ?? root);
  const url = profileUrl(platform, input);
  const handle = string(
    o.username,
    o.handle,
    o.publicIdentifier,
    new URL(url).pathname.split("/").filter(Boolean).at(-1),
  )!;
  const displayName = string(
    o.full_name,
    o.fullName,
    o.name,
    o.displayName,
    [o.firstName, o.lastName].filter(Boolean).join(" "),
  );
  if (!displayName)
    throw new ProviderError("invalid_response", "Profile name missing");
  return {
    platform,
    profileUrl: url,
    handle,
    displayName,
    externalId: string(o.id, o.pk, o.urn),
    followersCount: count(
      o.follower_count,
      o.followersCount,
      o.followers,
      record(o.edge_followed_by).count,
    ),
    metadata: metadata(root),
  };
}
export function normalizePost(platform: Platform, value: unknown): SocialPost {
  const root = object(value);
  const o = record(root.node ?? root);
  const caption = record(o.caption);
  const counts = record(o.metrics ?? o.statistics ?? o.social_stats);
  const shortcode = string(o.code, o.shortcode);
  const url = string(
    o.permalink,
    o.url,
    o.postUrl,
    o.post_url,
    o.linkedinUrl,
    shortcode ? `https://www.instagram.com/p/${shortcode}/` : null,
  );
  const rawDate =
    o.taken_at ??
    o.taken_at_timestamp ??
    o.published_at ??
    o.publishedAt ??
    o.postedAt ??
    o.created_at;
  let date: Date;
  if (typeof rawDate === "number")
    date = new Date(rawDate < 1e12 ? rawDate * 1000 : rawDate);
  else date = new Date(typeof rawDate === "string" ? rawDate : NaN);
  if (!url || !Number.isFinite(date.getTime()))
    throw new ProviderError(
      "invalid_response",
      "Post URL or publication time missing/invalid",
    );
  const metrics = metricsSchema.parse({
    views: count(
      o.play_count,
      o.video_view_count,
      o.view_count,
      o.views,
      counts.views,
    ),
    likes: count(
      o.like_count,
      o.likes,
      record(o.edge_media_preview_like).count,
      counts.likes,
    ),
    comments: count(
      o.comment_count,
      o.comments,
      record(o.edge_media_to_comment).count,
      counts.comments,
    ),
    shares: count(o.share_count, o.shares, counts.shares),
    reposts: count(o.repost_count, o.reposts, counts.reposts),
    saves: count(o.save_count, o.saves, counts.saves),
  });
  const mediaType = string(o.media_type, o.mediaType, o.type);
  const parsed = postSchema.safeParse({
    platform,
    provider: "scrapecreators",
    providerPostId: string(o.id, o.pk, o.urn),
    canonicalUrl: canonicalUrl(platform, url),
    publishedAt: date.toISOString(),
    text: string(
      caption.text,
      o.text,
      o.description,
      record(
        record(o.edge_media_to_caption).edges instanceof Array
          ? record((record(o.edge_media_to_caption).edges as unknown[])[0]).node
          : {},
      ).text,
    ),
    mediaType:
      mediaType === "1"
        ? "image"
        : mediaType === "2"
          ? "video"
          : mediaType === "8"
            ? "carousel"
            : (mediaType?.toLowerCase() ?? null),
    metrics,
    rawMetadata: metadata(root),
    rawMetrics: metadata({ ...counts, ...metrics }),
  });
  if (!parsed.success)
    throw new ProviderError("invalid_response", "Invalid normalized post");
  return parsed.data;
}
