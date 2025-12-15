ALTER TABLE "sr_bookmark_comment" ADD COLUMN "user_bookmark_uuid" TEXT DEFAULT '';

UPDATE "sr_bookmark_comment" AS bc
SET "user_bookmark_uuid" = ub.uuid
FROM "sr_user_bookmark" AS ub
WHERE bc.user_id = ub.user_id
  AND bc.bookmark_id = ub.bookmark_id
  AND bc.user_bookmark_uuid = '';

ALTER TABLE "sr_bookmark_comment" ALTER COLUMN "user_bookmark_uuid" SET NOT NULL;

CREATE UNIQUE INDEX "sr_bookmark_comment_user_bookmark_uuid_key" ON "sr_bookmark_comment"("user_bookmark_uuid");
