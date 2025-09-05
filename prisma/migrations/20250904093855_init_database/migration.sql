-- CreateTable
CREATE TABLE "public"."s_user" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "picture" TEXT NOT NULL DEFAULT '',
    "given_name" TEXT NOT NULL DEFAULT '',
    "family_name" TEXT NOT NULL DEFAULT '',
    "lang" TEXT NOT NULL DEFAULT '',
    "ai_lang" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "region" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "longitude" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timezone" TEXT NOT NULL DEFAULT '',
    "account" TEXT NOT NULL DEFAULT '',
    "last_login_at" TIMESTAMP(3) NOT NULL,
    "last_login_ip" TEXT NOT NULL DEFAULT '',
    "last_read_at" TIMESTAMP(3),
    "invite_code" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "s_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."s_user_notification" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "details" TEXT NOT NULL DEFAULT '',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "s_user_notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."s_bookmark" (
    "id" SERIAL NOT NULL,
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
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "s_bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."s_user_bookmark" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL DEFAULT 0,
    "bookmark_id" INTEGER NOT NULL DEFAULT 0,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "archive_status" INTEGER NOT NULL DEFAULT 0,
    "is_starred" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "alias_title" TEXT NOT NULL DEFAULT '',
    "type" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "s_user_bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."s_user_bookmark_tag" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL DEFAULT 0,
    "bookmark_id" INTEGER NOT NULL DEFAULT 0,
    "tag_name" TEXT NOT NULL DEFAULT '',
    "tag_id" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "s_user_bookmark_tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."s_user_delete_bookmark" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL DEFAULT 0,
    "bookmark_id" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "s_user_delete_bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."s_user_tag" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL DEFAULT 0,
    "tag_name" TEXT NOT NULL DEFAULT '',
    "display" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "s_user_tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."s_mark_comment" (
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

    CONSTRAINT "s_mark_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."s_queue_parse_info" (
    "id" SERIAL NOT NULL,
    "target_url" TEXT NOT NULL DEFAULT '',
    "content_key" TEXT NOT NULL DEFAULT '',
    "server_parse" BOOLEAN NOT NULL DEFAULT false,
    "is_privated" BOOLEAN NOT NULL DEFAULT false,
    "bookmark_id" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "s_queue_parse_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."s_bookmark_summary" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "ai_name" TEXT NOT NULL DEFAULT '',
    "ai_model" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3),
    "lang" TEXT NOT NULL DEFAULT '',
    "user_id" INTEGER NOT NULL DEFAULT 0,
    "bookmark_id" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "s_bookmark_summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."s_user_report" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "bookmark_id" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "s_user_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."s_platform_bind" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL DEFAULT 0,
    "platform" TEXT NOT NULL DEFAULT '',
    "platform_id" TEXT NOT NULL DEFAULT '',
    "user_name" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "s_platform_bind_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."s_bookmark_share" (
    "id" SERIAL NOT NULL,
    "share_code" TEXT NOT NULL DEFAULT '',
    "user_id" INTEGER NOT NULL DEFAULT 0,
    "bookmark_id" INTEGER NOT NULL DEFAULT 0,
    "show_line" BOOLEAN NOT NULL DEFAULT false,
    "show_comment" BOOLEAN NOT NULL DEFAULT false,
    "show_userinfo" BOOLEAN NOT NULL DEFAULT false,
    "allow_comment" BOOLEAN NOT NULL DEFAULT false,
    "allow_line" BOOLEAN NOT NULL DEFAULT false,
    "is_enable" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "s_bookmark_share_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."s_bookmark_import" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT '',
    "object_key" TEXT NOT NULL DEFAULT '',
    "status" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL DEFAULT '',
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "batch_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "s_bookmark_import_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."s_bookmark_fetch_retry" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL DEFAULT 0,
    "bookmark_id" INTEGER NOT NULL DEFAULT 0,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_retry_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "trace_id" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "s_bookmark_fetch_retry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."s_bookmark_vector_shard" (
    "id" SERIAL NOT NULL,
    "bookmark_id" INTEGER NOT NULL DEFAULT 0,
    "bucket_idx" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "s_bookmark_vector_shard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."s_user_notice_device" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT '',
    "data" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "s_user_notice_device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."s_user_bookmark_change" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL DEFAULT 0,
    "target_url" TEXT NOT NULL DEFAULT '',
    "bookmark_id" INTEGER NOT NULL DEFAULT 0,
    "action" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "s_user_bookmark_change_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."s_user_bookmark_overview" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL DEFAULT 0,
    "bookmark_id" INTEGER NOT NULL DEFAULT 0,
    "overview" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "s_user_bookmark_overview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "s_user_email_key" ON "public"."s_user"("email");

