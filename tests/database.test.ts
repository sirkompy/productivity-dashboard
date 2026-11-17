import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, expect, it, vi } from "vitest";
import { Repository, type Sql } from "../src/db/repository.js";
import { migrate } from "../src/db/migrate.js";
import { normalizePost, normalizeCreator } from "../src/providers/normalize.js";
import { backfill } from "../src/services/backfill.js";
import { recompute } from "../src/services/outliers.js";
import type {
  CreatorAccount,
  SocialDataProvider,
} from "../src/domain/types.js";
import instagram from "./fixtures/instagram.json";
let db: PGlite, repository: Repository, account: CreatorAccount;
const profile = normalizeCreator("instagram", "example", instagram),
  post = normalizePost("instagram", instagram.items[0]);
const provider: SocialDataProvider = {
  name: "scrapecreators",
  getCreator: async () => profile,
  getCreatorPosts: async () => ({
    posts: [post, post],
    warnings: [],
    completeness: "partial",
  }),
  getPost: async () => post,
  getTranscript: async () => ({
    text: "Public words",
    language: "en",
    metadata: {},
  }),
};
beforeAll(async () => {
  db = new PGlite();
  const sql: Sql = {
    query: async (text, values) => {
      if (text.includes("pg_advisory_xact_lock")) return { rows: [] };
      if (!values && text.includes("CREATE TABLE creators")) {
        await db.exec(text);
        return { rows: [] };
      }
      return db.query(text, values);
    },
  };
  await migrate(sql);
  await migrate(sql);
  repository = new Repository(sql, (fn) => db.transaction((tx) => fn(tx)));
  const created = (await repository.addCreator({
    displayName: "Example",
    primaryTopic: "GTM",
    creatorType: "both",
    priority: 1,
    platform: "instagram",
    profileUrl: profile.profileUrl,
    handle: "example",
  })) as { accountId: string };
  account = (await repository.accounts(undefined, created.accountId))[0]!;
}, 30_000);
afterAll(async () => {
  await db.close();
});
it("creates all six entities from migrations, records once and supports a watchlist", async () => {
  const result = await db.query("SELECT name FROM schema_migrations");
  expect(result.rows).toHaveLength(1);
  expect(account.platform).toBe("instagram");
  expect(await repository.accounts(account.creatorId)).toHaveLength(1);
});
it("ingests idempotent posts and appends snapshots on a subsequent capture", async () => {
  const first = await backfill(repository, provider, account, {
    capturedAt: "2025-02-01T00:00:00Z",
  });
  expect(first).toMatchObject({
    discovered: 1,
    inserted: 1,
    updated: 0,
    snapshotsCreated: 1,
    errors: [],
  });
  const updatedProvider = {
    ...provider,
    getCreatorPosts: async () => ({
      posts: [{ ...post, metrics: { ...post.metrics, likes: 200 } }],
      warnings: [],
      completeness: "partial" as const,
    }),
  };
  const second = await backfill(repository, updatedProvider, account, {
    capturedAt: "2025-02-02T00:00:00Z",
  });
  expect(second).toMatchObject({
    inserted: 0,
    updated: 1,
    snapshotsCreated: 1,
    errors: [],
  });
  const retry = await backfill(repository, provider, account, {
    capturedAt: "2025-02-02T00:00:00Z",
  });
  expect(retry.snapshotsCreated).toBe(0);
  expect((await db.query("SELECT * FROM posts")).rows).toHaveLength(1);
  expect(
    (await db.query("SELECT * FROM post_metric_snapshots")).rows,
  ).toHaveLength(2);
  const snapshots = await db.query(
    "SELECT likes FROM post_metric_snapshots ORDER BY captured_at",
  );
  expect(snapshots.rows.map((r: any) => Number(r.likes))).toEqual([100, 200]);
  const state = (await db.query("SELECT first_seen_at,last_seen_at FROM posts"))
    .rows[0] as any;
  expect(new Date(state.first_seen_at).toISOString()).toBe(
    "2025-02-01T00:00:00.000Z",
  );
});
it("enforces append-only snapshots and nonnegative constraints", async () => {
  await expect(
    db.query("UPDATE post_metric_snapshots SET likes=0"),
  ).rejects.toThrow("append-only");
  await expect(db.query("DELETE FROM post_metric_snapshots")).rejects.toThrow(
    "append-only",
  );
});
it("dry run calls provider but does not write account/posts/snapshots", async () => {
  const before = await db.query("SELECT * FROM creator_accounts");
  const summary = await backfill(repository, provider, account, {
    dryRun: true,
  });
  expect(summary).toMatchObject({
    dryRun: true,
    discovered: 1,
    inserted: 0,
    snapshotsCreated: 0,
  });
  expect((await db.query("SELECT * FROM creator_accounts")).rows).toEqual(
    before.rows,
  );
  expect(
    (await db.query("SELECT * FROM post_metric_snapshots")).rows,
  ).toHaveLength(2);
});
it("provider failures do not update collection metadata or posts", async () => {
  const before = (await db.query("SELECT * FROM creator_accounts")).rows;
  const summary = await backfill(
    repository,
    {
      ...provider,
      getCreatorPosts: async () => {
        throw new Error("sensitive");
      },
    },
    account,
  );
  expect(summary.errors).toHaveLength(1);
  expect(JSON.stringify(summary)).not.toContain("sensitive");
  expect((await db.query("SELECT * FROM creator_accounts")).rows).toEqual(
    before,
  );
});
it("rolls back the whole backfill on a database failure", async () => {
  const failing = new Repository(repository.sql, (fn) =>
    db.transaction(async (tx) => {
      const result = await fn(tx);
      throw new Error("force rollback");
      return result;
    }),
  );
  const summary = await backfill(
    failing,
    {
      ...provider,
      getCreatorPosts: async () => ({
        posts: [
          { ...post, canonicalUrl: "https://www.instagram.com/p/Rollback/" },
        ],
        warnings: [],
        completeness: "partial",
      }),
    },
    account,
  );
  expect(summary.errors).toHaveLength(1);
  expect(
    (
      await db.query(
        "SELECT * FROM posts WHERE canonical_url LIKE '%Rollback%'",
      )
    ).rows,
  ).toHaveLength(0);
});
it("persists latest metrics, transcripts and account-specific outlier scores; dry run is read only", async () => {
  const history = Array.from({ length: 22 }, (_, i) => ({
    ...post,
    canonicalUrl: `https://www.instagram.com/p/History${i}/`,
    publishedAt: new Date(Date.UTC(2024, 0, i + 1)).toISOString(),
    metrics: { ...post.metrics, likes: 10 },
  }));
  await repository.persistBackfill(
    account,
    profile,
    history,
    "2025-03-01T00:00:00Z",
  );
  const result = await recompute(repository, account.creatorId, true);
  expect(result[0]!.calculated).toBeGreaterThan(0);
  expect((await db.query("SELECT * FROM outlier_scores")).rows).toHaveLength(0);
  await recompute(repository, account.creatorId);
  const scores = await db.query("SELECT * FROM outlier_scores");
  expect(scores.rows.length).toBeGreaterThan(0);
  expect(
    scores.rows.some(
      (r: any) => r.baseline_metric === "likes" && Number(r.multiplier) === 20,
    ),
  ).toBe(true);
  const p = (await repository.scorable(account.id))[0]!;
  await repository.saveTranscript(
    p.id,
    "scrapecreators",
    { text: "Public transcript", language: null, metadata: {} },
    new Date().toISOString(),
  );
  expect((await db.query("SELECT * FROM transcripts")).rows).toHaveLength(1);
});
it("rejects cross-account ownership without partial writes", async () => {
  const other = { ...account, id: randomUUID() };
  await expect(
    repository.persistBackfill(
      other,
      profile,
      [post],
      new Date().toISOString(),
    ),
  ).rejects.toThrow();
});
it("continues across accounts via individually reported failures", async () => {
  const summary = await backfill(
    repository,
    { ...provider, name: "unconfigured" },
    account,
  );
  expect(summary.errors[0]).toContain("unsupported");
});

it("keeps inactive creators out of all-account workflows and makes watchlist reruns idempotent", async () => {
  const input = {
    displayName: "Inactive",
    primaryTopic: "GTM",
    creatorType: "both",
    priority: 0,
    platform: "instagram",
    profileUrl: "https://www.instagram.com/inactive/",
    handle: "inactive",
  };
  const first = (await repository.addCreator(input)) as {
    creatorId: string;
    accountId: string;
  };
  const second = await repository.addCreator(input);
  expect(second).toMatchObject({
    creatorId: first.creatorId,
    accountId: first.accountId,
    existing: true,
  });
  await db.query("UPDATE creators SET active=false WHERE id=$1", [
    first.creatorId,
  ]);
  expect(await repository.accounts(first.creatorId)).toHaveLength(0);
  expect(
    (await repository.accounts()).every((a) => a.creatorId !== first.creatorId),
  ).toBe(true);
  const scores = await recompute(repository, first.creatorId, true);
  expect(scores).toEqual([]);
});
