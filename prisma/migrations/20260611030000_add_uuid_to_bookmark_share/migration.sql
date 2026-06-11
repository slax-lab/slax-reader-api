-- AlterTable
ALTER TABLE "sr_bookmark_share" ADD COLUMN "uuid" TEXT NOT NULL DEFAULT gen_random_uuid();

-- CreateIndex
CREATE UNIQUE INDEX "sr_bookmark_share_uuid_key" ON "sr_bookmark_share"("uuid");
