// 修改 BASE_URL 指向你的部署地址，例如 https://deeplx-serverless.<subdomain>.workers.dev
const BASE_URL = process.env.BASE_URL || 'http://localhost:8787';

const res = await fetch(`${BASE_URL}/translate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: 'hello, world!',
    source_lang: 'en',
    target_lang: 'zh',
    alt_count: 2
  })
});

console.log(res.status, await res.json());
