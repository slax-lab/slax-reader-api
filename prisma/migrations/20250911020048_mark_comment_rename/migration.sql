/*
  Warnings:

  - You are about to drop the `sr_mark_comment` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateTable
CREATE TABLE "public"."sr_bookmark_comment" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL DEFAULT 0,
    "bookmark_id" INTEGER NOT NULL DEFAULT 0,
    "type" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT '',
    "comment" TEXT NOT NULL DEFAULT '',
    "root_id" INTEGER NOT NULL DEFAULT 0,
    "parent_id" INTEGER NOT NULL DEFAULT 0,
    "approx_source" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "source_type" TEXT NOT NULL DEFAULT '',
    "source_id" TEXT NOT NULL DEFAULT '',
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sr_bookmark_comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sr_bookmark_comment_user_id_created_at_is_deleted_idx" ON "public"."sr_bookmark_comment"("user_id", "created_at", "is_deleted");

-- CreateIndex
CREATE INDEX "sr_bookmark_comment_bookmark_id_root_id_is_deleted_idx" ON "public"."sr_bookmark_comment"("bookmark_id", "root_id", "is_deleted");

-- CreateIndex
CREATE INDEX "sr_bookmark_comment_bookmark_id_type_is_deleted_idx" ON "public"."sr_bookmark_comment"("bookmark_id", "type", "is_deleted");

INSERT INTO "public"."sr_bookmark_comment" ("bookmark_id", "comment", "content", "created_at", "id", "is_deleted", "parent_id", "root_id", "source", "source_id", "source_type", "type", "updated_at", "user_id") SELECT "bookmark_id", "comment", "content", "created_at", "id", "is_deleted", "parent_id", "root_id", "source", "source_id", "source_type", "type", "updated_at", "user_id" FROM "public"."sr_mark_comment";

-- DropTable
DROP TABLE "public"."sr_mark_comment";
