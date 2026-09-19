/**
 * 把 dsh web 的「一次性 token URL」换成浏览器 cookie，并种进无头浏览器（CDP）。
 *
 * 为什么需要它：dsh web 的根地址要求鉴权，启动日志里那行 `dsh web: http://127.0.0.1:<port>/?token=…`
 * 里的 token **只能用一次**（第一次请求 303 到 / 并回一个 HttpOnly cookie，再拿同一个 token 请求就是 401）。
 * 命令行 fetch / 探针脚本重复用同一个 token 就会看到那张「authentication required」页。
 * 这里先用一次 token 换到 cookie，再通过 CDP 的 Network.setCookie 写进无头浏览器，
 * 之后所有探针都能直接访问 `http://127.0.0.1:<port>/`。
 *
 * 用法：
 *   node tools/cdp-auth.mjs <token-url> [ws 模块路径] [cdp 端口]
 *     token-url     形如 http://127.0.0.1:5689/?token=…
 *     ws 模块路径   宿主自带的 ws（原来是 C:\MySoftware\nodejs\node_global\node_modules\@deepseek-ai\dsh\node_modules\ws\index.js
 *                   —— 本地私有路径不能写进仓库，所以这里不设默认值，必须由调用方传）
 *     cdp 端口      默认 9222
 * 退出码：0 成功；2 用法错；3 换 cookie 失败；4 CDP 连不上/种 cookie 失败。
 */
const [, , tokenUrl, wsArg, portArg] = process.argv
if (!tokenUrl || !wsArg) {
  console.error('usage: node tools/cdp-auth.mjs <token-url> <ws-module> [cdp-port]')
  process.exit(2)
}
const cdpPort = Number(portArg ?? 9222)
const wsPath = wsArg.replace(/\\/g, '/')
const WebSocket = (await import('file:///' + wsPath)).default

// 1) 一次性 token -> cookie
const res = await fetch(tokenUrl, { redirect: 'manual' })
const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : []
const jar = []
for (const line of raw) {
  const [pair, ...attrs] = line.split(';').map((s) => s.trim())
  const eq = pair.indexOf('=')
  if (eq <= 0) continue
  const opt = {}
  for (const a of attrs) {
    const [k, v] = a.split('=')
    opt[k.toLowerCase()] = v ?? true
  }
  jar.push({ name: pair.slice(0, eq), value: pair.slice(eq + 1), httpOnly: opt.httponly === true, sameSite: opt.samesite })
}
if (jar.length === 0) {
  console.error('token exchange failed: status=' + res.status + ' (token 可能已被用过/过期)')
  process.exit(3)
}

// 2) 种进无头浏览器
let targets = null
for (let i = 0; i < 40; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json()
    if (Array.isArray(list) && list.some((t) => t.type === 'page')) { targets = list; break }
  } catch {}
  await new Promise((r) => setTimeout(r, 500))
}
const page = (targets ?? []).find((t) => t.type === 'page')
if (!page?.webSocketDebuggerUrl) {
  console.error('CDP: no page target on port ' + cdpPort)
  process.exit(4)
}
const sock = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve, reject) => { sock.on('open', resolve); sock.on('error', (e) => reject(new Error('CDP connect failed: ' + e.message))) })
let nextId = 1
const pending = new Map()
sock.on('message', (rawMsg) => {
  const msg = JSON.parse(String(rawMsg))
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
  }
})
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = nextId++
    pending.set(id, { resolve, reject })
    sock.send(JSON.stringify({ id, method, params }))
  })
await send('Network.enable')
const origin = new URL(tokenUrl).origin
for (const c of jar) {
  await send('Network.setCookie', {
    name: c.name, value: c.value, url: origin + '/', path: '/',
    httpOnly: c.httpOnly, secure: false, sameSite: c.sameSite === 'strict' ? 'Strict' : 'Lax',
  })
}
sock.close()
console.log('auth cookie installed for ' + origin + ' (' + jar.map((c) => c.name).join(',') + ')')
