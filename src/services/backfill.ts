import {
  postSchema,
  type CreatorAccount,
  type SocialDataProvider,
} from "../domain/types.js";
import type { Store } from "../db/repository.js";
import { ProviderError } from "../providers/http.js";
export async function backfill(
  store: Store,
  provider: SocialDataProvider,
  account: CreatorAccount,
  options: { dryRun?: boolean; limit?: number; capturedAt?: string } = {},
) {
  const summary = {
    creator: account.creatorId,
    account: account.id,
    discovered: 0,
    inserted: 0,
    updated: 0,
    snapshotsCreated: 0,
    dryRun: options.dryRun ?? false,
    completeness: "partial",
    warnings: [] as string[],
    errors: [] as string[],
  };
  try {
    if (account.provider !== provider.name)
      throw new ProviderError(
        "unsupported",
        "Account provider is not configured",
      );
    const profile = await provider.getCreator(
      account.platform,
      account.profileUrl,
    );
    if (
      profile.platform !== account.platform ||
      profile.profileUrl !== account.profileUrl
    ) {
      throw new ProviderError(
        "invalid_response",
        "Profile does not match the requested account",
      );
    }
    const feed = await provider.getCreatorPosts(
      account.platform,
      account.profileUrl,
      { limit: options.limit ?? 30 },
    );
    summary.warnings = feed.warnings;
    summary.completeness = feed.completeness;
    const unique = new Map<string, ReturnType<typeof postSchema.parse>>();
    for (const item of feed.posts) {
      const post = postSchema.parse(item);
      if (post.platform !== account.platform || post.provider !== provider.name)
        throw new ProviderError(
          "invalid_response",
          "Post provider/platform mismatch",
        );
      unique.set(`${post.platform}:${post.canonicalUrl}`, post);
    }
    summary.discovered = unique.size;
    if (!options.dryRun)
      Object.assign(
        summary,
        await store.persistBackfill(
          account,
          profile,
          [...unique.values()],
          options.capturedAt ?? new Date().toISOString(),
        ),
      );
  } catch (error) {
    summary.errors.push(
      error instanceof ProviderError
        ? `${error.code}: ${error.message}`
        : "Backfill failed validation or database persistence; transaction rolled back.",
    );
  }
  return summary;
}
