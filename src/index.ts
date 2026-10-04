import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { translate } from './translate';

export interface Bindings {
  /** 是否返回备选翻译，'false' 表示关闭，默认开启 */
  ALTERNATIVE?: string;
  /** 允许跨域的来源，'*' 表示允许任何来源，默认关闭 */
  CORS_ORIGIN?: string;
  /** 可选的 DeepL 会话 Cookie */
  DL_SESSION?: string;
}

interface TranslateBody {
  text?: unknown;
  source_lang?: unknown;
  target_lang?: unknown;
  alt_count?: unknown;
  tag_handling?: unknown;
}

const app = new Hono<{ Bindings: Bindings }>();

const corsMiddleware = cors({
  origin: (origin, c) => {
    const configured = c.env.CORS_ORIGIN;
    if (!configured || configured === 'false') return undefined;
    if (configured === '*') return '*';
    // 支持逗号分隔的来源白名单
    const allowed = configured.split(',').map((s: string) => s.trim());
    return allowed.includes(origin) ? origin : undefined;
  },
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization']
});

app.use('*', corsMiddleware);

/** 校验并归一化请求体，非法时返回 null */
function normalizeBody(body: TranslateBody | null | undefined) {
  if (!body || typeof body !== 'object') return null;

  const { text, source_lang, target_lang, alt_count } = body;

  if (typeof text !== 'string' || text.trim() === '') return null;
  if (typeof target_lang !== 'string' || target_lang.trim() === '') return null;
  // source_lang 允许缺省与 'auto'，其余必须是字符串
  if (source_lang !== undefined && source_lang !== null && typeof source_lang !== 'string') {
    return null;
  }
  if (
    alt_count !== undefined &&
    (typeof alt_count !== 'number' || !Number.isInteger(alt_count) || alt_count < 0 || alt_count > 3)
  ) {
    return null;
  }

  return {
    text,
    source_lang: (source_lang || 'auto').toUpperCase(),
    target_lang: target_lang.toUpperCase(),
    alt_count
  };
}

app.get('/', (c) =>
  c.json({
    code: 200,
    message:
      "Welcome to the DeepL Free API. Please POST to '/translate'. Visit 'https://github.com/guobao2333/DeepLX-Serverless' for more information."
  })
);

app.post('/translate', async (c) => {
  const startTime = Date.now();
  let body: TranslateBody | null = null;
  try {
    body = await c.req.json<TranslateBody>();
  } catch {
    body = null;
  }

  const normalized = normalizeBody(body);
  if (!normalized) {
    console.log(
      `[WARN] ${new Date().toISOString()} | POST "translate" | 400 | Bad Request | ${Date.now() - startTime}ms`
    );
    return c.json({ code: 400, message: 'Bad Request' }, 400);
  }

  const { text, source_lang, target_lang, alt_count } = normalized;
  const returnAlternative = c.env.ALTERNATIVE !== 'false';

  try {
    const result = await translate(text, source_lang, target_lang, {
      altLimit: alt_count,
      dlSession: c.env.DL_SESSION
    });
    const duration = Date.now() - startTime;

    if ('message' in result && result.code === 429) {
      console.error(
        `[WARN] ${new Date().toISOString()} | POST "translate" | 429 | ${result.message} | ${duration}ms`
      );
      return c.json({ code: 429, message: result.message }, 429);
    }

    const success = result as Extract<typeof result, { data: string }>;
    if (!success.data) {
      console.error(
        `[ERROR] ${new Date().toISOString()} | POST "translate" | 500 | Translation failed | ${duration}ms`
      );
      return c.json({ code: 500, message: 'Translation failed' }, 500);
    }

    console.log(`[LOG] ${new Date().toISOString()} | POST "translate" | 200 | ${duration}ms`);
    return c.json({
      code: success.code || 200,
      id: success.id,
      data: success.data,
      method: 'Free',
      source_lang: success.source_lang,
      target_lang,
      alternatives: returnAlternative ? success.alternatives : []
    });
  } catch (err) {
    console.error(err);
    return c.json({ code: 500, message: (err as Error).message }, 500);
  }
});

export default app;
