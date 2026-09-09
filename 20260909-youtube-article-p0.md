# YouTube AI 整理稿 P0：两张表和仓储

日期：2026-09-09

为 YouTube AI 整理稿新增表 `sr_youtube_article`、`sr_youtube_article_ref` 和对应仓储。字幕和文章本身是 R2 对象，表里只放指针、版本、状态和门控结果。托管后端负责写入，本仓库只提供表结构和数据访问。

产品上已确定字幕和整理稿按视频共享，owner 和分享访客都能看。`sr_bookmark` 的唯一键是（target_url，private_user），书签本来就是每个用户一份，所以视频的身份用 video_id，不用 bookmark_id。

`sr_youtube_article`，视频级，一行对应一个（video_id，source_hash，prompt_version）。source_hash 由字幕内容、时间、轨道和格式版本算出，字幕一变就是新行，旧文章不会盖到新字幕上。列：video_id、caption_key、caption_text_key、caption_language、caption_kind、source_hash、eligibility_json、status、article_key、article_text_key、model、prompt_version、schema_version、quality_json、retry_count、lease_until、next_retry_at、error_message、created_at、updated_at、started_at、completed_at。索引 (status, next_retry_at)。

`sr_youtube_article_ref`，书签级，bookmark_id 唯一：user_id、video_id、source_hash。记录书签抓取时看到的字幕版本，重抓时指针移到新版本。权限始终由书签决定，这张表和 R2 key 都不当权限用。索引 (video_id, source_hash)、user_id。

状态集合：pending、classifying、skipped、generating、validating、ready、failed、stale。本次只会写 pending 和 skipped。

仓储 `YoutubeArticleRepo`：

- `recordEvaluation()`：按视频级唯一键 upsert 门控结果。行已经进入 generating、ready 等后续状态时不覆盖，原样返回。
- `linkBookmark()`：按 bookmark_id upsert 书签指针。
- `findForBookmark()`：从书签的 ref 找到当前 prompt 版本的视频行。
- `unlinkBookmark()`：删除书签时删 ref。
- `countRefs()`：清理任务判断视频产物还有没有人引用。

迁移文件 `prisma/migrations/20260909000000_add_youtube_article/migration.sql`，与托管后端的 `pg_migrations` 同名同内容。

验证：文件用本仓库 lint 配置检查无问题；类型通过托管后端的 tsc 一并检查。没有连真实数据库执行迁移。
