import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { translate } from './translate.js';
import 'dotenv/config';

// 解析参数
const argv = yargs(hideBin(process.argv))
  .option('port', {
    alias: 'p',
    describe: 'Service port number',
    coerce: check_port,
    default: Number(process.env.PORT) || 6119
  })
  .option('alt', {
    alias: 'a',
    describe: 'Return alternatives translation',
    type: 'boolean',
    default: process.env.ALTERNATIVE === undefined ? true : process.env.ALTERNATIVE !== 'false'
  })
  .option('cors', {
    alias: 'c',
    describe: 'Origin that allow cross-domain access',
    coerce: check_cors,
    default: process.env.CORS_ORIGIN || false
  })
  .help().alias('help', 'h')
  .argv;

// 定义配置
const PORT = argv.port,
  returnAlternative = argv.alt,
  CORS = {
    origin: argv.cors,
    methods: 'GET,POST',
    allowedHeaders: ['Content-Type', 'Authorization'],
    preflightContinue: false
  };

// 创建 express 应用（含中间件与路由），便于本地服务与 Serverless 复用
export function createApp() {
  const app = express();
  app.use(cors(CORS));
  app.use(bodyParser.json());
  app.post('/translate', (req, res) => post(req, res));
  app.get('/', (req, res) => get(req, res));
  return app;
}

// 校验并归一化请求体，非法时返回 null
function normalizeBody(body) {
  if (!body || typeof body !== 'object') return null;

  let { text, source_lang, target_lang, alt_count } = body;

  if (typeof text !== 'string' || text.trim() === '') return null;
  if (typeof target_lang !== 'string' || target_lang.trim() === '') return null;
  // source_lang 允许缺省与 'auto'，其余必须是字符串
  if (source_lang !== undefined && source_lang !== null && typeof source_lang !== 'string') return null;
  if (alt_count !== undefined && (typeof alt_count !== 'number' || !Number.isInteger(alt_count) || alt_count < 0 || alt_count > 3)) return null;

  return {
    text,
    source_lang: (source_lang || 'auto').toUpperCase(),
    target_lang: target_lang.toUpperCase(),
    alt_count
  };
}

async function post(req, res) {
  const startTime = Date.now();
  const body = normalizeBody(req.body);

  if (!body) {
    const duration = Date.now() - startTime;
    console.log(`[WARN] ${new Date().toISOString()} | POST "translate" | 400 | Bad Request | ${duration}ms`);
    return res.status(400).json({
      code: 400,
      message: "Bad Request"
    });
  }

  const { text, source_lang, target_lang, alt_count } = body;

  try {
    const result = await translate(text, source_lang, target_lang, { altLimit: alt_count });
    const duration = Date.now() - startTime;

    if (result.code === 429) {
      console.error(`[WARN] ${new Date().toISOString()} | POST "translate" | 429 | ${result.message} | ${duration}ms`);
      return res.status(429).json({
        code: 429,
        message: result.message
      });
    }

    if (!result || result.data === undefined || result.data === '') {
      console.error(`[ERROR] ${new Date().toISOString()} | POST "translate" | 500 | ${result && result.message} | ${duration}ms`);
      return res.status(500).json({
        code: 500,
        message: "Translation failed",
        error: result && result.statusText
      });
    }

    console.log(`[LOG] ${new Date().toISOString()} | POST "translate" | 200 | ${duration}ms`);
    return res.json({
      code: result.code || 200,
      id: result.id,
      data: result.data,
      method: "Free",
      source_lang: result.source_lang,
      target_lang,
      alternatives: (returnAlternative ? result.alternatives : [])
    });

  } catch (err) {
    console.error(err, err.stack);
    return res.status(500).json({
      code: 500,
      message: err.message
    });
  }
}

function get(req, res) {
  res.status(200).json({
    code: 200,
    message: "Welcome to the DeepL Free API. Please POST to '/translate'. Visit 'https://github.com/guobao2333/DeepLX-Serverless' for more information."
  });
}

function check_cors(arg) {
  if (arg === undefined) return;
  if (typeof arg === 'string' || typeof arg === 'boolean') return arg;

  console.error("ParamTypeError: \x1b[33m'"+arg+"'\x1b[31m, origin should be Boolean or String.\n\x1b[0meg: \x1b[32m'*' or true or RegExp");
  process.exit(1);
}

function check_port(arg) {
  if (typeof arg === 'number' && !isNaN(arg) && Number.isInteger(arg) && arg >= 0 && arg <= 65535) return arg;

  console.warn('WARNING:\x1b[0m port should be >= 0 and < 65536.\nUsed default value instead: 6119\n');
  return 6119;
}

// 仅在直接运行本文件时启动本地服务器，被 import 时不自动监听
const isMain = process.argv[1] && new URL(import.meta.url).pathname === process.argv[1];
if (isMain) {
  createApp().listen(PORT, () => {
    console.log(`Server is running and listening on http://localhost:${PORT}/translate`);
  });
}

export { post, get };
