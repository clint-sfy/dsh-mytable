/**
 * 通用 CDP 探针（真实宿主里跑任意断言；无第三方依赖，只用宿主自带的 ws 模块）。
 *
 * 用法：
 *   node tests/cdp-probe.mjs <ws 模块路径> <就绪 URL> <表达式文件> [截图 png 路径] [导航模式] [argsJson 文件]
 *     - 表达式文件：一段 JS 表达式源码（支持 await），返回值会被 JSON 打印
 *     - 截图路径可选
 *     - 导航模式：'keep'（默认，若已在目标 URL 就不重新导航）| 'reload' | 'fresh'（先导航到 about:blank 再导航）
 *     - argsJson 文件：可选，内容是 JSON 对象，注入为页面里的 __probeArgs（表达式可直接读；
 *       用文件而不是内联字符串，避免 PowerShell 向原生程序传参时吞掉内层引号）
 *
 * 前置：headless Edge/Chrome 带 --remote-debugging-port=9222 在跑。
 * 退出码：表达式抛出或返回 {fail:true} → 1；否则 0。
 */
const [, , wsPath, pageUrl, exprFile, shotPath, navMode = 'keep', argsFile] = process.argv
if (!wsPath || !pageUrl || !exprFile) {
  console.error('usage: node cdp-probe.mjs <ws-module> <url> <expr-file> [png] [keep|reload|fresh]')
  process.exit(2)
}
const { readFileSync, writeFileSync } = await import('node:fs')
const WebSocket = (await import('file:///' + wsPath.replace(/\\/g, '/'))).default
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const expression = readFileSync(exprFile, 'utf8')

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
  console.error('CDP: no page target (start headless browser with --remote-debugging-port=9222)')
  process.exit(3)
}

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
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
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

const current = (await send('Runtime.evaluate', { expression: 'location.href', returnByValue: true })).result?.value ?? ''
const target = pageUrl.split('?')[0]
const needNav = navMode === 'fresh' || navMode === 'reload' || !String(current).startsWith(target)
if (needNav) {
  if (navMode === 'fresh') {
    await send('Page.navigate', { url: 'about:blank' })
    await sleep(600)
  }
  events.length = 0
  await send('Page.navigate', { url: pageUrl })
  for (let i = 0; i < 60 && !events.includes('Page.loadEventFired'); i++) await sleep(500)
  await sleep(5000) // 外壳 + 插件客户端 apply()
}

let probeArgs = '{}'
if (argsFile) {
  try {
    // 去掉 BOM：PowerShell 的 UTF8 编码常带 EF BB BF，JSON.parse 会直接抛错
    const raw = readFileSync(argsFile, 'utf8').replace(/^\uFEFF/, '')
    probeArgs = JSON.stringify(JSON.parse(raw))
  } catch (e) {
    console.error('cannot read args file ' + argsFile + ': ' + e.message)
    process.exit(2)
  }
}

const evaluated = await send('Runtime.evaluate', {
  expression: `(async () => { const __probeArgs = ${probeArgs}; ${expression} })()`,
  returnByValue: true,
  awaitPromise: true,
})
if (evaluated.exceptionDetails) {
  console.error('EVAL EXCEPTION:', JSON.stringify(evaluated.exceptionDetails.exception?.description ?? evaluated.exceptionDetails))
  sock.close()
  process.exit(1)
}
const value = evaluated.result?.value
console.log(JSON.stringify(value, null, 2))

if (shotPath) {
  try {
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    writeFileSync(shotPath, Buffer.from(shot.data, 'base64'))
    console.log('screenshot written: ' + shotPath)
  } catch (e) {
    console.error('screenshot failed: ' + e.message)
  }
}

const failed = value && typeof value === 'object' && value.fail === true
console.log(failed ? 'RESULT FAIL' : 'RESULT OK')
sock.close()
process.exit(failed ? 1 : 0)
