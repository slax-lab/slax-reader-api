-- CreateTable
CREATE TABLE "slax_user" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "picture" TEXT NOT NULL DEFAULT '',
    "given_name" TEXT NOT NULL DEFAULT '',
    "family_name" TEXT NOT NULL DEFAULT '',
    "lang" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "region" TEXT NOT NULL DEFAULT '',
    "latitude" REAL NOT NULL DEFAULT 0,
    "longitude" REAL NOT NULL DEFAULT 0,
    "timezone" TEXT NOT NULL DEFAULT '',
    "account" TEXT NOT NULL DEFAULT '',
    "last_login_at" DATETIME NOT NULL,
    "last_login_ip" TEXT NOT NULL DEFAULT '',
    "last_read_at" DATETIME,
    "invite_code" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "slax_bookmark" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL DEFAULT '',
    "host_url" TEXT NOT NULL DEFAULT '',
    "target_url" TEXT NOT NULL DEFAULT '',
    "site_name" TEXT NOT NULL DEFAULT '',
    "content_icon" TEXT NOT NULL DEFAULT '',
    "content_cover" TEXT NOT NULL DEFAULT '',
    "content_key" TEXT NOT NULL DEFAULT '',
    "content_md_key" TEXT NOT NULL DEFAULT '',
    "content_word_count" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL DEFAULT '',
    "byline" TEXT NOT NULL DEFAULT '',
    "private_user" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" DATETIME NOT NULL,
    "updated_at" DATETIME NOT NULL,
    "published_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "slax_user_bookmark" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL DEFAULT 0,
    "bookmark_id" INTEGER NOT NULL DEFAULT 0,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "archive_status" INTEGER NOT NULL DEFAULT 0,
    "is_starred" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "alias_title" TEXT NOT NULL DEFAULT '',
    "type" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" DATETIME,
    CONSTRAINT "slax_user_bookmark_bookmark_id_fkey" FOREIGN KEY ("bookmark_id") REFERENCES "slax_bookmark" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "slax_queue_parse_info" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "target_url" TEXT NOT NULL DEFAULT '',
    "content_key" TEXT NOT NULL DEFAULT '',
    "server_parse" BOOLEAN NOT NULL DEFAULT false,
    "is_privated" BOOLEAN NOT NULL DEFAULT false,
    "bookmark_id" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL,
    "updated_at" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending'
);

