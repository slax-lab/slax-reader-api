# Cloudflare 部署指南

> **提示**: 本项目依赖 Cloudflare 的多项高级功能，包括 KV、Durable Objects、Queue、Vectorize 和 Browser Render。部署前，请确认你拥有双币种信用卡，并准备开通每月 $5 的 Cloudflare Worker 付费计划，否则项目将无法正常运行。

> **注意**: 自动配置Cloudflare的脚本正在开发中，可稍等几天再进行部署体验

## 快速部署

点击下方按钮启动部署流程：

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button?paid=true)](https://deploy.workers.cloudflare.com/?url=https://github.com/YOURUSERNAME/YOURREPO&paid=true)

## 部署流程

1. 点击部署按钮后，你将被引导至 Cloudflare 网页
2. 登录 Cloudflare A账户并授权 GitHub 账号
3. Cloudflare 自动部署
4. 部署完成后，你仍需要配置一定量的环境变量和密钥

## 配置环境变量

部署完成后，你需要在 GitHub 仓库中配置以下环境变量：

![f5b4fe779867558eb3fe0db4108d6957.png](https://i.miji.bid/2025/03/05/f5b4fe779867558eb3fe0db4108d6957.png)

### 添加环境变量和密钥

1. 完成部署后，进入 **Cloudflare Dashboard**
2. 选择你部署的 Worker
3. 导航至 **设置** > **变量**
4. 分别添加上述所有环境变量和密钥:
   - 普通环境变量选择"**明文**"类型
   - 密钥选择"**加密**"类型

### 开通付费计划

1. 在 Cloudflare Dashboard 中找到你的项目
2. 进入 **设置** > **计划**
3. 选择 **付费计划** (每月 $5)
4. 完成付款流程

## 验证部署

配置完成后，访问你的 Worker URL 以确认部署状态:

```
https://your-project.your-username.workers.dev
```

若页面正常响应，则表示部署成功。

## 技术支持

如遇问题，请在 GitHub 项目中提交 Issue。

---

查看附带的详细部署指南了解更多配置步骤和故障排除方法。

## 配置详解

### 基础环境变量 (Vars)

这些变量可以明文显示，主要用于基础配置和公开信息：

| 变量名             | 作用                                       | 获取方式                                |
| ------------------ | ------------------------------------------ | --------------------------------------- |
| IMAGE_PREFIX       | 图片代理接口                               | 填写R2配置的域名即可                    |
| PROXY_IMAGE_PREFIX | 图片代理服务器地址，用于处理跨域和图片优化 | 1. https://<后端域名>/static/image`路径 |
| FRONT_END_URL      | 前端应用访问地址                           | 前端网站域名                            |

### 认证相关配置

用于各种身份认证服务的配置，该部分需要填写到Secret当中：

| 变量名                    | 作用                 | 获取方式                                                                        |
| ------------------------- | -------------------- | ------------------------------------------------------------------------------- |
| GOOGLE_CLIENT_ID_TEXT     | Google OAuth客户端ID | 1. 访问Google Cloud Console<br>2. 创建OAuth 2.0客户端<br>3. 获取Web应用客户端ID |
| GOOGLE_CLIENT_SECRET_TEXT | Google OAuth密钥     | Google Cloud Console中获取对应的客户端密钥                                      |

### OpenAI相关配置

AI服务相关的配置项，该部分需要填写到Secret当中：

| 变量名               | 作用                      | 获取方式                                                  |
| -------------------- | ------------------------- | --------------------------------------------------------- |
| OPENAI_GATEWAY       | Cloudflare AI Gateway地址 | 1. 在Cloudflare控制台开启AI Gateway<br>2. 获取专属网关URL |
| PROXY_OPENAI_GATEWAY | OpenAI API代理地址        | 配置你自己的API代理服务器地址                             |
| OPENAI_API_KEY       | OpenAI API密钥            | 1. 注册OpenAI账号<br>2. 访问API设置页面创建密钥           |
| JINA_API_KEY         | Jina AI服务密钥           | 注册Jina Cloud账号并创建API密钥                           |

### Telegram机器人配置

| 变量名                   | 作用            | 获取方式                                          |
| ------------------------ | --------------- | ------------------------------------------------- |
| SLAX_READER_BOT_NAME     | 机器人用户名    | 1. 使用BotFather创建机器人<br>2. 设置机器人用户名 |
| SLAX_READER_BOT_ID       | 机器人数字ID    | 从BotFather获取或API获取                          |
| SLAX_READER_BOT_API_ROOT | 机器人API服务器 | 配置你的Telegram Bot API服务器地址                |
| TELEGRAM_BOT_TOKEN       | 机器人访问令牌  | BotFather创建机器人时获取                         |

### 搜索服务配置

| 变量名                   | 作用              | 获取方式                                                       |
| ------------------------ | ----------------- | -------------------------------------------------------------- |
| GOOGLE_SEARCH_KEY        | Google搜索API密钥 | 1. Google Cloud Console启用Custom Search API<br>2. 创建API密钥 |
| GOOGLE_SEARCH_ENAGINE_ID | 自定义搜索引擎ID  | 1. 访问Programmable Search Engine<br>2. 创建搜索引擎并获取ID   |

### 安全相关配置

| 变量名          | 作用        | 获取方式               |
| --------------- | ----------- | ---------------------- |
| HASH_IDS_SALT   | ID混淆盐值  | 生成随机字符串作为盐值 |
| JWT_SECRET_TEXT | JWT签名密钥 | 生成足够长的随机字符串 |

### 其他服务配置

| 变量名          | 作用             | 获取方式                                       |
| --------------- | ---------------- | ---------------------------------------------- |
| APIFY_API_TOKEN | 网页抓取服务令牌 | 1. 注册Apify账号<br>2. 在账户设置中创建API令牌 |

## 配置优先级和注意事项

1. 核心服务配置（必需）：

   - Cloudflare Workers环境变量
   - OpenAI API配置
   - 数据库和存储配置
   - 基础认证密钥（JWT、Hash）

2. 功能性服务配置（按需）：

   - 社交登录（Google、Apple）
   - Telegram机器人
   - 搜索服务
   - 网页抓取
   - 推送通知

### 安全建议

1. 所有密钥类配置必须使用Cloudflare的加密环境变量功能
2. 定期轮换重要密钥
3. 使用最小权限原则配置第三方服务
4. 妥善保管所有密钥和证书文件

### 成本注意事项

1. Cloudflare Workers：基础$5/月
2. OpenAI API：按使用量计费，建议设置限额
3. 其他服务大多提供免费套餐或试用额度

## 必需开通的 Cloudflare 服务

本项目需要开通多个 Cloudflare 高级服务，所有服务配置必须正确完成才能确保应用正常运行。以下是详细的服务开通和配置教程：

### D1 数据库

需要创建两个数据库实例：

**配置步骤**：

1. 在 Cloudflare Dashboard 中导航至 **Workers & Pages** > **D1**
2. 点击 **创建数据库** 按钮
3. 依次创建两个数据库：
   - `slax-reader-backend`（主数据库）
   - `slax-reader-backend-fulltext`（全文搜索数据库）
4. 创建后，记录每个数据库的 ID并填写到config/prod.toml中
5. 对于开发环境，创建相应的预览数据库

### R2 存储桶

**配置步骤**：

1. 在 Cloudflare Dashboard 中导航至 **R2**
2. 点击 **创建存储桶** 按钮
3. 创建两个存储桶：
   - `slax-reader-backend`（生产环境）
   - `slax-reader-backend-preview`（预览环境）
4. 对于每个存储桶，配置以下设置：
   - 公共访问：根据需要设置
   - CORS 规则：允许前端域名访问
   - 生命周期规则：根据需要设置

### Vectorize 向量数据库

**配置步骤**：

1. 在 Cloudflare Dashboard 中导航至 **Vectorize**
2. 点击 **创建索引** 按钮
3. 依次创建 5 个向量索引：
   - 索引名称：从 `bookmark-1` 到 `bookmark-5`
   - 每个索引的配置：
     - 维度：1024（与 OpenAI 向量兼容）
     - 距离度量：余弦相似度（cosine）
     - 元数据过滤：启用

### Durable Objects

**配置步骤**：

1. Durable Objects 会在部署 Worker 时自动创建
2. 确保 `wrangler.toml` 文件中已正确定义所有 Durable Objects 类
3. 在 Worker 部署后，可以在 Cloudflare Dashboard 中的 **Durable Objects** 部分查看和管理这些对象

### 队列服务 (Queues)

需要配置以下消费者队列：

**配置步骤**：

1. 在 Cloudflare Dashboard 中导航至 **Workers & Pages** > **Queues**
2. 点击 **创建队列** 按钮
3. 依次创建以下队列：
   - `slax-reader-parser-twitter`：处理 Twitter 内容解析
   - `slax-reader-parser-fetch-retry-prod`：处理网页抓取重试
   - `slax-reader-parser-stripe`：处理支付相关操作
   - `slax-reader-migrate-from-other`：处理从其他服务导入数据
