CREATE TABLE IF NOT EXISTS "media_assets" (
  "id" text PRIMARY KEY NOT NULL,
  "board_id" text NOT NULL,
  "owner_user_id" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "data" text NOT NULL,
  "created_at" timestamptz NOT NULL
);

ALTER TABLE "media_assets"
  ADD CONSTRAINT "media_assets_board_id_boards_id_fk"
  FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE INDEX IF NOT EXISTS "media_assets_board_idx" ON "media_assets" USING btree ("board_id");
