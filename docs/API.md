# API 文档

服务默认监听 `http://localhost:8787`（`npm run dev`），线上为你的 Workers 域名。

- [GET /](#get-)
- [POST /translate](#post-translate)
  - [请求体](#请求体)
  - [响应体](#响应体)
  - [语言代码](#语言代码)
- [错误码](#错误码)

---

## GET /

健康检查，用于确认服务在线。

**响应**

```json
{
  "code": 200,
  "message": "Welcome to the DeepL Free API. Please POST to '/translate'. Visit 'https://github.com/guobao2333/DeepLX-Serverless' for more information."
}
```

---

## POST /translate

翻译接口。

**请求头**

| 名称 | 值 |
| --- | --- |
| Content-Type | `application/json` |

**请求体**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `text` | String | 是 | 待翻译文本，不能为空 |
| `target_lang` | String | 是 | 目标语言代码，如 `EN`、`ZH`、`JA` |
| `source_lang` | String | 否 | 源语言代码，缺省或 `auto` 表示自动检测 |
| `alt_count` | Number | 否 | 备选翻译条数，取值 `0`~`3`，需服务端开启 `ALTERNATIVE` |

**示例**

```bash
curl -X POST 'http://localhost:8787/translate' \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "你好，世界！",
    "source_lang": "zh",
    "target_lang": "en",
    "alt_count": 2
  }'
```

**响应体**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `code` | Number | 状态码，成功为 `200` |
| `id` | Number | 本次翻译请求的内部 ID |
| `data` | String | 翻译结果 |
| `method` | String | 固定为 `Free` |
| `source_lang` | String | 实际使用的源语言（自动检测时为检测结果） |
| `target_lang` | String | 目标语言 |
| `alternatives` | String[] | 备选翻译；服务端关闭 `ALTERNATIVE` 时为空数组 |

```json
{
  "code": 200,
  "id": 676115,
  "data": "你好，世界！",
  "method": "Free",
  "source_lang": "EN",
  "target_lang": "ZH",
  "alternatives": ["Hello, world!"]
}
```

> [!NOTE]
> `source_lang` 为 `AUTO` 时说明请求未指定源语言且自动检测未返回有效结果。

### 语言代码

常用代码：`ZH` 中文、`EN` 英语、`JA` 日语、`KO` 韩语、`FR` 法语、`DE` 德语、`ES` 西班牙语、`RU` 俄语。

支持区域变体，如 `EN-US`、`EN-GB`、`PT-BR`、`ZH-HANS`。带区域的代码会映射为基础语言，并把区域作为变体传给 DeepL。

---

## 错误码

| HTTP | code | 场景 | 处理建议 |
| --- | --- | --- | --- |
| 400 | 400 | 请求体不是合法 JSON，或 `text`/`target_lang` 缺失，或 `alt_count` 超出 `0`~`3` | 检查参数 |
| 429 | 429 | 触发 DeepL 限流 | 稍后重试，或更换部署节点 |
| 500 | 500 | DeepL 返回异常 / 翻译结果为空 / 网络错误 | 重试；若持续出现请提 issue |

错误响应统一为：

```json
{
  "code": 429,
  "message": "Too Many Requests"
}
```

---

## 调用示例

### cURL

```bash
curl -X POST 'https://your-worker.workers.dev/translate' \
  -H 'Content-Type: application/json' \
  -d '{"text": "how are you?", "target_lang": "zh"}'
```

### JavaScript (fetch)

```js
const res = await fetch('https://your-worker.workers.dev/translate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: 'how are you?', source_lang: 'en', target_lang: 'zh' })
});
console.log(await res.json());
```

### Python (requests)

```python
import requests

r = requests.post(
    "https://your-worker.workers.dev/translate",
    json={"text": "how are you?", "source_lang": "en", "target_lang": "zh"},
)
print(r.json())
```
