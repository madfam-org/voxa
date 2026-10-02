-- Idempotent on purpose: this file existed before it was listed in
-- meta/_journal.json, so some databases may already have "media_assets"
-- (created by hand or by `drizzle-kit push`). Every statement is a no-op
-- when its object already exists.
CREATE TABLE IF NOT EXISTS "media_assets" (
  "id" text PRIMARY KEY NOT NULL,
  "board_id" text NOT NULL,
  "owner_user_id" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "data" text NOT NULL,
  "created_at" timestamptz NOT NULL
);
--> statement-breakpoint
-- Add the board FK only when media_assets has no FK to boards yet (under any
-- name). It is added NOT VALID and then validated, so a pre-existing table
-- holding rows for deleted boards cannot abort the startup migration: the
-- constraint still applies to new rows and the skipped validation is logged
-- as a WARNING.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.media_assets'::regclass
      AND confrelid = 'public.boards'::regclass
      AND contype = 'f'
  ) THEN
    ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
    BEGIN
      ALTER TABLE "media_assets" VALIDATE CONSTRAINT "media_assets_board_id_boards_id_fk";
    EXCEPTION
      WHEN foreign_key_violation THEN
        RAISE WARNING 'media_assets_board_id_boards_id_fk left NOT VALID: media_assets has rows whose board no longer exists';
    END;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_assets_board_idx" ON "media_assets" USING btree ("board_id");
