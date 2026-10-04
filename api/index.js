import { createApp } from '../src/server.js';

// 复用 server.js 的应用（含 CORS / body-parser / 路由）
const app = createApp();

// Serverless 环境由平台负责监听，这里不调用 app.listen
export default app;
