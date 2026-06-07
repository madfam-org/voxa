ALTER TABLE "boards" ADD COLUMN IF NOT EXISTS "owner_user_id" text;
--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN IF NOT EXISTS "org_id" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "board_members" (
  "id" text PRIMARY KEY NOT NULL,
  "board_id" text NOT NULL,
  "user_id" text NOT NULL,
  "role" text NOT NULL,
  "created_at" timestamptz NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "board_members" ADD CONSTRAINT "board_members_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "board_members_board_user_idx" ON "board_members" USING btree ("board_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "board_members_user_idx" ON "board_members" USING btree ("user_id");
