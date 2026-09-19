/**
 * 抓页面启动期的报错（挂载/apply 阶段抛的错常常被宿主的错误边界吞掉，
 * cdp-probe 里再 console.error 补丁已经太晚——这里用
 * `Page.addScriptToEvaluateOnNewDocument` 在文档开始前就把补丁装上）。
 *
 * 用法：node tools/cdp-errors.mjs <ws 模块路径> <URL> [等待秒数] [cdp 端口] [表达式文件]
 *   给了表达式文件就在导航后先把它跑一遍（和 cdp-probe 一样支持 await），再收集报错——
 *   「打开某个窗格才崩」这类问题需要先点开它。
 * 退出码：0 有输出（无论有没有错）；2 用法错；4 CDP 连不上。
 */
const [, , wsArg, pageUrl, waitArg, portArg, exprFile] = process.argv
if (!wsArg || !pageUrl) {
  console.error('usage: node tools/cdp-errors.mjs <ws-module> <url> [waitSec] [cdp-port]')
  process.exit(2)
}
const waitSec = Number(waitArg ?? 6)
const cdpPort = Number(portArg ?? 9222)
const WebSocket = (await import('file:///' + wsArg.replace(/\\/g, '/'))).default

const list = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json()
const page = list.find((t) => t.type === 'page')
if (!page?.webSocketDebuggerUrl) { console.error('CDP: no page target'); process.exit(4) }
const sock = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => { sock.on('open', res); sock.on('error', (e) => rej(new Error('connect failed: ' + e.message))) })
let id = 1
const pending = new Map()
sock.on('message', (raw) => {
  const m = JSON.parse(String(raw))
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result) }
})
const send = (method, params = {}) => new Promise((resolve, reject) => { const i = id++; pending.set(i, { resolve, reject }); sock.send(JSON.stringify({ id: i, method, params })) })

await send('Page.enable')
await send('Runtime.enable')
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `
    window.__dshErrs = [];
    (() => {
      const push = (kind, text) => { try { window.__dshErrs.push(kind + ': ' + String(text).slice(0, 1200)) } catch {} };
      const origErr = console.error;
      console.error = (...a) => { push('console.error', a.map((x) => (x && x.stack) ? x.stack : String(x)).join(' ')); origErr.apply(console, a) };
      const origWarn = console.warn;
      console.warn = (...a) => { push('console.warn', a.map(String).join(' ')); origWarn.apply(console, a) };
      window.addEventListener('error', (e) => push('window.onerror', e.error?.stack ?? e.message));
      window.addEventListener('unhandledrejection', (e) => push('unhandledrejection', e.reason?.stack ?? e.reason));
    })();
  `,
})
await send('Page.navigate', { url: 'about:blank' })
await new Promise((r) => setTimeout(r, 400))
await send('Page.navigate', { url: pageUrl })
await new Promise((r) => setTimeout(r, waitSec * 1000))
if (exprFile) {
  const { readFileSync } = await import('node:fs')
  const expression = readFileSync(exprFile, 'utf8')
  const ran = await send('Runtime.evaluate', {
    expression: `(async () => { const __probeArgs = {}; ${expression} })()`,
    returnByValue: true,
    awaitPromise: true,
  })
  if (ran.exceptionDetails) console.error('EXPR EXCEPTION:', JSON.stringify(ran.exceptionDetails.exception?.description ?? ran.exceptionDetails))
}
const out = await send('Runtime.evaluate', {
  expression: `({ href: location.href, errs: (window.__dshErrs ?? []).slice(0, 12), slotError: document.querySelector('[data-slot-error]')?.getAttribute('data-slot-error') ?? null, slots: [...document.querySelectorAll('[data-slot-error]')].map((n) => n.getAttribute('data-slot-error')) })`,
  returnByValue: true,
})
console.log(JSON.stringify(out.result?.value, null, 2))
sock.close()
