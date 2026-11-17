export type ProviderErrorCode =
  | "configuration"
  | "authentication"
  | "rate_limit"
  | "not_found"
  | "unavailable"
  | "invalid_response"
  | "unsupported";
export class ProviderError extends Error {
  constructor(
    readonly code: ProviderErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
export interface HttpOptions {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  retries?: number;
}
/** Only safe GETs; errors never include request headers, URLs or response bodies. */
export class ScrapeCreatorsHttp {
  private readonly fetcher: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  constructor(private readonly options: HttpOptions = {}) {
    this.fetcher = options.fetch ?? fetch;
    this.sleep =
      options.sleep ??
      ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }
  async get(path: string, params: Record<string, string>): Promise<unknown> {
    const key = process.env.SCRAPECREATORS_API_KEY;
    if (!key)
      throw new ProviderError(
        "configuration",
        "SCRAPECREATORS_API_KEY is required",
      );
    const url = new URL(path, "https://api.scrapecreators.com");
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    for (let attempt = 0; ; attempt++) {
      let response: Response;
      try {
        response = await this.fetcher(url, {
          headers: { "x-api-key": key },
          signal: AbortSignal.timeout(this.options.timeoutMs ?? 30_000),
          redirect: "error",
        });
      } catch {
        if (attempt < (this.options.retries ?? 2)) {
          await this.sleep(250 * 2 ** attempt);
          continue;
        }
        throw new ProviderError(
          "unavailable",
          "Provider request timed out or failed",
        );
      }
      const transient =
        response.status === 429 ||
        [500, 502, 503, 504].includes(response.status);
      if (transient && attempt < (this.options.retries ?? 2)) {
        const retry = response.headers.get("retry-after");
        const seconds =
          retry && /^\d+(\.\d+)?$/.test(retry)
            ? Number(retry)
            : retry
              ? Math.max(0, (Date.parse(retry) - Date.now()) / 1000)
              : 0;
        // Do not retry before a long server-requested cooldown; expose it to caller.
        if (Number.isFinite(seconds) && seconds > 30)
          throw new ProviderError(
            "rate_limit",
            "Provider cooldown exceeds retry budget",
            response.status,
          );
        await response.body?.cancel();
        await this.sleep(
          Math.max(
            250 * 2 ** attempt,
            Number.isFinite(seconds) ? seconds * 1000 : 0,
          ),
        );
        continue;
      }
      if (!response.ok)
        throw new ProviderError(
          response.status === 429
            ? "rate_limit"
            : [401, 403].includes(response.status)
              ? "authentication"
              : response.status === 404
                ? "not_found"
                : "unavailable",
          `Provider HTTP ${response.status}`,
          response.status,
        );
      try {
        return await response.json();
      } catch {
        throw new ProviderError(
          "invalid_response",
          "Provider returned invalid JSON",
        );
      }
    }
  }
}
