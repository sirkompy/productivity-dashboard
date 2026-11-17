import { randomUUID } from "node:crypto";
import type {
  CreatorAccount,
  CreatorProfile,
  SocialPost,
  ScorablePost,
  OutlierScore,
  Transcript,
} from "../domain/types.js";
export interface Sql {
  query(text: string, values?: any[]): Promise<{ rows: any[] }>;
}
export interface Store {
  accounts(creatorId?: string, accountId?: string): Promise<CreatorAccount[]>;
  persistBackfill(
    account: CreatorAccount,
    profile: CreatorProfile,
    posts: SocialPost[],
    capturedAt: string,
  ): Promise<{ inserted: number; updated: number; snapshotsCreated: number }>;
  scorable(accountId: string): Promise<ScorablePost[]>;
  saveScores(scores: OutlierScore[], at: string): Promise<void>;
}
export class Repository implements Store {
  constructor(
    readonly sql: Sql,
    private readonly transaction: <T>(
      fn: (sql: Sql) => Promise<T>,
    ) => Promise<T>,
  ) {}
  async accounts(
    creatorId?: string,
    accountId?: string,
  ): Promise<CreatorAccount[]> {
    const { rows } = await this.sql.query(
      `SELECT a.id,a.creator_id AS "creatorId",a.platform,a.handle,a.profile_url AS "profileUrl",a.provider FROM creator_accounts a JOIN creators c ON c.id=a.creator_id WHERE c.active AND ($1::uuid IS NULL OR c.id=$1) AND ($2::uuid IS NULL OR a.id=$2) ORDER BY c.priority DESC,a.id`,
      [creatorId ?? null, accountId ?? null],
    );
    return rows;
  }
  async addCreator(
    input: {
      displayName: string;
      primaryTopic: string;
      creatorType: string;
      priority: number;
      platform: string;
      profileUrl: string;
      handle: string;
    },
    dryRun = false,
  ) {
    if (dryRun) return { dryRun: true, ...input };
    return this.transaction(async (sql) => {
      const existing = await sql.query(
        "SELECT creator_id,id FROM creator_accounts WHERE platform=$1 AND profile_url=$2",
        [input.platform, input.profileUrl],
      );
      if (existing.rows[0])
        return {
          creatorId: existing.rows[0].creator_id,
          accountId: existing.rows[0].id,
          existing: true,
        };
      const creatorId = randomUUID(),
        accountId = randomUUID();
      await sql.query(
        "INSERT INTO creators(id,display_name,primary_topic,creator_type,priority) VALUES($1,$2,$3,$4,$5)",
        [
          creatorId,
          input.displayName,
          input.primaryTopic,
          input.creatorType,
          input.priority,
        ],
      );
      await sql.query(
        "INSERT INTO creator_accounts(id,creator_id,platform,handle,profile_url,provider) VALUES($1,$2,$3,$4,$5,$6)",
        [
          accountId,
          creatorId,
          input.platform,
          input.handle,
          input.profileUrl,
          "scrapecreators",
        ],
      );
      return { creatorId, accountId, existing: false };
    });
  }
  async persistBackfill(
    account: CreatorAccount,
    profile: CreatorProfile,
    posts: SocialPost[],
    capturedAt: string,
  ) {
    return this.transaction(async (sql) => {
      // Serialize account backfills, including concurrent workers.
      await sql.query(
        "SELECT id FROM creator_accounts WHERE id=$1 FOR UPDATE",
        [account.id],
      );
      let inserted = 0,
        updated = 0,
        snapshotsCreated = 0;
      for (const post of posts) {
        const result = await sql.query(
          `INSERT INTO posts(id,creator_account_id,platform,provider,provider_post_id,canonical_url,published_at,text,media_type,raw_metadata,first_seen_at,last_seen_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) ON CONFLICT(platform,canonical_url) DO NOTHING RETURNING id`,
          [
            randomUUID(),
            account.id,
            post.platform,
            post.provider,
            post.providerPostId,
            post.canonicalUrl,
            post.publishedAt,
            post.text,
            post.mediaType,
            JSON.stringify(post.rawMetadata),
            capturedAt,
          ],
        );
        let id = result.rows[0]?.id;
        if (id) inserted++;
        else {
          const result = await sql.query(
            `UPDATE posts SET provider=$3,provider_post_id=COALESCE($4,provider_post_id),text=COALESCE($5,text),media_type=COALESCE($6,media_type),raw_metadata=$7,last_seen_at=GREATEST(last_seen_at,$8::timestamptz) WHERE platform=$1 AND canonical_url=$2 AND creator_account_id=$9 RETURNING id`,
            [
              post.platform,
              post.canonicalUrl,
              post.provider,
              post.providerPostId,
              post.text,
              post.mediaType,
              JSON.stringify(post.rawMetadata),
              capturedAt,
              account.id,
            ],
          );
          id = result.rows[0]?.id;
          if (!id)
            throw new Error("Post belongs to a different creator account");
          updated++;
        }
        const m = post.metrics;
        const snap = await sql.query(
          `INSERT INTO post_metric_snapshots(id,post_id,captured_at,views,likes,comments,shares,reposts,saves,raw_metrics) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(post_id,captured_at) DO NOTHING RETURNING id`,
          [
            randomUUID(),
            id,
            capturedAt,
            m.views,
            m.likes,
            m.comments,
            m.shares,
            m.reposts,
            m.saves,
            JSON.stringify(post.rawMetrics),
          ],
        );
        snapshotsCreated += snap.rows.length;
      }
      await sql.query(
        `UPDATE creator_accounts SET handle=$2,provider_external_id=$3,followers_count=$4,metadata=$5,last_collected_at=GREATEST(last_collected_at,$6::timestamptz),updated_at=now() WHERE id=$1`,
        [
          account.id,
          profile.handle,
          profile.externalId,
          profile.followersCount,
          JSON.stringify(profile.metadata),
          capturedAt,
        ],
      );
      return { inserted, updated, snapshotsCreated };
    });
  }
  async scorable(accountId: string): Promise<ScorablePost[]> {
    const { rows } = await this.sql.query(
      `SELECT p.id,p.published_at,p.media_type,m.views,m.likes,m.comments,m.shares,m.reposts,m.saves FROM posts p JOIN LATERAL (SELECT * FROM post_metric_snapshots s WHERE s.post_id=p.id ORDER BY captured_at DESC LIMIT 1) m ON true WHERE p.creator_account_id=$1 ORDER BY p.published_at DESC,p.id LIMIT 200`,
      [accountId],
    );
    return rows.map((r) => ({
      id: r.id,
      publishedAt: new Date(r.published_at).toISOString(),
      mediaType: r.media_type,
      metrics: Object.fromEntries(
        ["views", "likes", "comments", "shares", "reposts", "saves"].map(
          (k) => [k, r[k] === null ? null : Number(r[k])],
        ),
      ) as ScorablePost["metrics"],
    }));
  }
  async saveScores(scores: OutlierScore[], at: string) {
    await this.transaction(async (sql) => {
      for (const s of scores)
        await sql.query(
          `INSERT INTO outlier_scores(id,post_id,calculated_at,baseline_window,baseline_metric,baseline_median,post_metric_value,multiplier,bucket,confidence,details) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            randomUUID(),
            s.postId,
            at,
            s.baselineWindow,
            s.baselineMetric,
            s.baselineMedian,
            s.postMetricValue,
            s.multiplier,
            s.bucket,
            s.confidence,
            JSON.stringify(s.details),
          ],
        );
    });
  }
  async saveTranscript(
    postId: string,
    provider: string,
    transcript: Transcript,
    at: string,
  ) {
    await this.sql.query(
      "INSERT INTO transcripts(id,post_id,provider,text,language,captured_at,metadata) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        randomUUID(),
        postId,
        provider,
        transcript.text,
        transcript.language,
        at,
        JSON.stringify(transcript.metadata),
      ],
    );
  }
}
