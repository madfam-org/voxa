CREATE INDEX "boards_owner_user_idx" ON "boards" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "boards_org_idx" ON "boards" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "media_assets_owner_user_idx" ON "media_assets" USING btree ("owner_user_id");