-- CreateIndex
CREATE INDEX "s_user_account_idx" ON "public"."s_user"("account");

-- CreateIndex
CREATE INDEX "s_user_invite_code_idx" ON "public"."s_user"("invite_code");

-- CreateIndex
CREATE INDEX "s_user_notification_user_id_created_at_idx" ON "public"."s_user_notification"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "s_bookmark_target_url_private_user_key" ON "public"."s_bookmark"("target_url", "private_user");

-- CreateIndex
CREATE INDEX "s_user_bookmark_user_id_deleted_at_archive_status_updated_a_idx" ON "public"."s_user_bookmark"("user_id", "deleted_at", "archive_status", "updated_at");

-- CreateIndex
CREATE INDEX "s_user_bookmark_user_id_deleted_at_is_starred_updated_at_idx" ON "public"."s_user_bookmark"("user_id", "deleted_at", "is_starred", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "s_user_bookmark_user_id_bookmark_id_key" ON "public"."s_user_bookmark"("user_id", "bookmark_id");

-- CreateIndex
CREATE INDEX "s_user_bookmark_tag_tag_id_user_id_is_deleted_idx" ON "public"."s_user_bookmark_tag"("tag_id", "user_id", "is_deleted");

-- CreateIndex
CREATE INDEX "s_user_bookmark_tag_bookmark_id_user_id_is_deleted_idx" ON "public"."s_user_bookmark_tag"("bookmark_id", "user_id", "is_deleted");

-- CreateIndex
CREATE UNIQUE INDEX "s_user_bookmark_tag_bookmark_id_user_id_tag_id_key" ON "public"."s_user_bookmark_tag"("bookmark_id", "user_id", "tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "s_user_delete_bookmark_user_id_bookmark_id_key" ON "public"."s_user_delete_bookmark"("user_id", "bookmark_id");

-- CreateIndex
CREATE UNIQUE INDEX "s_user_tag_user_id_tag_name_key" ON "public"."s_user_tag"("user_id", "tag_name");

-- CreateIndex
CREATE INDEX "s_mark_comment_user_id_created_at_is_deleted_idx" ON "public"."s_mark_comment"("user_id", "created_at", "is_deleted");

-- CreateIndex
CREATE INDEX "s_mark_comment_bookmark_id_root_id_is_deleted_idx" ON "public"."s_mark_comment"("bookmark_id", "root_id", "is_deleted");

-- CreateIndex
CREATE INDEX "s_mark_comment_bookmark_id_type_is_deleted_idx" ON "public"."s_mark_comment"("bookmark_id", "type", "is_deleted");

-- CreateIndex
CREATE UNIQUE INDEX "s_bookmark_summary_bookmark_id_lang_user_id_key" ON "public"."s_bookmark_summary"("bookmark_id", "lang", "user_id");

-- CreateIndex
CREATE INDEX "s_platform_bind_platform_platform_id_idx" ON "public"."s_platform_bind"("platform", "platform_id");

-- CreateIndex
CREATE UNIQUE INDEX "s_platform_bind_user_id_platform_key" ON "public"."s_platform_bind"("user_id", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "s_bookmark_share_share_code_key" ON "public"."s_bookmark_share"("share_code");

-- CreateIndex
CREATE UNIQUE INDEX "s_bookmark_share_bookmark_id_user_id_key" ON "public"."s_bookmark_share"("bookmark_id", "user_id");

-- CreateIndex
CREATE INDEX "s_bookmark_import_user_id_idx" ON "public"."s_bookmark_import"("user_id");

-- CreateIndex
CREATE INDEX "s_bookmark_fetch_retry_status_idx" ON "public"."s_bookmark_fetch_retry"("status");

-- CreateIndex
CREATE UNIQUE INDEX "s_bookmark_fetch_retry_bookmark_id_user_id_key" ON "public"."s_bookmark_fetch_retry"("bookmark_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "s_bookmark_vector_shard_bookmark_id_key" ON "public"."s_bookmark_vector_shard"("bookmark_id");

-- CreateIndex
CREATE INDEX "s_user_notice_device_user_id_type_idx" ON "public"."s_user_notice_device"("user_id", "type");

-- CreateIndex
CREATE INDEX "s_user_bookmark_change_user_id_created_at_idx" ON "public"."s_user_bookmark_change"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "s_user_bookmark_overview_bookmark_id_user_id_idx" ON "public"."s_user_bookmark_overview"("bookmark_id", "user_id");
