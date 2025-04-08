<div align="center">
<img src="https://r-beta.slax.com/icon.png" />
<h1> <a href="https://slax.com/slax-reader.html">Slax Reader API </a> </h1>
<h1>Simple tools for a relaxed life</h1>

[![GitHub pull requests](https://img.shields.io/github/issues-pr/slax-lab/slax-reader-api?style=flat)](https://github.com/slax-lab/slax-reader-api/pulls) [![GitHub closed pull requests](https://img.shields.io/github/issues-pr-closed/slax-lab/slax-reader-api?style=flat)](https://github.com/slax-lab/slax-reader-api/pulls?q=is%3Apr+is%3Aclosed) [![GitHub issues](https://img.shields.io/github/issues/slax-lab/slax-reader-api?style=flat)](https://github.com/slax-lab/slax-reader-api/issues) [![GitHub closed issues](https://img.shields.io/github/issues-closed/slax-lab/slax-reader-api?style=flat)](https://github.com/slax-lab/slax-reader-api/issues?q=is%3Aissue+is%3Aclosed) ![Stars](https://img.shields.io/github/stars/slax-lab/slax-reader-api?style=flat) ![Forks](https://img.shields.io/github/forks/slax-lab/slax-reader-api?style=flat)

English | [简体中文](./public/README_CN.md) | [Japanese](./public/README_JP.md)

</div>

<div align="center">
    <a href="https://slax.com/slax-reader.html">Home Page</a> |
    <a href="https://t.me/slax_app">Channel</a> |
    <a href="https://r.slax.com">Live Site</a>
</div>
</br>

This is the Slax Reader API service developed based on Cloudflare Worker, designed to work with the [Slax Reader Web](https://github.com/slax-lab/slax-reader-web) / [Slax Reader APP](https://github.com/slax-lab/slax-reader-client) projects. This document provides deployment and development instructions. If you want to use Slax Reader directly, please visit [Slax Reader](https://r.slax.com) or [Slax Reader Bot](https://t.me/slax_reader_bot).

<div align="center">

</div>
</br>

# ✨ Get Slax Reader

> If you want to use Slax Reader directly, you can:

#### Read on web

- Web: visit [Slax Reader](https://r.slax.com) to create your free account (no downloads needed).

- Browser Extensions (save links in one click):
  - [Chrome Web Store](https://chromewebstore.google.com/detail/slax-reader/gdnhaajlomjkhahnmiijphnodkcfikfd) (also works on Edge)

#### Read on mobile

- [Slax Reader Bot](https://t.me/slaxreaderbot): save articles directly from your phone.

#### Coming soon

- iOS/Android/Desktop apps (under active development).

# 🚀 Self-Deploy

[Cloudflare Deploy](./public/CLOUDFLARE-DEPLOY-EN.md)

[Vercel Deploy](./public/VERCEL-DEPLOY-EN.md)

[Self-Hosting](./public/SELF-HOSTING-EN.md)

# 🎉 Feature List

- [x] Support for bookmarking webpages via URL / browser extension / Telegram
- [x] Support for website parsing using server-side Fetch / Puppeteer / ApiFY
- [x] Support for multilingual error messages and notifications
- [x] Support for highlighting, commenting, replying, sharing, starring, and archiving bookmarked content
- [x] Support for AI conversation, AI summarization, highlight discussions, and AI tag generation for bookmarks
- [x] Support for hybrid search combining full-text search and vector search
- [x] AI features support multiple service providers, degradation handling, and Function Call
- [x] Support for importing bookmarks from Omnivore
- [x] Optimization for content from `WeChat Official Accounts` / `X` / `Medium` / `YouTube` and series with overly simplified Readability
- [x] Support for message pushing via Websocket / Browser Push
- [x] Support for image proxying and asynchronous lazy saving for bookmarks

### TODO List

- [ ] Support for message notifications via Telegram
- [ ] Support for runtime environments like Nodejs / Deno, enabling operation outside of Cloudflare Worker
- [ ] Complete refactoring of external data sources to adapt to more data sources (e.g., MySQL...)
- [ ] Support for one-click deployment to Docker, Cloudflare, Kubernetes, and other platforms
- [ ] Native support for more AI service providers (currently only supports OpenAI-compatible API integration)
- [ ] Complete Typescript-style ESLINT code
- [ ] Support for one-click deployment of cloudflare scripts

# 🤝 How to Contribute

You can contribute code to make our product better by understanding our development, deployment, and basic standards. [Documentation](./public/HOW-TO-CONTRIBUTION-EN.md)

# 💖 Contributors

💖 [Thank you to every contributor who helps make Slax Reader better](https://github.com/slax-lab/slax-reader-api/graphs/contributors) 💖

<img src="https://contrib.rocks/image?repo=slax-lab/slax-reader-api" alt="contributors">

# 🙏 Acknowledgements

During the development of Slax Reader API, we have used many excellent open-source projects and tools. We would like to express our sincere gratitude to the contributors of these projects:

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

# 📝 License

`Slax Reader` is licensed under the [Apache License 2.0](LICENSE). The community version is completely free, open-source, and will remain so forever.
