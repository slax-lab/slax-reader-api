-- DropIndex
DROP INDEX "public"."sr_bookmark_comment_user_bookmark_uuid_key";

-- CreateIndex
CREATE INDEX "sr_bookmark_comment_user_bookmark_uuid_idx" ON "sr_bookmark_comment"("user_bookmark_uuid");
