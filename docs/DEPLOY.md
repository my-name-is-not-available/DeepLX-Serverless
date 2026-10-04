# 部署与迁移指南

## 环境要求

- Node.js ≥ 20
- Cloudflare 账号（免费版即可）

## 本地开发

```bash
npm install
npm run dev
```

启动后访问 <http://localhost:8787>。修改代码会热重载。

## 部署到 Cloudflare Workers

```bash
npx wrangler login   # 首次需要登录
npm run deploy
```

`wrangler.jsonc` 中的 `name` 即 Worker 名称，部署后会输出访问地址。

### 通过 Workers Builds 自动部署

1. 在 Cloudflare 控制台进入 **Workers & Pages** → **Create** → **Connect to Git**
2. 选择本仓库，构建命令填 `npm run deploy`（或使用默认值）
3. 后续每次推送自动部署

## 配置变量

在 `wrangler.jsonc` 的 `vars` 中设置：

```jsonc
{
  "vars": {
    "ALTERNATIVE": "true",
    "CORS_ORIGIN": "*"
  }
}
```

本地开发想用不同配置时，创建 `.dev.vars`（不要提交到仓库）：

```dotenv
ALTERNATIVE=false
CORS_ORIGIN=http://localhost:3000
```

| 变量 | 说明 |
| --- | --- |
| `ALTERNATIVE` | `"true"`/`"false"`，是否返回备选翻译 |
| `CORS_ORIGIN` | `"*"` 允许任意来源；`"false"` 关闭 CORS；`"https://a.com,https://b.com"` 白名单 |
| `DL_SESSION` | 可选，DeepL 会话 Cookie |

修改 `vars` 后需要重新 `npm run deploy`；修改 `.dev.vars` 后重启 `npm run dev`。

## 从 3.x（Express 版）迁移

4.0 是完全重写，运行时从 Node.js/Docker/Vercel 迁移到 Cloudflare Workers。对应关系：

| 3.x | 4.0 |
| --- | --- |
| `src/server.js`（Express 应用） | `src/index.ts`（Hono 应用） |
| `src/translate.js` | `src/translate.ts` |
| `api/index.js`（Vercel 入口） | 无需，Worker 直接导出 app |
| `.env` / 启动参数 `-p -a -c` | `wrangler.jsonc` 的 `vars` |
| `Dockerfile` / `vercel.json` | 已移除 |
| axios + zlib | 原生 `fetch`（自动解压 brotli） |

接口路径与请求/响应结构保持兼容，`/translate` 无需改动即可沿用。

## 常见问题

**Q: 本地 `npm run dev` 提示 wrangler 未登录？**
本地开发使用本地运行时，不需要登录；只有 `deploy` 才需要。

**Q: 部署后返回 429？**
说明出口节点被 DeepL 限流，等一会儿重试，或换一个 Worker 区域。

**Q: 想加鉴权？**
在 `src/index.ts` 的 `/translate` 路由前加一个中间件校验 Header 即可，例如：

```ts
app.use('/translate', async (c, next) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.TOKEN}`) {
    return c.json({ code: 401, message: 'Unauthorized' }, 401);
  }
  await next();
});
```
