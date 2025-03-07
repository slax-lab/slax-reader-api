### WIP

### 项目结构

### 运行流程

### Local Development Q&A

#### 修改表字段

> 由于prisma的migrate十分暴力，非必要的情况下，不要去修改表字段，尽可能去新增表吧  
> 修改./prisma/schema.prisma文件，然后执行以下命令如果是第一次执行migration的环境，需要先运行pnpm run dev使其创建d1数据库，然后再执行`ln -s ./config/.wrangler ./.wrangler`，否则prisma会找不到文件

```
pnpm run gen:diff
```

#### 运行迁移程序

```
pnpm run migration:local
pnpm run migration:local:fulltext
```

#### 生成model文件

> 生成完之后有概率vscode无法正常读取到，重启一次就好了

```
pnpm run gen:model
```

#### 本地开发

本地开发前，请务必执行一次迁移程序！！！

> 本地开发用的token

```
eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjEiLCJsYW5nIjoiZW4iLCJlbWFpbCI6ImRhZ3Vhbmc4MzBAZ21haWwuY29tIiwiZXhwIjoyNzE3NzU1MjU1NTg3LCJpYXQiOjE3MTc3NTUyNTU1ODgsImlzcyI6Imp3dF9pc3N1ZXJfZGV2In0.gvvLURPoCAzLemGmRp2u0ww2uS59YDqhXQ1u8JhFC4g
```

#### 增加环境变量

- 新增secret => `pnpm wrangler secret put 变量名` => 输入对应secret值 => 在 `.dev.vars` 中添加对应变量名的本地数据 => `pnpm run cf-typegen`

- 新增vars => `wrangler.toml`中增加对应变量名和值 => `pnpm run cf-typegen`

#### 新环境流程

- step1:

```
pnpm install && pnpm run dev
```

- step2:

```
pnpm run migration:local && pnpm run gen:model
```

- step3:

```
ln -s ./config/.wrangler ./.wrangler
```

### 安装星球私有包

创建`.npmrc`文件，添加以下内容

```
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
//npm.pkg.github.com/:always-auth=true
```

执行命令

```
pnpm config set '//npm.pkg.github.com/:_authToken' "${NPM_TOKEN}"
```

### 测试定时任务

```
curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"
```

### 创建向量索引

```
pnpm wrangler vectorize create-metadata-index tutorial-index --property-name=url --type=string
```

### 测试websocket

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

### 测试push api

```
curl http://localhost:8787/callback/send_push_api
```

### 更换Push API JWK

```
pnpm install web-push -g
web-push generate-vapid-keys
```

然后拿着生成的public key和private Key，去替换script/generate-keys.js中的public key和private Key！然后再去用 node script/generate-keys.js 生成新的 PUSH_API_JWK_KEY
