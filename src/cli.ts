import { parseArgs } from "node:util";
import { z } from "zod";
import { connect } from "./db/connect.js";
import { migrate } from "./db/migrate.js";
import { platformSchema, metricNames } from "./domain/types.js";
import { profileUrl } from "./providers/normalize.js";
import { ScrapeCreatorsProvider } from "./providers/scrapecreators.js";
import { backfill } from "./services/backfill.js";
import { recompute } from "./services/outliers.js";
async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      "dry-run": { type: "boolean" },
      all: { type: "boolean" },
      account: { type: "string" },
      creator: { type: "string" },
      platform: { type: "string" },
      url: { type: "string" },
      name: { type: "string" },
      topic: { type: "string" },
      type: { type: "string" },
      priority: { type: "string" },
      limit: { type: "string" },
      metric: { type: "string" },
    },
  });
  const command = positionals[0];
  if (!command || command === "help") {
    console.log(
      "Commands: migrate | watchlist:add --platform instagram|linkedin --url URL --name NAME --topic TOPIC [--type educator|performer|both] | ingest (--account UUID | --all) [--limit 20..50] | outliers (--creator UUID | --all) [--metric likes|views|comments|shares|reposts|saves]. Mutations support --dry-run (except migrate).",
    );
    return;
  }
  if (!["migrate", "watchlist:add", "ingest", "outliers"].includes(command))
    throw new Error("Unknown command");
  const uuid = z.uuid();
  if (command === "ingest" && Boolean(values.account) === Boolean(values.all))
    throw new Error("Choose --account or --all");
  if (command === "outliers" && Boolean(values.creator) === Boolean(values.all))
    throw new Error("Choose --creator or --all");
  if (values.account) uuid.parse(values.account);
  if (values.creator) uuid.parse(values.creator);
  const db = connect();
  try {
    let result: unknown;
    if (command === "migrate") {
      if (values["dry-run"])
        throw new Error(
          "Migration dry-run is unsupported; use a disposable database",
        );
      const client = await db.pool.connect();
      try {
        await migrate(client);
      } finally {
        client.release();
      }
      result = { migrated: true };
    } else if (command === "watchlist:add") {
      const platform = platformSchema.parse(values.platform);
      const url = profileUrl(platform, z.string().min(1).parse(values.url));
      result = await db.repository.addCreator(
        {
          displayName: z.string().min(1).parse(values.name),
          primaryTopic: z.string().min(1).parse(values.topic),
          creatorType: z
            .enum(["educator", "performer", "both"])
            .parse(values.type ?? "both"),
          priority: z.coerce
            .number()
            .int()
            .parse(values.priority ?? 0),
          platform,
          profileUrl: url,
          handle: new URL(url).pathname.split("/").filter(Boolean).at(-1)!,
        },
        values["dry-run"],
      );
    } else if (command === "ingest") {
      const accounts = await db.repository.accounts(undefined, values.account);
      if (!accounts.length)
        throw new Error("No active creator accounts matched");
      const limit = z.coerce
        .number()
        .int()
        .min(20)
        .max(50)
        .parse(values.limit ?? 30);
      const provider = new ScrapeCreatorsProvider();
      const results = [];
      for (const account of accounts)
        results.push(
          await backfill(db.repository, provider, account, {
            dryRun: values["dry-run"],
            limit,
          }),
        );
      result = results;
      if (results.some((r) => r.errors.length)) process.exitCode = 1;
    } else {
      const metric = z.enum(metricNames).parse(values.metric ?? "likes");
      result = await recompute(
        db.repository,
        values.creator,
        values["dry-run"],
        metric,
      );
      if (!(result as unknown[]).length)
        throw new Error("No active creator accounts matched");
    }
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await db.pool.end();
  }
}
main().catch(() => {
  console.error(
    "Command failed. Check arguments, DATABASE_URL, database migrations and provider configuration. No credentials or external error bodies are logged.",
  );
  process.exitCode = 1;
});
