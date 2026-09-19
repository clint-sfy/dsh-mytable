// 开放注册接口 + 设置页新版式验收（真实宿主里跑）：
//   A. 版式：两组并排（grid 两列）+ 各自独立成框 + 说明文案
//   B. 接口：window.__dshMytable（= ctx.mytable）注册窗口类型 / 文件预览器
//      → 设置页实时出现卡片 → 选择器可开 → 内容按 mount/url 渲染 → 关掉开关后从入口消失、预览回落内置
// 用法：
//   node tests/cdp-probe.mjs <ws> <url> tests/verify-plugin-registry.js [png] fresh <args.json>
//   args.json: { "demoFile": "<绝对路径>.dshdemo" }  ← 一个内容为纯文本的测试文件
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const out = { steps: [], fail: false }
const step = (name, ok, detail) => { out.steps.push({ name, ok, detail }); if (!ok) out.fail = true }

const svc = window.__dshMytable
const store = window.__dshWorktable && window.__dshWorktable.splitStore
const demoFile = __probeArgs.demoFile
const PANE_ID = 'probe.echo'
const PANE_URL_ID = 'probe.remote'
const VIEWER_ID = 'probe.dshdemo'

step('ctx.mytable 服务已暴露（window.__dshMytable）', !!svc, svc ? 'version=' + svc.version : null)
step('splitStore 钩子可用', !!store, null)
if (!svc || !store) return out

// ── A. 设置页版式 ───────────────────────────────────────────────────────
const trigger = document.querySelector('[data-slot="sidebar.settings"] button')
trigger && trigger.click()
for (let i = 0; i < 40 && !document.querySelector('.dsh-mt_set'); i++) await sleep(250)
const nav = [...document.querySelectorAll('button')].find((b) => /工作台/.test(b.textContent || '') && !/dsh-mt_/.test(String(b.className)))
nav && nav.click()
await sleep(800)
const body = document.querySelector('.dsh-mt_set')
step('设置节已渲染', !!body, body ? 'ok' : null)
if (!body) return out

const groups = [...body.querySelectorAll('.dsh-mt_setGroup')]
const grids = [...body.querySelectorAll('.dsh-mt_setGrid')]
const gridTracks = grids.map((g) => getComputedStyle(g).gridTemplateColumns.split(' ').filter((x) => x && x !== 'none').length)
step('每组框内卡片一排两个（2 列网格）', grids.length === 2 && gridTracks.every((n) => n === 2),
  grids.map((g) => getComputedStyle(g).gridTemplateColumns).join(' | '))
step('两个分组各自独立成框（有边框/圆角）', groups.length === 2 && groups.every((g) => {
  const cs = getComputedStyle(g)
  return parseFloat(cs.borderTopWidth) > 0 && parseFloat(cs.borderTopLeftRadius) > 0
}), groups.map((g) => getComputedStyle(g).borderTopWidth + '/' + getComputedStyle(g).borderTopLeftRadius).join(' , '))
step('说明文案为「显示内容与默认行为」', /显示内容与默认行为/.test(body.textContent || ''), (body.querySelector('.dsh-mt_setIntro')?.textContent || '').slice(0, 40))
const cardsBefore = body.querySelectorAll('.dsh-mt_setCard').length
step('内置卡片 11 张（5 窗口类型 + 6 预览）', cardsBefore === 11, String(cardsBefore))
step('每组末尾有「添加…插件＋」磁贴', body.querySelectorAll('.dsh-mt_setAdd').length === 2,
  String(body.querySelectorAll('.dsh-mt_setAdd').length))

// ── B. 注册窗口类型 / 文件预览器 ────────────────────────────────────────
const offPane = svc.registerPaneType({
  id: PANE_ID,
  title: '探针挂载型',
  description: '自定义 mount 渲染的窗口类型（验收用）',
  icon: '🧪',
  order: 5,
  mount: () => {
    const el = document.createElement('div')
    el.className = 'probe-echo-pane'
    el.textContent = 'PROBE_PANE_RENDERED'
    return el
  },
})
const offPaneUrl = svc.registerPaneType({
  id: PANE_URL_ID,
  title: '探针网址型',
  description: '按 url 用 iframe 承载的窗口类型（验收用）',
  icon: '🔗',
  order: 6,
  url: (scope) => '/api/worktable/template/dshell.html?cwd=' + encodeURIComponent(scope.cwd || ''),
})
const offViewer = svc.registerFileViewer({
  id: VIEWER_ID,
  title: '探针预览器',
  description: '接管 .dshdemo 文件（验收用）',
  icon: '🧪',
  exts: ['.dshdemo'],
  mount: (p) => {
    const el = document.createElement('div')
    el.className = 'probe-viewer'
    el.textContent = 'PROBE_VIEWER_RENDERED:' + p.fileName
    return el
  },
})
step('register* 返回 disposer', typeof offPane === 'function' && typeof offPaneUrl === 'function' && typeof offViewer === 'function', null)
step('服务侧清单已包含注册项', svc.paneTypes().some((d) => d.id === PANE_ID) && svc.fileViewers().some((d) => d.id === VIEWER_ID),
  svc.paneTypes().map((d) => d.id).join(','))
await sleep(600)

