CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"fields" jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
