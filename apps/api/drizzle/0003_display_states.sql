CREATE TABLE IF NOT EXISTS "display_states" (
	"code" text PRIMARY KEY NOT NULL,
	"state" jsonb NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
