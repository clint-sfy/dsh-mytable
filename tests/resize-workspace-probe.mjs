/**
 * 真实宿主 resize 压力探针：跨响应式断点反复改变视口，捕获分栏白屏时的锚点/几何/保活状态。
 * 用法：node tests/resize-workspace-probe.mjs <ws-module> <page-url> [cdp-port]
 */
const [, , wsArg, pageUrl, portArg] = process.argv
if (!wsArg || !pageUrl) {
  console.error('usage: node tests/resize-workspace-probe.mjs <ws-module> <page-url> [cdp-port]')
  process.exit(2)
}
const port = Number(portArg ?? 9222)
const WebSocket = (await import('file:///' + wsArg.replace(/\\/g, '/'))).default
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const page = targets.find((target) => target.type === 'page')
if (!page?.webSocketDebuggerUrl) throw new Error('no CDP page target')
const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve, reject) => { socket.on('open', resolve); socket.on('error', reject) })
let nextId = 1
const pending = new Map()
const exceptions = []
const resourceErrors = []
socket.on('message', (raw) => {
  const msg = JSON.parse(String(raw))
  if (msg.id && pending.has(msg.id)) {
    const item = pending.get(msg.id); pending.delete(msg.id)
    msg.error ? item.reject(new Error(JSON.stringify(msg.error))) : item.resolve(msg.result)
  } else if (msg.method === 'Runtime.exceptionThrown') {
    exceptions.push(msg.params?.exceptionDetails?.exception?.description ?? msg.params?.exceptionDetails?.text ?? 'unknown exception')
  } else if (msg.method === 'Log.entryAdded' && msg.params?.entry?.level === 'error') {
    resourceErrors.push(msg.params.entry.text)
  }
})
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }))
})
const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
  return result.result?.value
}

await send('Page.enable')
await send('Runtime.enable')
await send('Log.enable')
await send('Page.navigate', { url: pageUrl })
await sleep(5500)
const opened = await evaluate(`(() => {
  const store = window.__dshWorktable?.splitStore
  if (!store) return { ok:false, reason:'no splitStore' }
  if (store.active) store.close()
  const ok = store.open({ id:'resize-probe', title:'resize probe', top:null, main:[
    { id:'p1', title:'窗口1', min:120, tabs:[], active:0 },
    { id:'p2', title:'窗口2', min:120, tabs:[], active:0 }
  ], chatWidth:{ default:420, min:260, max:900 } })
  return { ok, root:!!store.root, phase:store.root?.dataset?.phase }
})()`)
if (!opened?.ok) {
  console.error(JSON.stringify({ opened, exceptions }, null, 2))
  socket.close(); process.exit(1)
}
await sleep(800)
await evaluate(`(() => {
  const store = window.__dshWorktable.splitStore
  if (!store.__resizeProbeSyncAnchor) {
    const originalSyncAnchor = store.syncAnchor
    store.syncAnchor = function(...args) {
      window.__resizeProbeSyncAnchor = {
        at:Date.now(),
        rootConnected:this.root?.isConnected,
        phase:this.root?.dataset?.phase,
        hasConversationRoot:!!document.querySelector('[data-phase="active"], [data-phase="hero"]')
      }
      return originalSyncAnchor.apply(this,args)
    }
    store.__resizeProbeSyncAnchor = true
  }
  if (!store.__resizeProbeClose) {
    const original = store.close
    store.close = function(...args) {
      window.__resizeProbeClose = {
        stack:new Error('splitStore.close').stack,
        at:Date.now(),
        syncAnchor:window.__resizeProbeSyncAnchor,
        viewAreaConnected:this.viewArea?.isConnected,
        margins:this.viewArea ? {
          left:this.viewArea.style.marginLeft,
          right:this.viewArea.style.marginRight,
          top:this.viewArea.style.marginTop,
          expectedLeft:this.lastMarginLeft,
          expectedRight:this.lastMarginRight,
          expectedTop:this.lastMarginTop
        } : null
      }
      return original.apply(this,args)
    }
    store.__resizeProbeClose = true
  }
})()`)

const sizes = [
  [1600, 1000], [1180, 760], [820, 620], [560, 480], [430, 420],
  [980, 540], [1450, 820], [700, 900], [1200, 700], [480, 760],
]
const failures = []
let samples = 0
for (let round = 0; round < 10; round++) {
  for (const [width, height] of sizes) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    await sleep(90)
    const state = await evaluate(`(() => {
      const store = window.__dshWorktable?.splitStore
      const rootRect = store?.root?.getBoundingClientRect?.()
      const layer = document.querySelector('[data-mt-workspace="resize-probe"]')
      const paneRects = layer ? [...layer.querySelectorAll('.dsh-mt_pane')].map((el) => {
        const r=el.getBoundingClientRect(); return { w:r.width,h:r.height,x:r.x,y:r.y }
      }) : []
      const style = layer ? getComputedStyle(layer) : null
      return {
        active:store?.active, specId:store?.spec?.id, rootConnected:store?.root?.isConnected,
        root:{ w:rootRect?.width??-1,h:rootRect?.height??-1 }, geom:store?.geom,
        layer:!!layer, layerActive:layer?.getAttribute('data-mt-active'), visibility:style?.visibility,
        display:style?.display, paneRects, closeProbe:window.__resizeProbeClose
      }
    })()`)
    samples++
    const geomW = state?.geom ? state.geom.right - state.geom.left : -1
    const geomH = state?.geom ? state.geom.bottom - state.geom.top : -1
    // 极窄窗口可能无法同时满足两个窗格的 min-width；这不属于本回归要捕获的“整个工作区被关闭/白屏”。
    // 这里只要求工作区持续激活、几何有效，且至少一个内容窗格仍可见。
    const bad = !state?.active || state.specId !== 'resize-probe' || !state.rootConnected || !state.layer
      || state.layerActive !== 'true' || state.visibility === 'hidden' || state.display === 'none'
      || geomW < 100 || geomH < 100 || state.paneRects.length !== 2
      || !state.paneRects.some((r) => r.w >= 20 && r.h >= 20)
      || state.paneRects.some((r) => !Number.isFinite(r.x + r.y + r.w + r.h))
    if (bad) failures.push({ round, width, height, state, exceptions: [...exceptions] })
  }
}
await send('Emulation.clearDeviceMetricsOverride')
console.log(JSON.stringify({ samples, failures: failures.slice(0, 8), failureCount: failures.length, exceptions, resourceErrors }, null, 2))
socket.close()
process.exit(failures.length || exceptions.length ? 1 : 0)
