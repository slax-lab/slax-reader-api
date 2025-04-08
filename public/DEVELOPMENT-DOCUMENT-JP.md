### WIP

### プロジェクト構造

### 実行フロー

### ローカル開発 Q&A

#### テーブルフィールドの変更

> prisma の migrate は非常に暴力的なので、必要がない限りテーブルフィールドを変更しないでください。可能な限り新しいテーブルを追加してください。
> ./prisma/schema.prisma ファイルを変更し、以下のコマンドを実行します。初めて migration を実行する環境の場合、最初に pnpm run dev を実行して d1 データベースを作成し、その後 ln -s ./config/.wrangler ./.wrangler を実行してください。そうしないと prisma がファイルを見つけられません。

```
pnpm run gen:diff
```

#### マイグレーションプログラムの実行

```
pnpm run migration:local
pnpm run migration:local:fulltext
```

#### モデルファイルの生成

> 生成後、vscode が正常に読み取れない場合がありますが、一度再起動すれば解決します。

```
pnpm run gen:model
```

#### ローカル開発

ローカル開発前に、必ず一度マイグレーションプログラムを実行してください！！！

> ローカル開発用のトークン

```
eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjEiLCJsYW5nIjoiZW4iLCJlbWFpbCI6ImRhZ3Vhbmc4MzBAZ21haWwuY29tIiwiZXhwIjoyNzE3NzU1MjU1NTg3LCJpYXQiOjE3MTc3NTUyNTU1ODgsImlzcyI6Imp3dF9pc3N1ZXJfZGV2In0.gvvLURPoCAzLemGmRp2u0ww2uS59YDqhXQ1u8JhFC4g
```

#### 環境変数の追加

- 新しいシークレットを追加 => `pnpm wrangler secret put 変数名` => 対応するシークレット値を入力 => `.dev.vars` に対応する変数名のローカルデータを追加 => `pnpm run cf-typegen`

- 新しい変数を追加 => `wrangler.toml` に対応する変数名と値を追加 => `pnpm run cf-typegen`

#### 新しい環境のフロー

- ステップ1:

```
pnpm install && pnpm run dev
```

- ステップ2:

```
pnpm run migration:local && pnpm run gen:model
```

- ステップ3:

```
ln -s ./config/.wrangler ./.wrangler
```

### プライベートパッケージのインストール

`.npmrc` ファイルを作成し、以下の内容を追加します

```
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
//npm.pkg.github.com/:always-auth=true
```

コマンドを実行

```
pnpm config set '//npm.pkg.github.com/:_authToken' "${NPM_TOKEN}"
```

### 定期ジョブのテスト

```
curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"
```

### ベクトルインデックスの作成

```
pnpm wrangler vectorize create-metadata-index tutorial-index --property-name=url --type=string
```

### websocket のテスト

```
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: $(openssl rand -base64 16)" \
  -H "Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits" \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjI4MjYwIiwibGFuZyI6ImVuIiwiZW1haWwiOiJkYWd1YW5nODMwQGdtYWlsLmNvbSIsImV4cCI6MjczMTgyNjc4NTY1NSwiaWF0IjoxNzMxODI2Nzg1NjU2LCJpc3MiOiJzbGF4LXJlYWRlci1kZXYifQ.mc91yLxowIArjYA64VZIUtf52_T7DWpnTQwZH6DJtNQ' \
  http://localhost:8787/v1/user/messages
```

### push api のテスト

```
curl http://localhost:8787/callback/send_push_api
```

### Push API JWK の変更

```
pnpm install web-push -g
web-push generate-vapid-keys
```

生成された public key と private key を持って、script/generate-keys.js の public key と private key を置き換えます。その後、node script/generate-keys.js を使用して新しい PUSH_API_JWK_KEY を生成します。
