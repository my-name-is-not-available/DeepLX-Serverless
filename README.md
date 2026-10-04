# DeepLX Serverless

<p align="center">
<a href="https://github.com/guobao2333/DeepLX-Serverless"><img alt="Repository" src="https://img.shields.io/badge/Github-%230A0A0A.svg?&style=flat-square&logo=Github&logoColor=white"/></a>
</p>

DeepLX Serverless 是一个基于 DeepL 翻译网页版、无需令牌的 Serverless 版本，与原项目 [DeepLX](https://github.com/OwO-Network/DeepLX) 的区别在于**利用了无服务器函数（边缘函数）请求 IP 不固定的特性**，有效避免了 `Error 429`（不过嘛凡事总有例外¯\\\_(ツ)\_/¯）

**4.0 版本开始使用 [Hono](https://hono.dev) + Cloudflare Workers 重写**，彻底移除了 Express / axios / zlib 等 Node 依赖，直接运行在 Web 标准 API 之上。  
历史版本：3.x 及之前基于 OwO-Network/DeepLX，2.x 基于 LegendLeo/deeplx-serverless。

## Prerequisites | 准备工作

- 一个 [Cloudflare](https://dash.cloudflare.com/sign-up) 账号（免费版即可）
- 本地需要 `Node.js ≥ 20`

## Deploy | 部署

### 方式一：本地开发并部署

```bash
npm install
npm run dev       # 本地预览，默认 http://localhost:8787
npm run deploy    # 部署到 Cloudflare Workers
```

首次 `deploy` 会引导你登录 Cloudflare 账号并自动创建 Worker。

### 方式二：Cloudflare Dashboard

在 Cloudflare 控制台创建 Worker，把 `src` 下的代码粘贴进去即可（或将仓库连接到 Workers Builds 自动构建）。

> [!TIP]
> 部署完成后你会拿到形如 `https://deeplx-serverless.<你的子域>.workers.dev` 的地址。

### Configuration | 配置

配置写在 `wrangler.jsonc` 的 `vars` 中，本地开发也可以使用 `.dev.vars` 文件（已被 `.gitignore` 忽略）。

| 变量 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `ALTERNATIVE` | String | `"true"` | 是否返回备选翻译。文本量大时设为 `"false"` 可节省流量 |
| `CORS_ORIGIN` | String | `"*"` | 允许跨域的来源。`"*"` 允许任意来源，`"false"` 关闭，也可用逗号分隔白名单 |
| `DL_SESSION` | String | 无 | 可选的 DeepL 会话 Cookie，用于复用已登录会话 |

修改后重新 `npm run deploy` 生效。

## How To Use | 如何使用

详细调用参数请查看 [docs/API.md](./docs/API.md)，迁移与部署说明见 [docs/DEPLOY.md](./docs/DEPLOY.md)。

### Http Call | 网络请求

```bash
curl -X POST 'https://your-worker.workers.dev/translate' \
  -H 'Content-Type: application/json' \
  -d '{"text": "你好，世界！", "source_lang": "zh", "target_lang": "en"}'
```

### Test | 测试

```bash
# 本地先 npm run dev，再另开终端
BASE_URL=http://localhost:8787 npm test
```

## Star History | 收藏趋势

<a href="https://star-history.com/#guobao2333/DeepLX-Serverless&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=guobao2333/DeepLX-Serverless&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=guobao2333/DeepLX-Serverless&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=guobao2333/DeepLX-Serverless&type=Date" />
 </picture>
</a>

## Contribute | 贡献
1. 获取 `dev` 或 `main` 分支的代码
2. 提交你的更改并描述提交内容
3. 创建一个 `Pull Requests`

如果你是第一次贡献，那么请查看[《如何为开源做贡献》](https://opensource.guide/how-to-contribute/)

## Thanks | 感谢

它们是本项目的根本，没有它们就没有本项目。

1. [OwO-Network/DeepLX](https://github.com/OwO-Network/DeepLX)
2. [LegendLeo/deeplx-serverless](https://github.com/LegendLeo/deeplx-serverless)
3. [bropines/Deeplx-vercel](https://github.com/bropines/Deeplx-vercel)
4. [honojs/hono](https://github.com/honojs/hono)

## Disclaimer | 免责声明
请勿依赖本项目，因基于 DeepL 网页版数据，可能随时罢工。如果您有大量内容需要翻译，请购买 DeepL 官方翻译 API，DeepLXS 始终受到 DeepL 政策限制。