-- CreateTable
CREATE TABLE "slax_bookmark_summary" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "content" TEXT NOT NULL DEFAULT '',
    "ai_name" TEXT NOT NULL DEFAULT '',
    "ai_model" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL,
    "updated_at" DATETIME,
    "lang" TEXT NOT NULL DEFAULT '',
    "user_id" INTEGER NOT NULL DEFAULT 0,
    "bookmark_id" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "slax_user_report" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "bookmark_id" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "slax_platform_bind" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL DEFAULT 0,
    "platform" TEXT NOT NULL DEFAULT '',
    "platform_id" TEXT NOT NULL DEFAULT '',
    "user_name" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "slax_mark_comment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL DEFAULT 0,
    "bookmark_id" INTEGER NOT NULL DEFAULT 0,
    "type" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT '',
    "comment" TEXT NOT NULL DEFAULT '',
    "root_id" INTEGER NOT NULL DEFAULT 0,
    "parent_id" INTEGER NOT NULL DEFAULT 0,
    "content" TEXT NOT NULL DEFAULT '',
    "source_type" TEXT NOT NULL DEFAULT '',
    "source_id" TEXT NOT NULL DEFAULT '',
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "slax_bookmark_share" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "share_code" TEXT NOT NULL DEFAULT '',
    "user_id" INTEGER NOT NULL DEFAULT 0,
    "bookmark_id" INTEGER NOT NULL DEFAULT 0,
    "show_line" BOOLEAN NOT NULL DEFAULT false,
    "show_comment" BOOLEAN NOT NULL DEFAULT false,
    "show_userinfo" BOOLEAN NOT NULL DEFAULT false,
    "allow_comment" BOOLEAN NOT NULL DEFAULT false,
    "allow_line" BOOLEAN NOT NULL DEFAULT false,
    "is_enable" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "slax_user_tag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL DEFAULT 0,
    "tag_name" TEXT NOT NULL DEFAULT '',
    "system_tag" BOOLEAN NOT NULL DEFAULT false,
    "display" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "slax_user_bookmark_tag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL DEFAULT 0,
    "bookmark_id" INTEGER NOT NULL DEFAULT 0,
    "tag_name" TEXT NOT NULL DEFAULT '',
    "tag_id" INTEGER NOT NULL DEFAULT 0,
    "system_tag" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "slax_user_bookmark_tag_user_id_bookmark_id_fkey" FOREIGN KEY ("user_id", "bookmark_id") REFERENCES "slax_user_bookmark" ("user_id", "bookmark_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "slax_user_bookmark_tag_bookmark_id_fkey" FOREIGN KEY ("bookmark_id") REFERENCES "slax_bookmark" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "slax_bookmark_import" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT '',
    "object_key" TEXT NOT NULL DEFAULT '',
    "status" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL DEFAULT '',
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "batch_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "slax_user_delete_bookmark" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL DEFAULT 0,
    "bookmark_id" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" DATETIME,
    CONSTRAINT "slax_user_delete_bookmark_user_id_bookmark_id_fkey" FOREIGN KEY ("user_id", "bookmark_id") REFERENCES "slax_user_bookmark" ("user_id", "bookmark_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "slax_bookmark_fetch_retry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL DEFAULT 0,
    "bookmark_id" INTEGER NOT NULL DEFAULT 0,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_retry_at" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "trace_id" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "slax_bookmark_vector_shard" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bookmark_id" INTEGER NOT NULL DEFAULT 0,
    "bucket_idx" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "slax_user_notification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "details" TEXT NOT NULL DEFAULT '',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "slax_user_notice_device" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT '',
    "data" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "slax_user_email_key" ON "slax_user"("email");

-- CreateIndex
CREATE INDEX "slax_user_account_idx" ON "slax_user"("account");

-- CreateIndex
CREATE INDEX "slax_user_invite_code_idx" ON "slax_user"("invite_code");

-- CreateIndex
CREATE UNIQUE INDEX "slax_bookmark_target_url_private_user_key" ON "slax_bookmark"("target_url", "private_user");

-- CreateIndex
CREATE INDEX "slax_user_bookmark_user_id_deleted_at_archive_status_updated_at_idx" ON "slax_user_bookmark"("user_id", "deleted_at", "archive_status", "updated_at");

-- CreateIndex
CREATE INDEX "slax_user_bookmark_user_id_deleted_at_is_starred_updated_at_idx" ON "slax_user_bookmark"("user_id", "deleted_at", "is_starred", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "slax_user_bookmark_user_id_bookmark_id_key" ON "slax_user_bookmark"("user_id", "bookmark_id");

-- CreateIndex
CREATE UNIQUE INDEX "slax_bookmark_summary_bookmark_id_lang_user_id_key" ON "slax_bookmark_summary"("bookmark_id", "lang", "user_id");

-- CreateIndex
CREATE INDEX "slax_platform_bind_platform_platform_id_idx" ON "slax_platform_bind"("platform", "platform_id");

-- CreateIndex
CREATE UNIQUE INDEX "slax_platform_bind_user_id_platform_key" ON "slax_platform_bind"("user_id", "platform");

-- CreateIndex
CREATE INDEX "slax_mark_comment_user_id_created_at_is_deleted_idx" ON "slax_mark_comment"("user_id", "created_at", "is_deleted");

-- CreateIndex
CREATE INDEX "slax_mark_comment_bookmark_id_root_id_is_deleted_idx" ON "slax_mark_comment"("bookmark_id", "root_id", "is_deleted");

-- CreateIndex
CREATE INDEX "slax_mark_comment_bookmark_id_type_is_deleted_idx" ON "slax_mark_comment"("bookmark_id", "type", "is_deleted");

-- CreateIndex
CREATE UNIQUE INDEX "slax_bookmark_share_share_code_key" ON "slax_bookmark_share"("share_code");

-- CreateIndex
CREATE UNIQUE INDEX "slax_bookmark_share_bookmark_id_user_id_key" ON "slax_bookmark_share"("bookmark_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "slax_user_tag_user_id_tag_name_system_tag_key" ON "slax_user_tag"("user_id", "tag_name", "system_tag");

-- CreateIndex
CREATE INDEX "slax_user_bookmark_tag_tag_id_user_id_is_deleted_idx" ON "slax_user_bookmark_tag"("tag_id", "user_id", "is_deleted");

-- CreateIndex
CREATE INDEX "slax_user_bookmark_tag_bookmark_id_user_id_is_deleted_idx" ON "slax_user_bookmark_tag"("bookmark_id", "user_id", "is_deleted");

-- CreateIndex
CREATE UNIQUE INDEX "slax_user_bookmark_tag_bookmark_id_user_id_tag_id_key" ON "slax_user_bookmark_tag"("bookmark_id", "user_id", "tag_id");

-- CreateIndex
CREATE INDEX "slax_bookmark_import_user_id_idx" ON "slax_bookmark_import"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "slax_user_delete_bookmark_user_id_bookmark_id_key" ON "slax_user_delete_bookmark"("user_id", "bookmark_id");

-- CreateIndex
CREATE INDEX "slax_bookmark_fetch_retry_status_idx" ON "slax_bookmark_fetch_retry"("status");

-- CreateIndex
CREATE UNIQUE INDEX "slax_bookmark_fetch_retry_bookmark_id_user_id_key" ON "slax_bookmark_fetch_retry"("bookmark_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "slax_bookmark_vector_shard_bookmark_id_key" ON "slax_bookmark_vector_shard"("bookmark_id");

-- CreateIndex
CREATE INDEX "slax_user_notification_user_id_created_at_idx" ON "slax_user_notification"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "slax_user_notice_device_user_id_type_idx" ON "slax_user_notice_device"("user_id", "type");

