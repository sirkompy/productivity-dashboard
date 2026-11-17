import { afterEach, describe, expect, it, vi } from "vitest";
import instagram from "./fixtures/instagram.json";
import linkedin from "./fixtures/linkedin.json";
import {
  normalizePost,
  normalizeCreator,
  canonicalUrl,
} from "../src/providers/normalize.js";
import { ScrapeCreatorsProvider } from "../src/providers/scrapecreators.js";
import { ScrapeCreatorsHttp } from "../src/providers/http.js";
afterEach(() => vi.unstubAllEnvs());
function provider(payloads: unknown[]) {
  vi.stubEnv("SCRAPECREATORS_API_KEY", "fixture-key");
  const fetcher = vi.fn(
    async () => new Response(JSON.stringify(payloads.shift()), { status: 200 }),
  );
  return {
    provider: new ScrapeCreatorsProvider(
      new ScrapeCreatorsHttp({
        fetch: fetcher as typeof fetch,
        sleep: async () => {},
      }),
    ),
    fetcher,
  };
}
describe("normalization", () => {
  it("normalizes Instagram and preserves missing counters as null", () => {
    const post = normalizePost("instagram", instagram.items[0]);
    expect(post.canonicalUrl).toBe("https://www.instagram.com/p/Example01/");
    expect(post.metrics).toMatchObject({
      views: 5000,
      likes: 100,
      saves: null,
    });
    expect(post.mediaType).toBe("video");
    expect(post.publishedAt).toBe("2025-01-01T00:00:00.000Z");
    expect(
      normalizeCreator("instagram", "example", instagram).followersCount,
    ).toBe(1000);
  });
  it("normalizes LinkedIn without inventing views", () => {
    const post = normalizePost("linkedin", linkedin.data.recentPosts[0]);
    expect(post.metrics.views).toBeNull();
    expect(post.metrics.likes).toBe(50);
    expect(normalizeCreator("linkedin", "example", linkedin).displayName).toBe(
      "Example Person",
    );
  });
  it("canonicalizes media aliases and strips tracking", () => {
    expect(
      canonicalUrl(
        "instagram",
        "http://instagram.com/reel/Example01/?utm_source=x",
      ),
    ).toBe("https://www.instagram.com/p/Example01/");
  });
  it("rejects missing timestamps, wrong hosts, negative and unsafe counters", () => {
    for (const extra of [
      { taken_at: null },
      { like_count: -1 },
      { like_count: "many" },
      { play_count: Number.MAX_SAFE_INTEGER + 1 },
      { url: "https://evil.example/p/123/" },
    ])
      expect(() =>
        normalizePost("instagram", { ...instagram.items[0], ...extra }),
      ).toThrow();
  });
  it("removes credential-bearing metadata fields", () => {
    expect(
      normalizePost("instagram", {
        ...instagram.items[0],
        api_key: "do-not-store",
        nested: { authorization: "secret" },
      }).rawMetadata,
    ).not.toHaveProperty("api_key");
  });
});
describe("provider capabilities", () => {
  it("paginates Instagram with next_max_id and deduplicates", async () => {
    const { provider: p, fetcher } = provider([
      { items: instagram.items, next_max_id: "next", more_available: true },
      {
        items: [...instagram.items, { ...instagram.items[0], code: "Second" }],
        more_available: false,
      },
    ]);
    const feed = await p.getCreatorPosts("instagram", "example");
    expect(feed.posts).toHaveLength(2);
    expect(String(fetcher.mock.calls[1]?.[0])).toContain("next_max_id=next");
    expect(feed.warnings.join(" ")).toContain("20–50");
  });
  it("explicitly reports partial personal LinkedIn history", async () => {
    const { provider: p } = provider([linkedin]);
    const feed = await p.getCreatorPosts("linkedin", "example");
    expect(feed.posts).toHaveLength(1);
    expect(feed.completeness).toBe("partial");
    expect(feed.warnings.join(" ")).toContain("incomplete");
  });
  it("does not silently treat absent personal feed as empty", async () => {
    const { provider: p } = provider([{ name: "Example" }]);
    await expect(
      p.getCreatorPosts("linkedin", "example"),
    ).rejects.toMatchObject({ code: "unsupported" });
  });
  it("rejects unrecognized feeds, warns about malformed posts", async () => {
    let { provider: p } = provider([{}]);
    await expect(
      p.getCreatorPosts("instagram", "example"),
    ).rejects.toMatchObject({ code: "invalid_response" });
    ({ provider: p } = provider([{ items: [{}, ...instagram.items] }]));
    const feed = await p.getCreatorPosts("instagram", "example");
    expect(feed.posts).toHaveLength(1);
    expect(feed.warnings.join(" ")).toContain("Skipped");
  });
  it("fetches company feeds, single posts and segmented transcripts", async () => {
    const { provider: p, fetcher } = provider([
      { posts: linkedin.data.recentPosts },
      { post: instagram.items[0] },
      { transcripts: [{ text: "Hello" }, { text: "world" }], language: "en" },
    ]);
    expect(
      (
        await p.getCreatorPosts(
          "linkedin",
          "https://linkedin.com/company/example/",
        )
      ).posts,
    ).toHaveLength(1);
    expect(String(fetcher.mock.calls[0]?.[0])).toContain(
      "/v1/linkedin/company/posts",
    );
    expect(
      (await p.getPost("instagram", "https://instagram.com/p/Example01/"))
        .provider,
    ).toBe("scrapecreators");
    expect(
      (
        await p.getTranscript(
          "linkedin",
          "https://linkedin.com/posts/example_activity-123/",
        )
      ).text,
    ).toBe("Hello\nworld");
  });
});
describe("safe HTTP failures", () => {
  it("requires environment credentials", async () => {
    vi.stubEnv("SCRAPECREATORS_API_KEY", "");
    await expect(
      new ScrapeCreatorsHttp().get("/test", {}),
    ).rejects.toMatchObject({ code: "configuration" });
  });
  it.each([401, 403, 404, 400])(
    "does not retry HTTP %s or expose upstream errors",
    async (status) => {
      vi.stubEnv("SCRAPECREATORS_API_KEY", "fixture-key");
      const fetcher = vi.fn(
        async () => new Response("sensitive body", { status }),
      );
      await expect(
        new ScrapeCreatorsHttp({ fetch: fetcher }).get("/test", {}),
      ).rejects.toThrow(`HTTP ${status}`);
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it("retries rate limits using Retry-After", async () => {
    vi.stubEnv("SCRAPECREATORS_API_KEY", "fixture-key");
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("", { status: 429, headers: { "retry-after": "1" } }),
      )
      .mockResolvedValueOnce(new Response("{}"));
    const sleep = vi.fn(async () => {});
    await new ScrapeCreatorsHttp({ fetch: fetcher, sleep }).get("/test", {});
    expect(sleep).toHaveBeenCalledWith(1000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("bounds transient retries and sanitizes network errors", async () => {
    vi.stubEnv("SCRAPECREATORS_API_KEY", "fixture-key");
    const fetcher = vi.fn(async () => {
      throw new Error("secret");
    });
    await expect(
      new ScrapeCreatorsHttp({ fetch: fetcher, sleep: async () => {} }).get(
        "/test",
        {},
      ),
    ).rejects.toThrow("timed out or failed");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("honors timeout signals", async () => {
    vi.stubEnv("SCRAPECREATORS_API_KEY", "fixture-key");
    const fetcher = vi.fn(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new Error("timeout")),
          );
        }),
    );
    await expect(
      new ScrapeCreatorsHttp({ fetch: fetcher, timeoutMs: 5, retries: 0 }).get(
        "/test",
        {},
      ),
    ).rejects.toMatchObject({ code: "unavailable" });
  });
  it("rejects invalid JSON and success false", async () => {
    vi.stubEnv("SCRAPECREATORS_API_KEY", "fixture-key");
    await expect(
      new ScrapeCreatorsHttp({
        fetch: async () => new Response("not JSON"),
      }).get("/test", {}),
    ).rejects.toMatchObject({ code: "invalid_response" });
    const { provider: p } = provider([
      { success: false, message: "private error" },
    ]);
    await expect(p.getCreator("instagram", "example")).rejects.toMatchObject({
      code: "unavailable",
    });
  });
});
