# Cloudflare Deployment Guide

> **Note**: This project relies on several advanced Cloudflare features, including KV, Durable Objects, Queue, Vectorize, and Browser Render. Before deployment, please ensure you have a dual-currency credit card and are prepared to activate the Cloudflare Worker paid plan at $5 per month, otherwise the project will not function properly.

> **Notice**: The script for automatic Cloudflare configuration is currently under development. You may want to wait a few days before attempting deployment.

## Quick Deployment

Click the button below to start the deployment process:

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button?paid=true)](https://deploy.workers.cloudflare.com/?url=https://github.com/YOURUSERNAME/YOURREPO&paid=true)

## Deployment Process

1. After clicking the deployment button, you will be directed to the Cloudflare website
2. Log in to your Cloudflare account and authorize your GitHub account
3. Cloudflare will automatically deploy the project
4. After deployment, you will still need to configure various environment variables and secrets

## Configuring Environment Variables

After deployment, you need to configure the following environment variables in your GitHub repository:

![f5b4fe779867558eb3fe0db4108d6957.png](https://i.miji.bid/2025/03/05/f5b4fe779867558eb3fe0db4108d6957.png)

### Adding Environment Variables and Secrets

1. After deployment, go to the **Cloudflare Dashboard**
2. Select your deployed Worker
3. Navigate to **Settings** > **Variables**
4. Add all the environment variables and secrets listed above:
   - For regular environment variables, select "**Plain text**" type
   - For secrets, select "**Encrypted**" type

### Activating the Paid Plan

1. Find your project in the Cloudflare Dashboard
2. Go to **Settings** > **Plans**
3. Select the **Paid Plan** ($5 per month)
4. Complete the payment process

## Verifying Deployment

After configuration, visit your Worker URL to confirm the deployment status:

```
https://your-project.your-username.workers.dev
```

If the page responds normally, the deployment was successful.

## Technical Support

If you encounter any issues, please submit an Issue in the GitHub project.

---

Refer to the detailed deployment guide for more configuration steps and troubleshooting methods.

## Configuration Details

### Basic Environment Variables (Vars)

These variables can be displayed in plain text and are mainly used for basic configuration and public information:

| Variable Name      | Purpose                                                            | How to Obtain                                 |
| ------------------ | ------------------------------------------------------------------ | --------------------------------------------- |
| IMAGE_PREFIX       | Image proxy interface                                              | Fill in the domain name configured for R2     |
| PROXY_IMAGE_PREFIX | Image proxy server address for cross-domain and image optimization | 1. https://<backend domain>/static/image path |
| FRONT_END_URL      | Frontend application access address                                | Frontend website domain                       |

### Authentication-Related Configuration

Configuration for various authentication services, this part needs to be filled in Secrets:

| Variable Name             | Purpose                | How to Obtain                                                                                   |
| ------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------- |
| GOOGLE_CLIENT_ID_TEXT     | Google OAuth Client ID | 1. Visit Google Cloud Console<br>2. Create OAuth 2.0 client<br>3. Get Web application client ID |
| GOOGLE_CLIENT_SECRET_TEXT | Google OAuth Secret    | Obtain the corresponding client secret in Google Cloud Console                                  |

### OpenAI-Related Configuration

AI service configuration items, this part needs to be filled in Secrets:

| Variable Name        | Purpose                       | How to Obtain                                                              |
| -------------------- | ----------------------------- | -------------------------------------------------------------------------- |
| OPENAI_GATEWAY       | Cloudflare AI Gateway address | 1. Enable AI Gateway in Cloudflare console<br>2. Get dedicated gateway URL |
| PROXY_OPENAI_GATEWAY | OpenAI API proxy address      | Configure your own API proxy server address                                |
| OPENAI_API_KEY       | OpenAI API key                | 1. Register an OpenAI account<br>2. Create a key in the API settings page  |
| JINA_API_KEY         | Jina AI service key           | Register a Jina Cloud account and create an API key                        |

### Telegram Bot Configuration

| Variable Name            | Purpose          | How to Obtain                                              |
| ------------------------ | ---------------- | ---------------------------------------------------------- |
| SLAX_READER_BOT_NAME     | Bot username     | 1. Create a bot using BotFather<br>2. Set the bot username |
| SLAX_READER_BOT_ID       | Bot numeric ID   | Obtain from BotFather or via API                           |
| SLAX_READER_BOT_API_ROOT | Bot API server   | Configure your Telegram Bot API server address             |
| TELEGRAM_BOT_TOKEN       | Bot access token | Obtain when creating a bot with BotFather                  |

### Search Service Configuration

| Variable Name            | Purpose                 | How to Obtain                                                                   |
| ------------------------ | ----------------------- | ------------------------------------------------------------------------------- |
| GOOGLE_SEARCH_KEY        | Google Search API key   | 1. Enable Custom Search API in Google Cloud Console<br>2. Create an API key     |
| GOOGLE_SEARCH_ENAGINE_ID | Custom search engine ID | 1. Visit Programmable Search Engine<br>2. Create a search engine and get the ID |

### Security-Related Configuration

| Variable Name   | Purpose             | How to Obtain                              |
| --------------- | ------------------- | ------------------------------------------ |
| HASH_IDS_SALT   | ID obfuscation salt | Generate a random string as the salt       |
| JWT_SECRET_TEXT | JWT signing key     | Generate a sufficiently long random string |

### Other Service Configuration

| Variable Name   | Purpose                    | How to Obtain                                                              |
| --------------- | -------------------------- | -------------------------------------------------------------------------- |
| APIFY_API_TOKEN | Web scraping service token | 1. Register an Apify account<br>2. Create an API token in account settings |

## Configuration Priority and Considerations

1. Core service configuration (required):

   - Cloudflare Workers environment variables
   - OpenAI API configuration
   - Database and storage configuration
   - Basic authentication keys (JWT, Hash)

2. Functional service configuration (as needed):

   - Social login (Google, Apple)
   - Telegram bot
   - Search service
   - Web scraping
   - Push notifications

### Security Recommendations

1. All secret configurations must use Cloudflare's encrypted environment variables feature
2. Rotate important keys regularly
3. Configure third-party services using the principle of least privilege
4. Safeguard all keys and certificate files

### Cost Considerations

1. Cloudflare Workers: Basic $5/month
2. OpenAI API: Billed by usage, setting limits is recommended
3. Most other services offer free plans or trial quotas

## Required Cloudflare Services

This project requires multiple advanced Cloudflare services. All service configurations must be completed correctly to ensure the application runs properly. Here is a detailed tutorial for service activation and configuration:

### D1 Database

Two database instances need to be created:

**Configuration Steps**:

1. Navigate to **Workers & Pages** > **D1** in the Cloudflare Dashboard
2. Click the **Create Database** button
3. Create two databases in sequence:
   - `slax-reader-backend` (main database)
   - `slax-reader-backend-fulltext` (full-text search database)
4. After creation, record each database's ID and fill it in config/prod.toml
5. For the development environment, create corresponding preview databases

### R2 Storage Buckets

**Configuration Steps**:

1. Navigate to **R2** in the Cloudflare Dashboard
2. Click the **Create Bucket** button
3. Create two buckets:
   - `slax-reader-backend` (production environment)
   - `slax-reader-backend-preview` (preview environment)
4. For each bucket, configure the following settings:
   - Public access: Set as needed
   - CORS rules: Allow access from the frontend domain
   - Lifecycle rules: Set as needed

### Vectorize Vector Database

**Configuration Steps**:

1. Navigate to **Vectorize** in the Cloudflare Dashboard
2. Click the **Create Index** button
3. Create 5 vector indices in sequence:
   - Index names: from `bookmark-1` to `bookmark-5`
   - Configuration for each index:
     - Dimensions: 1024 (compatible with OpenAI vectors)
     - Distance metric: cosine similarity
     - Metadata filtering: enabled

### Durable Objects

**Configuration Steps**:

1. Durable Objects will be created automatically when deploying the Worker
2. Ensure all Durable Objects classes are correctly defined in the `wrangler.toml` file
3. After Worker deployment, you can view and manage these objects in the **Durable Objects** section of the Cloudflare Dashboard

### Queue Service (Queues)

The following consumer queues need to be configured:

**Configuration Steps**:

1. Navigate to **Workers & Pages** > **Queues** in the Cloudflare Dashboard
2. Click the **Create Queue** button
3. Create the following queues in sequence:
   - `slax-reader-parser-twitter`: Processes Twitter content parsing
   - `slax-reader-parser-fetch-retry-prod`: Processes web scraping retries
   - `slax-reader-parser-stripe`: Processes payment-related operations
   - `slax-reader-migrate-from-other`: Processes data imports from other services
