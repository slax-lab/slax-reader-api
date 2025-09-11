/*
  Warnings:

  - You are about to drop the `sr_queue_parse_info` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sr_user_bookmark_change` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sr_user_notice_device` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[uuid]` on the table `sr_bookmark` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `sr_bookmark_comment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `sr_bookmark_share` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `sr_bookmark_summary` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `sr_platform_bind` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `sr_user` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `sr_user_bookmark` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `sr_user_bookmark_overview` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `sr_user_bookmark_tag` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `sr_user_delete_bookmark` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `sr_user_notification` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `sr_user_tag` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."sr_bookmark" ADD COLUMN     "uuid" TEXT NOT NULL DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "public"."sr_bookmark_comment" ADD COLUMN     "uuid" TEXT NOT NULL DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "public"."sr_bookmark_share" ADD COLUMN     "uuid" TEXT NOT NULL DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "public"."sr_bookmark_summary" ADD COLUMN     "uuid" TEXT NOT NULL DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "public"."sr_platform_bind" ADD COLUMN     "uuid" TEXT NOT NULL DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "public"."sr_user" ADD COLUMN     "uuid" TEXT NOT NULL DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "public"."sr_user_bookmark" ADD COLUMN     "metadata" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "uuid" TEXT NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE "public"."sr_bookmark_comment" ADD COLUMN     "metadata" JSONB NOT NULL DEFAULT '{}';


-- AlterTable
ALTER TABLE "public"."sr_user_bookmark_overview" ADD COLUMN     "uuid" TEXT NOT NULL DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "public"."sr_user_bookmark_tag" ADD COLUMN     "uuid" TEXT NOT NULL DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "public"."sr_user_delete_bookmark" ADD COLUMN     "uuid" TEXT NOT NULL DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "public"."sr_user_notification" ADD COLUMN     "uuid" TEXT NOT NULL DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "public"."sr_user_tag" ADD COLUMN     "uuid" TEXT NOT NULL DEFAULT gen_random_uuid();

-- DropTable
DROP TABLE "public"."sr_queue_parse_info";

-- DropTable
DROP TABLE "public"."sr_user_bookmark_change";

-- DropTable
DROP TABLE "public"."sr_user_notice_device";

-- CreateIndex
CREATE UNIQUE INDEX "sr_bookmark_uuid_key" ON "public"."sr_bookmark"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "sr_bookmark_comment_uuid_key" ON "public"."sr_bookmark_comment"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "sr_bookmark_share_uuid_key" ON "public"."sr_bookmark_share"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "sr_bookmark_summary_uuid_key" ON "public"."sr_bookmark_summary"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "sr_platform_bind_uuid_key" ON "public"."sr_platform_bind"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "sr_user_uuid_key" ON "public"."sr_user"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "sr_user_bookmark_uuid_key" ON "public"."sr_user_bookmark"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "sr_user_bookmark_overview_uuid_key" ON "public"."sr_user_bookmark_overview"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "sr_user_bookmark_tag_uuid_key" ON "public"."sr_user_bookmark_tag"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "sr_user_delete_bookmark_uuid_key" ON "public"."sr_user_delete_bookmark"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "sr_user_notification_uuid_key" ON "public"."sr_user_notification"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "sr_user_tag_uuid_key" ON "public"."sr_user_tag"("uuid");
