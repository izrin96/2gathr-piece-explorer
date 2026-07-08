CREATE TABLE "address_profile" (
	"address" citext PRIMARY KEY,
	"nickname" text,
	"avatar_url" text,
	"hidden_from_leaderboard" text,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "piece_design_meta" (
	"contract_address" citext PRIMARY KEY,
	"member" text,
	"design_number" integer,
	"edition" text NOT NULL,
	"rarity" integer,
	"class" text,
	"image_url" text,
	"thumbnail_url" text,
	"animation_url" text,
	"media_type" text,
	"is_hidden" boolean,
	"artist" text,
	"series" text,
	"type" text,
	"serial" integer,
	"topport_id" integer,
	"release_datetime" timestamp with time zone,
	"price" integer,
	"raw_metadata" jsonb,
	"fetched_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rollup_stat" (
	"scope" text,
	"key" text,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "rollup_stat_pkey" PRIMARY KEY("scope","key")
);
--> statement-breakpoint
CREATE INDEX "piece_design_meta_member_idx" ON "piece_design_meta" ("member");--> statement-breakpoint
CREATE INDEX "piece_design_meta_series_idx" ON "piece_design_meta" ("series");--> statement-breakpoint
CREATE INDEX "piece_design_meta_type_idx" ON "piece_design_meta" ("type");