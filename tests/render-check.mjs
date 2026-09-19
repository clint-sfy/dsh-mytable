/**
 * 真实浏览器渲染验收（CDP 直连，无第三方依赖，只用宿主自带的 ws 模块）：
 *   1. 连上 headless Edge 的 DevTools（--remote-debugging-port=9222）
 *   2. 用带 token 的就绪 URL 导航，等 load 事件 + 额外等待 React 挂载
 *   3. Runtime.evaluate 断言插件真的渲染了（style 标签 / 侧栏区块 / 文案）
 *   4. Page.captureScreenshot 存 PNG 供人眼复核
 *
 * 用法：node render-check.mjs <ws 模块路径> <就绪 URL> <截图输出路径>
 */
const [, , wsPath, pageUrl, shotPath] = process.argv
if (!wsPath || !pageUrl || !shotPath) {
  console.error('usage: node render-check.mjs <ws-module-path> <url> <png-out>')
  process.exit(2)
}
const { writeFileSync } = await import('node:fs')
const WebSocket = (await import('file:///' + wsPath.replace(/\\/g, '/'))).default

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 1) 找到 headless Edge 里那个 page target
let targets = null
for (let i = 0; i < 40; i++) {
  try {
    const res = await fetch('http://127.0.0.1:9222/json/list')
    targets = await res.json()
    if (Array.isArray(targets) && targets.some((t) => t.type === 'page')) break
  } catch {}
  await sleep(500)
}
const page = (targets ?? []).find((t) => t.type === 'page')
if (!page?.webSocketDebuggerUrl) {
  console.error('CDP: no page target found (is headless Edge running with --remote-debugging-port=9222?)')
  process.exit(3)
}
console.log('CDP target:', page.url)

// 2) 连 page target，发命令
const sock = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  sock.on('open', resolve)
  sock.on('error', (e) => reject(new Error('CDP connect failed: ' + e.message)))
})
let nextId = 1
const pending = new Map()
const events = []
sock.on('message', (raw) => {
  const msg = JSON.parse(String(raw))
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    msg.error ? reject(new Error(msg.method + ': ' + JSON.stringify(msg.error))) : resolve(msg.result)
  } else if (msg.method) events.push(msg.method)
})
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = nextId++
    pending.set(id, { resolve, reject })
    sock.send(JSON.stringify({ id, method, params }))
  })

await send('Page.enable')
await send('Runtime.enable')
await send('Page.navigate', { url: pageUrl })

// 3) 等 load 事件（最多 30s），再给 React 挂载留时间
for (let i = 0; i < 60 && !events.includes('Page.loadEventFired'); i++) await sleep(500)
console.log('load event:', events.includes('Page.loadEventFired') ? 'fired' : 'NOT SEEN')
await sleep(6000) // 外壳 + 插件客户端 apply() + 侧栏渲染

// 4) 断言
const probe = `(() => {
  const q = (s) => document.querySelectorAll(s).length
  const text = document.body ? document.body.innerText : ''
  return {
    title: document.title,
    styleTags: q('style[data-dsh-plugin="dsh-mytable"]'),
    sectionNodes: q('.dsh-mt_section'),
    railNodes: q('.dsh-mt_rail'),
    projectNodes: q('[data-wt-id]'),
    hasWorktableText: text.includes('工作台'),
    hasConsoleText: text.includes('控制室'),
    bodyTextHead: text.replace(/\\s+/g, ' ').slice(0, 300),
    moduleLoaded: typeof window.__ModuleLoader__ !== 'undefined',
  }
})()`
const evaluated = await send('Runtime.evaluate', { expression: probe, returnByValue: true, awaitPromise: false })
const value = evaluated?.result?.value ?? null
console.log('PROBE ' + JSON.stringify(value, null, 2))

// 5) 截图
try {
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  writeFileSync(shotPath, Buffer.from(shot.data, 'base64'))
  console.log('screenshot written:', shotPath)
} catch (e) {
  console.error('screenshot failed:', e.message)
}

const ok = value && value.styleTags > 0 && value.sectionNodes > 0 && value.hasWorktableText
console.log(ok ? 'RESULT PASS — 插件客户端在真实宿主里挂载并渲染' : 'RESULT FAIL — 见上面 PROBE')
sock.close()
process.exit(ok ? 0 : 1)
