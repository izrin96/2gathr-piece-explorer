CREATE TABLE "app_credential" (
	"service" text PRIMARY KEY,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"access_expires_at" timestamp with time zone NOT NULL,
	"refresh_expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "piece_book" (
	"id" text PRIMARY KEY,
	"title" text NOT NULL,
	"reward_type" text,
	"total_slots" integer NOT NULL,
	"start_at" timestamp with time zone,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "piece_book_slot" (
	"id" text PRIMARY KEY,
	"book_id" text NOT NULL,
	"contract_address" citext NOT NULL,
	"display_order" integer,
	"is_hidden_reward" boolean NOT NULL
);
--> statement-breakpoint
CREATE INDEX "piece_book_slot_book_id_idx" ON "piece_book_slot" ("book_id");