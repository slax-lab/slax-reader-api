<div align="center">
<img src="https://r-beta.slax.com/icon.png" />
<h1> <a href="https://slax.com/slax-reader.html">Slax Reader API </a> </h1>
<h1>シンプルなツールでリラックスした生活を</h1>

[![GitHub pull requests](https://img.shields.io/github/issues-pr/slax-lab/slax-reader-api?style=flat)](https://github.com/slax-lab/slax-reader-api/pulls) [![GitHub closed pull requests](https://img.shields.io/github/issues-pr-closed/slax-lab/slax-reader-api?style=flat)](https://github.com/slax-lab/slax-reader-api/pulls?q=is%3Apr+is%3Aclosed) [![GitHub issues](https://img.shields.io/github/issues/slax-lab/slax-reader-api?style=flat)](https://github.com/slax-lab/slax-reader-api/issues) [![GitHub closed issues](https://img.shields.io/github/issues-closed/slax-lab/slax-reader-api?style=flat)](https://github.com/slax-lab/slax-reader-api/issues?q=is%3Aissue+is%3Aclosed) ![Stars](https://img.shields.io/github/stars/slax-lab/slax-reader-api?style=flat) ![Forks](https://img.shields.io/github/forks/slax-lab/slax-reader-api?style=flat)

日本語 | [English](../README.md)

</div>

<div align="center">
    <a href="https://slax.com/slax-reader.html">ホームページ</a> |
    <a href="https://t.me/slax_app">チャンネル</a> |
    <a href="https://r.slax.com">ライブサイト</a>
</div>
</br>

これは、Cloudflare Worker をベースに開発された Slax Reader API サービスであり、[Slax Reader Web](https://github.com/slax-lab/slax-reader-web) / [Slax Reader APP](https://github.com/slax-lab/slax-reader-client) プロジェクトと連携して使用することを目的としています。この記事では、デプロイおよび開発の手順を提供します。Slax Reader を直接使用したい場合は、[Slax Reader](https://r.slax.com) または [Slax Reader Bot](https://t.me/slax_reader_bot) をご覧ください。

<div align="center">

</div>
</br>

# ✨ Slax Reader を入手

- [Chrome ウェブストア](https://chromewebstore.google.com/detail/slax-reader/gdnhaajlomjkhahnmiijphnodkcfikfd)
- [Slax Reader](https://r.slax.com)
- [Slax Reader Bot](https://t.me/slax_reader_bot)
- ~~Slax Reader APP~~ (開発中)
- ~~Slax Reader デスクトップ~~ (開発中)

# 🚀 自己デプロイ

[Cloudflare デプロイ](./CLOUDFLARE-DEPLOY-JP.md)

[Vercel デプロイ](./VERCEL-DEPLOY-JP.md)

[セルフホスティング](./SELF-HOSTING-JP.md)

# 🎉 機能リスト

- [x] URL / プラグイン / Telegram を通じてウェブページをブックマーク
- [x] サーバーサイドの Fetch / Puppeteer / ApiFY を使用してウェブサイトを解析
- [x] 多言語のエラーメッセージと通知をサポート
- [x] ブックマークしたコンテンツのハイライト、コメント、返信、共有、スター付け、アーカイブをサポート
- [x] ブックマークに対するAI対話、AI要約、ハイライト対話、AIタグ生成をサポート
- [x] 全文検索とベクトル検索のハイブリッド検索をサポート
- [x] AI機能は複数のサービスプロバイダー、デグレード処理、Function Call をサポート
- [x] Omnivore からのブックマークのインポートをサポート
- [x] `WeChat Official Accounts` / `X` / `Medium` / `YouTube` などのコンテンツの最適化
- [x] Websocket / Browser Push を通じたメッセージプッシュをサポート
- [x] ブックマークの画像プロキシと非同期遅延保存をサポート

### TODO リスト

- [ ] Telegram を通じたメッセージ通知をサポート
- [ ] Nodejs / Deno などの実行環境をサポートし、Cloudflare Worker 以外でも動作可能にする
- [ ] 外部データソースの完全なリファクタリングを行い、より多くのデータソースに対応（例：MySQL...）
- [ ] Docker、Cloudflare、Kubernetes などのプラットフォームへのワンクリックデプロイをサポート
- [ ] より多くのAIサービスプロバイダーをネイティブサポート（現在はopenai互換のAPIのみサポート）
- [ ] Typescript-style ESLINT コードの完全なリファクタリング
- [ ] Cloudflare スクリプトのワンクリックデプロイをサポート

# 🤝 貢献方法

開発、デプロイ、基本的な標準を理解することで、コードの貢献を行い、製品をより良くすることができます。[ドキュメント](./HOW-TO-CONTRIBUTION-JP.md)

# 💖 貢献者

💖 [Slax Reader をより良くするために貢献してくれたすべての貢献者に感謝します](https://github.com/slax-lab/slax-reader-api/graphs/contributors) 💖

<img src="https://contrib.rocks/image?repo=slax-lab/slax-reader-api" alt="contributors">

# 🙏 謝辞

Slax Reader API の開発中に、多くの優れたオープンソースプロジェクトやツールを使用しました。これらのプロジェクトの貢献者に心から感謝します：

- 🚀 [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- 🗄️ [Prisma](https://www.prisma.io/)
- 🔄 [itty-router](https://github.com/kwhitley/itty-router)
- 📖 [readability](https://github.com/mozilla/readability)
- 🤖 [grammy](https://gram.dev/)
- 📝 [TypeScript](https://www.typescriptlang.org/)
- 🔍 [ESLint](https://eslint.org/)
- ✨ [Prettier](https://prettier.io/)
- ✂️ [jieba-rs](https://github.com/messense/jieba-rs)
- ✂️ [jieba-wasm](https://github.com/fengkx/jieba-wasm)
- 💬 [cf-webpush](https://github.com/aynh/cf-webpush)

# 📝 ライセンス

`Slax Reader` は [Apache License 2.0](../LICENSE) の下でライセンスされています。コミュニティバージョンは完全に無料でオープンソースであり、永遠にそうであり続けます。
