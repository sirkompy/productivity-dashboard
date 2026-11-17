CREATE TABLE creators (
 id uuid PRIMARY KEY, display_name text NOT NULL, primary_topic text NOT NULL,
 creator_type text NOT NULL CHECK (creator_type IN ('educator','performer','both')),
 priority integer NOT NULL DEFAULT 0, active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE creator_accounts (
 id uuid PRIMARY KEY, creator_id uuid NOT NULL REFERENCES creators(id),
 platform text NOT NULL CHECK (platform IN ('linkedin','instagram')), handle text NOT NULL,
 profile_url text NOT NULL, provider text NOT NULL, provider_external_id text,
 followers_count bigint CHECK (followers_count >= 0), last_collected_at timestamptz,
 metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(platform, profile_url), UNIQUE(id, platform)
);
CREATE TABLE posts (
 id uuid PRIMARY KEY, creator_account_id uuid NOT NULL, platform text NOT NULL,
 provider text NOT NULL, provider_post_id text, canonical_url text NOT NULL,
 published_at timestamptz NOT NULL, text text, media_type text, raw_metadata jsonb NOT NULL DEFAULT '{}',
 first_seen_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (creator_account_id, platform) REFERENCES creator_accounts(id, platform), UNIQUE(platform, canonical_url)
);
CREATE INDEX posts_account_published ON posts(creator_account_id, published_at DESC);
CREATE TABLE post_metric_snapshots (
 id uuid PRIMARY KEY, post_id uuid NOT NULL REFERENCES posts(id), captured_at timestamptz NOT NULL,
 views bigint CHECK(views>=0), likes bigint CHECK(likes>=0), comments bigint CHECK(comments>=0),
 shares bigint CHECK(shares>=0), reposts bigint CHECK(reposts>=0), saves bigint CHECK(saves>=0),
 raw_metrics jsonb NOT NULL DEFAULT '{}', UNIQUE(post_id, captured_at)
);
CREATE FUNCTION reject_metric_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Metric snapshots are append-only'; END;
$$;
CREATE TRIGGER immutable_metric_snapshots BEFORE UPDATE OR DELETE ON post_metric_snapshots
 FOR EACH ROW EXECUTE FUNCTION reject_metric_mutation();
CREATE TABLE transcripts (
 id uuid PRIMARY KEY, post_id uuid NOT NULL REFERENCES posts(id), provider text NOT NULL,
 text text NOT NULL, language text, captured_at timestamptz NOT NULL, metadata jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE outlier_scores (
 id uuid PRIMARY KEY, post_id uuid NOT NULL REFERENCES posts(id), calculated_at timestamptz NOT NULL,
 baseline_window integer NOT NULL CHECK(baseline_window > 0), baseline_metric text NOT NULL CHECK(baseline_metric IN ('views','likes','comments','shares','reposts','saves')),
 baseline_median double precision NOT NULL CHECK(baseline_median > 0), post_metric_value bigint NOT NULL CHECK(post_metric_value>=0),
 multiplier double precision NOT NULL CHECK(multiplier>=0),
 bucket text NOT NULL CHECK(bucket IN ('normal','mild','strong','huge')),
 confidence text NOT NULL CHECK(confidence IN ('low','medium','high')), details jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX scores_post_calculated ON outlier_scores(post_id, calculated_at DESC);
