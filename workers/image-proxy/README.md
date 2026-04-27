# 图片代理 Worker（免费 Cloudflare 方案）

## 这是什么

这是一个 **Cloudflare Worker**，用于把“第三方外链图片”代理到你们自己的域名下，并利用 Cloudflare 的 **边缘缓存** 做加速。

- ✅ 免费计划可用：**代理 + 缓存**
- ❌ 免费计划一般不含：动态缩放/压缩/转 WebP（需要 Image Resizing / Polish 等付费能力）

## 访问方式

将前端图片 URL 改成下面的形式：

- 同域（最省事）：`/i?url=<encode(thirdPartyUrl)>`
- 独立子域名（更清晰）：`https://img.yesono.trade/i?url=<encode(thirdPartyUrl)>`

## Cloudflare Dashboard 配置（推荐绑定同域 `/i*`）

### 1）创建 Worker

在 Cloudflare 控制台：

- **Workers & Pages** → **Workers** → **Create**（创建 Worker）
- 代码可以直接用本目录的 `src/index.ts`（Dashboard 会自动转译/或你也可以用 Wrangler 部署）

### 2）配置白名单（必须）

在 Worker 的 **Settings** → **Variables** 添加：

- **`ALLOWED_IMAGE_HOSTS`**（必填）：逗号分隔的域名白名单  
  示例：
  - `polymarket-upload.s3.us-east-2.amazonaws.com,cryptologos.cc,img.logo.dev,images.unsplash.com,picsum.photos,via.placeholder.com,cdn.jsdelivr.net,robohash.org,c.qf318.com`

- **`IMAGE_PROXY_DEBUG_TOKEN`**（可选）：仅在需要排查线上问题时配置
  配置后才能通过 `?debug=<token>` 查看详细错误；未配置时，匿名 `debug=1` 不会生效

> 为什么必须做白名单：否则任何人都能把你们 Worker 当免费代理刷流量，免费额度很快就会被刷光。

### 3）绑定路由（Triggers / Routes）

在 Worker 的 **Triggers** → **Routes**：

- 推荐（不需要额外 DNS）：添加 `yesono.trade/i*`

这样线上就能直接访问：

- `https://yesono.trade/i?url=...`

## Wrangler 部署（可选）

如果你习惯用命令行：

```bash
cd workers/image-proxy
wrangler login
wrangler deploy
```

然后去 Dashboard 给 Worker 绑定 Route（例如 `yesono.trade/i*`）即可。

## 前端如何接入

仓库已经提供了工具函数：

- `lib/utils/imageProxy.ts`

你只要在 `<img src=...>` 或头像/卡片等地方使用：

- `getProxiedImageUrl(thirdPartyUrl)`

它会在 **生产环境** 且 **域名在白名单** 时自动改写为 `/i?url=...`。

前端建议同时配置：

- `NEXT_PUBLIC_IMAGE_PROXY_ALLOWED_HOSTS`

并保持它与 Worker 的 `ALLOWED_IMAGE_HOSTS` 一致，这样前端只会代理已放行的图片域名，避免先请求 Worker 再回退原图。

