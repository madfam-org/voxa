CREATE TABLE "ws_tickets" (
	"ticket_hash" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"org_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ws_tickets_expires_idx" ON "ws_tickets" USING btree ("expires_at");