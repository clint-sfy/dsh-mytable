/**
 * 浏览器窗验收用的本地夹具站点（127.0.0.1，随机端口）。
 * 用法：node tests/browser-fixture-server.mjs [port]   # 缺省 0 = 随机端口，启动后打印 FIXTURE <url>
 *
 * 页面清单（覆盖探针要判的每一种响应头形态）：
 *   /ok            无任何信号 → 可嵌入
 *   /blocked       X-Frame-Options: DENY → 拒绝嵌入
 *   /csp           CSP frame-ancestors 'none' → 拒绝嵌入
 *   /csp-wild      CSP frame-ancestors * → 可嵌入
 *   /head405       HEAD 回 405、GET 带 XFO: SAMEORIGIN（覆盖「HEAD 被拒补 GET」）
 *   /headnosignal  HEAD 不带 XFO、GET 带 XFO: DENY（覆盖「HEAD 无信号补 GET」）
 *   /hits          本次进程收到的请求记录（method + path），带 CORS 头供探针跨源读
 * 仅监听 127.0.0.1，只用于本机验收。
 */
import { createServer } from 'node:http'

const port = Number(process.argv[2] ?? 0)
const hits = []

const PAGES = {
  '/ok': { status: 200, headers: {}, body: '<!doctype html><title>MT-OK</title><h1>ok</h1>' },
  '/blocked': { status: 200, headers: { 'x-frame-options': 'DENY' }, body: '<!doctype html><title>MT-BLOCKED</title>blocked' },
  '/csp': {
    status: 200,
    headers: { 'content-security-policy': "default-src 'self'; frame-ancestors 'none'" },
    body: '<!doctype html><title>MT-CSP</title>csp',
  },
  '/csp-wild': { status: 200, headers: { 'content-security-policy': 'frame-ancestors *' }, body: '<!doctype html><title>MT-WILD</title>wild' },
  '/head405': { status: 200, headers: { 'x-frame-options': 'SAMEORIGIN' }, body: '<!doctype html><title>MT-405</title>', head405: true },
  '/headnosignal': { status: 200, headers: {}, getOnlyHeaders: { 'x-frame-options': 'DENY' }, body: '<!doctype html><title>MT-HEADNOSIG</title>' },
}

const server = createServer((req, res) => {
  const path = (req.url ?? '/').split('?')[0]
  hits.push({ method: req.method, path })
  if (path === '/hits') {
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    })
    res.end(JSON.stringify({ hits }))
    return
  }
  const page = PAGES[path]
  if (!page) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'access-control-allow-origin': '*' })
    res.end('not found')
    return
  }
  if (page.head405 === true && req.method === 'HEAD') {
    res.writeHead(405, { 'content-type': 'text/plain' })
    res.end()
    return
  }
  const extra = req.method === 'HEAD' ? {} : (page.getOnlyHeaders ?? {})
  res.writeHead(page.status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    ...page.headers,
    ...extra,
  })
  res.end(req.method === 'HEAD' ? undefined : page.body)
})

server.listen(port, '127.0.0.1', () => {
  console.log('FIXTURE http://127.0.0.1:' + server.address().port)
})
