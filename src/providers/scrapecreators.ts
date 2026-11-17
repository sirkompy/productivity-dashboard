import {
  type Feed,
  type Platform,
  type SocialDataProvider,
  type Transcript,
} from "../domain/types.js";
import { ScrapeCreatorsHttp, ProviderError } from "./http.js";
import {
  envelope,
  record,
  string,
  metadata,
  profileUrl,
  canonicalUrl,
  normalizeCreator,
  normalizePost,
  type Obj,
} from "./normalize.js";
export class ScrapeCreatorsProvider implements SocialDataProvider {
  readonly name = "scrapecreators";
  constructor(private readonly http = new ScrapeCreatorsHttp()) {}
  private profileRequest(platform: Platform, input: string) {
    const url = profileUrl(platform, input);
    const company = url.includes("/company/");
    return this.http.get(
      platform === "instagram"
        ? "/v1/instagram/profile"
        : company
          ? "/v1/linkedin/company"
          : "/v1/linkedin/profile",
      platform === "instagram"
        ? { handle: new URL(url).pathname.split("/")[1]! }
        : { url },
    );
  }
  async getCreator(platform: Platform, input: string) {
    return normalizeCreator(
      platform,
      input,
      await this.profileRequest(platform, input),
    );
  }
  async getCreatorPosts(
    platform: Platform,
    input: string,
    options: { limit?: number } = {},
  ): Promise<Feed> {
    const limit = options.limit ?? 30;
    if (!Number.isInteger(limit) || limit < 20 || limit > 50)
      throw new ProviderError("configuration", "Backfill limit must be 20–50");
    const url = profileUrl(platform, input);
    const personal = platform === "linkedin" && url.includes("/in/");
    const warnings: string[] = [];
    const posts: Feed["posts"] = [];
    const seen = new Set<string>();
    let cursor: string | undefined;
    let page = 1;
    if (platform === "linkedin")
      warnings.push(
        "LinkedIn public history may be incomplete; missing posts are a provider limitation, not an empty complete feed.",
      );
    for (let request = 0; request < 10; request++) {
      const raw = personal
        ? await this.profileRequest(platform, input)
        : await this.http.get(
            platform === "instagram"
              ? "/v2/instagram/user/posts"
              : "/v1/linkedin/company/posts",
            platform === "instagram"
              ? {
                  handle: new URL(url).pathname.split("/")[1]!,
                  ...(cursor ? { next_max_id: cursor } : {}),
                }
              : { url, page: String(page) },
          );
      const root = envelope(raw);
      const data = record(root.data);
      let entries: unknown =
        root.items ?? root.posts ?? data.items ?? data.posts;
      if (personal) {
        entries =
          root.recentPosts ?? root.posts ?? data.recentPosts ?? data.posts;
        warnings.push(
          "No documented standalone personal LinkedIn feed endpoint; using embedded recent posts only.",
        );
      }
      if (!Array.isArray(entries))
        throw new ProviderError(
          personal ? "unsupported" : "invalid_response",
          personal
            ? "Personal LinkedIn recent posts unavailable"
            : "Unrecognized provider feed shape",
        );
      for (const entry of entries) {
        try {
          const post = normalizePost(platform, entry);
          if (!seen.has(post.canonicalUrl)) {
            posts.push(post);
            seen.add(post.canonicalUrl);
          }
        } catch (error) {
          if (!(error instanceof ProviderError)) throw error;
          warnings.push(`Skipped invalid post: ${error.message}`);
        }
      }
      const next = string(root.next_max_id, data.next_max_id);
      const more =
        root.has_more ??
        root.more_available ??
        data.more_available ??
        data.has_more;
      if (personal || posts.length >= limit) break;
      if (platform === "instagram") {
        if (!next || next === cursor) {
          if (more === true)
            warnings.push(
              "Provider indicated more posts without a usable next cursor.",
            );
          break;
        }
        cursor = next;
      } else {
        if (more !== true && !root.next_page && !data.next_page) break;
        page++;
      }
      if (entries.length === 0) break;
    }
    if (posts.length < 20)
      warnings.push(
        `Only ${posts.length} usable recent posts; target is 20–50.`,
      );
    // A bounded recent-history request never proves an entire creator history is complete.
    return { posts: posts.slice(0, limit), completeness: "partial", warnings };
  }
  async getPost(platform: Platform, url: string) {
    const root = envelope(
      await this.http.get(`/v1/${platform}/post`, {
        url: canonicalUrl(platform, url),
      }),
    );
    return normalizePost(
      platform,
      root.post ?? record(root.data).post ?? root.data ?? root,
    );
  }
  async getTranscript(platform: Platform, url: string): Promise<Transcript> {
    const root = envelope(
      await this.http.get(
        platform === "instagram"
          ? "/v2/instagram/media/transcript"
          : "/v1/linkedin/post/transcript",
        { url: canonicalUrl(platform, url) },
      ),
    );
    const o: Obj = root.data ? record(root.data) : root;
    const segments = o.transcripts ?? o.transcript;
    const text = string(
      o.text,
      typeof o.transcript === "string" ? o.transcript : null,
      Array.isArray(segments)
        ? segments
            .map((s) => string(record(s).text))
            .filter(Boolean)
            .join("\n")
        : null,
    );
    if (!text)
      throw new ProviderError(
        "unsupported",
        "No usable public transcript returned",
      );
    return { text, language: string(o.language), metadata: metadata(root) };
  }
}