// 设置页实时出现插件卡片（带 data-plugin-id）
const pluginCards = [...body.querySelectorAll('.dsh-mt_setCard[data-plugin-id]')]
step('设置页实时出现 3 张插件卡片', pluginCards.length === 3, pluginCards.map((c) => c.getAttribute('data-plugin-id')).join(' , '))
const paneGroup = body.querySelectorAll('.dsh-mt_setGroup')[0]
const viewerGroup = body.querySelectorAll('.dsh-mt_setGroup')[1]
step('窗口类型注册项归到第一组', [...paneGroup.querySelectorAll('.dsh-mt_setCard[data-plugin-id]')].length === 2, null)
step('文件预览注册项归到第二组', [...viewerGroup.querySelectorAll('.dsh-mt_setCard[data-plugin-id]')].length === 1, null)
step('底部版本/计数行', /dsh-mytable v/.test(body.textContent || '') && /窗口 2 个/.test(body.textContent || ''),
  (body.querySelector('.dsh-mt_setFoot')?.textContent || '').slice(0, 60))

// ── C. 关掉设置面板 → 选择器里应有注册类型，且能挂载 ───────────────────
const closeBtn = [...document.querySelectorAll('button')].find((b) => /关闭|Close/.test(b.getAttribute('aria-label') || ''))
closeBtn && closeBtn.click()
await sleep(500)
store.open({ id: 'probe-registry', title: 'probe', top: null, main: [{ id: 'rp1', title: '窗1', min: 120 }], chatWidth: { default: 420, min: 260, max: 900 } })
await sleep(1400)
const pickLabels = () => [...document.querySelectorAll('.dsh-mt_panePick')].map((b) => b.textContent.trim())
const picks = pickLabels()
step('选择器出现注册的窗口类型', picks.some((p) => p.includes('探针挂载型')) && picks.some((p) => p.includes('探针网址型')), picks.join(' / '))

const btn = [...document.querySelectorAll('.dsh-mt_panePick')].find((b) => b.textContent.includes('探针挂载型'))
btn && btn.click()
await sleep(900)
step('mount 型窗口按自定义渲染', !!document.querySelector('.probe-echo-pane') && (document.querySelector('.probe-echo-pane')?.textContent || '').includes('PROBE_PANE_RENDERED'),
  document.querySelector('.probe-echo-pane')?.textContent ?? 'not found')

// 换到 url 型：应出现 iframe 且 src 指向注册函数返回的地址
store.openTab('main', 0, { kind: 'plugin', id: PANE_URL_ID, title: '探针网址型' })
await sleep(1400)
const frame = document.querySelector('iframe.dsh-mt_paneFrame')
step('url 型窗口按 iframe 承载', !!frame && /\/api\/worktable\/template\/dshell\.html/.test(frame.getAttribute('src') || ''),
  frame ? String(frame.getAttribute('src')).slice(0, 60) : 'no iframe')

// ── D. 文件预览器接管 + 关掉开关后回落 ──────────────────────────────────
step('测试文件已提供', !!demoFile, demoFile || null)
if (demoFile) {
  store.openTab('main', 0, { kind: 'file', path: demoFile })
  await sleep(1400)
  const pv = document.querySelector('.probe-viewer')
  step('注册的预览器接管了 .dshdemo', !!pv && (pv.textContent || '').includes('PROBE_VIEWER_RENDERED'),
    pv ? String(pv.textContent).slice(0, 50) : 'not found')

  // 关掉该预览器 → 应回落到内置（.dshdemo 不是已知家族 → 纯文本）
  svc.isEnabled('viewer', VIEWER_ID) === true
  const setOff = svc.registerFileViewer({ id: 'probe.noop', exts: [], title: 'noop' })
  setOff()
  // 通过设置页开关关闭（与真实用户路径一致）
  const trigger2 = document.querySelector('[data-slot="sidebar.settings"] button')
  trigger2 && trigger2.click()
  await sleep(700)
  const nav2 = [...document.querySelectorAll('button')].find((b) => /工作台/.test(b.textContent || '') && !/dsh-mt_/.test(String(b.className)))
  nav2 && nav2.click()
  await sleep(700)
  const body2 = document.querySelector('.dsh-mt_set')
  const viewerSwitch = body2 && [...body2.querySelectorAll('.dsh-mt_setCard[data-plugin-id="' + VIEWER_ID + '"] .dsh-mt_setSwitch')][0]
  viewerSwitch && viewerSwitch.click()
  await sleep(500)
  const closed = [...document.querySelectorAll('button')].find((b) => /关闭|Close/.test(b.getAttribute('aria-label') || ''))
  closed && closed.click()
  await sleep(500)
  store.openTab('main', 0, { kind: 'file', path: demoFile })
  await sleep(1400)
  step('关掉插件预览器后回落内置（不再出现探针渲染）', !document.querySelector('.probe-viewer'),
    document.querySelector('.probe-viewer') ? 'still rendered' : 'fell back')
  const raw = JSON.parse(localStorage.getItem('dsh.mytable.settings.v1') || '{}')
  step('开关落盘到 dsh.mytable.settings.v1.pluginViewers', raw?.pluginViewers?.[VIEWER_ID] === false, JSON.stringify(raw?.pluginViewers))
}

// ── E. 注销：disposer 后注册项应消失（模拟插件卸载） ───────────────────
offPane(); offPaneUrl(); offViewer()
await sleep(500)
step('disposer 后清单移除', !svc.paneTypes().some((d) => d.id === PANE_ID) && !svc.fileViewers().some((d) => d.id === VIEWER_ID),
  svc.paneTypes().map((d) => d.id).join(','))
store.close()
await sleep(300)
const finalPicks = pickLabels()
step('注销后选择器不再提供该类型', !finalPicks.some((p) => p.includes('探针挂载型')), finalPicks.join(' / '))

return out
