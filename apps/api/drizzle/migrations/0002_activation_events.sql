CREATE TABLE IF NOT EXISTS "activation_events" (
  "id" text PRIMARY KEY NOT NULL,
  "board_id" text NOT NULL,
  "button_id" text NOT NULL,
  "user_id" text NOT NULL,
  "speech_text" text,
  "recorded_at" timestamptz NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "activation_events" ADD CONSTRAINT "activation_events_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activation_events_board_recorded_idx" ON "activation_events" USING btree ("board_id","recorded_at");
