CREATE TABLE IF NOT EXISTS "boards" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "profile_id" text NOT NULL,
  "grid" jsonb NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "updated_at" timestamptz NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sync_events" (
  "id" text PRIMARY KEY NOT NULL,
  "type" text NOT NULL,
  "board_id" text NOT NULL,
  "version" integer NOT NULL,
  "actor_user_id" text NOT NULL,
  "timestamp" timestamptz NOT NULL,
  "payload" jsonb
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sync_events" ADD CONSTRAINT "sync_events_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sync_events_board_version_idx" ON "sync_events" USING btree ("board_id","version");
