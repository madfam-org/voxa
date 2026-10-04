CREATE TABLE "consent_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"purpose" text NOT NULL,
	"granted" boolean NOT NULL,
	"policy_version" text NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"user_id" text NOT NULL,
	"purpose" text NOT NULL,
	"granted" boolean NOT NULL,
	"policy_version" text NOT NULL,
	"granted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "consents_user_id_purpose_pk" PRIMARY KEY("user_id","purpose")
);
--> statement-breakpoint
ALTER TABLE "activation_events" ADD COLUMN "speech_text_consented" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "consent_events_user_recorded_idx" ON "consent_events" USING btree ("user_id","recorded_at");