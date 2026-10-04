/**
 * DeepL 网页版翻译实现，从原 Node 版本移植到 Web 标准 API。
 * 关键差异：
 * - axios -> 原生 fetch（Workers 环境自带 brotli/gzip 解压）
 * - zlib.brotliDecompress -> 无需手动处理
 */

const BASE_URL = 'https://www2.deepl.com';

export interface TranslateOptions {
  /** 备选翻译条数上限 */
  altLimit?: number;
  /** DeepL 会话 Cookie 值 */
  dlSession?: string;
  /** 设为 html 或 xml 时按富文本处理 */
  tagHandling?: string;
  /** 打印原始响应，便于调试 */
  printResult?: boolean;
}

export interface TranslateResult {
  code: number;
  id?: number;
  method: 'Free';
  data: string;
  source_lang: string;
  target_lang: string;
  alternatives: string[];
}

export interface TranslateError {
  code: 429;
  message: string;
}

type JsonRpcResponse = {
  result?: {
    lang?: { detected: string };
    texts?: Array<{ chunks: Array<{ sentences: Array<{ prefix: string; text: string }> }> }>;
    translations?: Array<{ beams: Array<{ sentences: Array<{ text: string }> }> }>;
  };
};

/**
 * 生成请求体字符串。
 * DeepL 会对 `"method":"` 的格式做校验，构造两种写法并随机选用，规避风控。
 */
function formatPostString(postData: Record<string, unknown> & { id: number }): string {
  const body = JSON.stringify(postData);
  const separator =
    (postData.id + 5) % 29 === 0 || (postData.id + 3) % 13 === 0 ? '"method" : "' : '"method": "';

  return body.replace('"method":"', separator);
}

function buildHeaders(dlSession?: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'User-Agent': 'DeepLBrowserExtension/1.28.0 Mozilla/5.0',
    Accept: '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    Origin: 'https://www.deepl.com',
    Referer: 'https://www.deepl.com/',
    Pragma: 'no-cache',
    'Cache-Control': 'no-cache',
    ...(dlSession ? { Cookie: `dl_session=${dlSession}` } : {})
  };
}

async function sendRequest(
  postData: Record<string, unknown> & { id: number },
  dlSession?: string
): Promise<JsonRpcResponse | TranslateError> {
  const response = await fetch(`${BASE_URL}/jsonrpc?`, {
    method: 'POST',
    headers: buildHeaders(dlSession),
    body: formatPostString(postData)
  });

  if (response.status === 429) {
    return { code: 429, message: 'Too Many Requests' };
  }

  if (!response.ok) {
    throw new Error(`DeepL responded with ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as JsonRpcResponse;
}

function isError(res: unknown): res is TranslateError {
  return !!res && typeof res === 'object' && 'code' in res && (res as TranslateError).code === 429;
}

async function splitText(
  text: string,
  isRichText: boolean,
  dlSession?: string
): Promise<JsonRpcResponse | TranslateError> {
  const postData = {
    jsonrpc: '2.0',
    method: 'LMT_split_text',
    id: Math.floor(Math.random() * 1_000_000),
    params: {
      commonJobParams: { mode: 'translate' },
      lang: { lang_user_selected: 'auto' },
      texts: [text],
      textType: isRichText ? 'richtext' : 'plaintext'
    }
  };

  try {
    return await sendRequest(postData, dlSession);
  } catch (err) {
    throw new Error(`splitText failed: ${(err as Error).message}`);
  }
}

/**
 * 翻译文本。
 * @param text 待翻译文本
 * @param sourceLang 源语言，'auto' 或空字符串表示自动检测
 * @param targetLang 目标语言
 */
export async function translate(
  text: string,
  sourceLang: string,
  targetLang: string,
  options: TranslateOptions = {}
): Promise<TranslateResult | TranslateError> {
  const { altLimit, dlSession, tagHandling, printResult } = options;

  if (!text) throw new Error('No text to translate');

  const isRichText = tagHandling === 'html' || tagHandling === 'xml';
  const splitResult = await splitText(text, isRichText, dlSession);
  if (isError(splitResult)) return splitResult;

  const chunks = splitResult.result?.texts?.[0]?.chunks;
  if (!chunks) throw new Error('Translation failed: unexpected split response');

  // 自动检测源语言
  if (sourceLang === 'auto' || sourceLang === '') {
    sourceLang = splitResult.result?.lang?.detected?.toLowerCase() ?? 'auto';
  }

  const jobs = chunks.map((chunk, index) => {
    const sentence = chunk.sentences[0];
    return {
      kind: 'default',
      preferred_num_beams: 4,
      raw_en_context_before: index > 0 ? [chunks[index - 1].sentences[0].text] : [],
      raw_en_context_after:
        index < chunks.length - 1 ? [chunks[index + 1].sentences[0].text] : [],
      sentences: [{ prefix: sentence.prefix, text: sentence.text, id: index + 1 }]
    };
  });

  const hasRegionalVariant = targetLang.includes('-');
  const targetLangCode = hasRegionalVariant ? targetLang.split('-')[0] : targetLang;

  const postData = {
    jsonrpc: '2.0',
    method: 'LMT_handle_jobs',
    id: Math.floor(Math.random() * 1_000_000),
    params: {
      commonJobParams: {
        mode: 'translate',
        ...(hasRegionalVariant && { regional_variant: targetLang })
      },
      lang: {
        source_lang_computed: sourceLang.toUpperCase(),
        target_lang: targetLangCode.toUpperCase()
      },
      jobs,
      priority: 1,
      timestamp: Date.now()
    }
  };

  const response = await sendRequest(postData, dlSession);
  if (isError(response)) return response;

  const translations = response.result?.translations;
  if (!translations || translations.length === 0) {
    throw new Error('Translation failed: empty response');
  }

  const beams = translations[0].beams ?? [];
  const alternatives = beams.map((beam) => beam.sentences[0].text);
  const translatedText = alternatives.shift() ?? '';

  if (!translatedText) throw new Error('Translation failed');

  const ret: TranslateResult = {
    code: 200,
    id: postData.id,
    method: 'Free',
    data: translatedText,
    source_lang: sourceLang.toUpperCase(),
    target_lang: targetLang.toUpperCase(),
    alternatives: typeof altLimit === 'number' ? alternatives.slice(0, altLimit) : alternatives
  };

  if (printResult) console.log(response, ret);
  return ret;
}
