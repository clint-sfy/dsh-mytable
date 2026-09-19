/**
 * 浏览器窗真机验收（在真实宿主的 headless 页里跑；前置：tests/browser-fixture-server.mjs 在跑，
 * 端口经 __probeArgs.port 传入）。
 *
 * 用法（由 tests/run-browser-pane-check.mjs 驱动，也可手工跑）：
 *   node tests/cdp-probe.mjs <ws模块> <就绪URL> tests/verify-browser-pane.js <png> fresh <args.json>
 *
 * ⚠️ 所有查询都必须限定在**当前可见窗格**内：分栏引擎把其它布局保活在池里
 * （外层包一层 visibility:hidden），全局 querySelector 会命中隐藏工作区的旧元素，
 * 造成假失败（本探针初版就踩过：折叠后仍"看到"地址栏）。
 *
 * 断言覆盖：起始态 / 地址栏归一化（裸 host:port 补 http + 沙箱令牌）/ 逐种嵌入拒绝形态
 * （XFO、CSP、HEAD 405 补 GET、HEAD 无信号补 GET）/ 通配可嵌入 / 危险 scheme 与空输入提示 /
 * 后退前进 / 刷新重挂 / 临时解锁与恢复 / 地址写回标签内容 / 夹具确实收到了 iframe 的 GET /
 * 折叠态只留整页（地址栏与沙箱条让位、iframe 不重载、页面拿到让出来的高度）。
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const out = { steps: [], fail: false }
const step = (name, ok, detail) => { out.steps.push({ name, ok: !!ok, detail }); if (!ok) out.fail = true }
const port = __probeArgs.port
const base = 'http://127.0.0.1:' + port
const store = window.__dshWorktable.splitStore

/** 当前激活的工作区根（保活池里隐藏的旧布局带 data-mt-active="false"，不能混进来） */
const activeRoot = () => document.querySelector('[data-mt-workspace][data-mt-active="true"]') ?? document
/** 当前可见窗格（激活工作区里第一个有盒子的窗格） */
const paneEl = () => activeRoot().querySelector('.dsh-mt_pane') ?? null
const q = (sel) => paneEl()?.querySelector(sel) ?? null
const qa = (sel) => (paneEl() ? [...paneEl().querySelectorAll(sel)] : [])
const picked = (label) => qa('.dsh-mt_panePick').find((b) => new RegExp(label).test(b.textContent || ''))
const input = () => q('[data-browser-input="url"]')
const frame = () => q('[data-browser-frame]')
const btn = (action) => q('[data-browser-action="' + action + '"]')
const bar = () => q('[data-browser-sandbox]')
const mode = () => q('[data-browser-mode]')?.getAttribute('data-browser-mode') ?? null
const sandboxText = () => q('.dsh-mt_sandboxText')?.textContent ?? ''
const message = () => q('[data-browser-message]')?.textContent ?? ''
const setInput = (v) => {
  const el = input()
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(el, v)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
const go = async (v, wait = 1600) => { setInput(v); btn('go').click(); await sleep(wait) }
const tabContent = () => JSON.stringify(store.spec?.main?.[0]?.tabs?.[0]?.content ?? null)
const openPane = async (label, id) => {
  store.open({
    id, title: 't', top: null,
    main: [{ id: 'p1', title: '窗口1', min: 200, content: null, tabs: [], active: 0 }],
    chatWidth: { default: 380, min: 260, max: 700 }, chatSide: 'right', chatFullHeight: true,
  })
  await sleep(1500)
  let hit = picked(label)
  // 新打开的布局刚进池，第一个可见窗格可能还是上一个：等一拍再找
  for (let i = 0; i < 10 && !hit; i++) { await sleep(300); hit = picked(label) }
  hit?.click()
  await sleep(1500)
  return !!hit
}

// ── 开一个浏览器窗（走真实选择器路径）─────────────────────────────────────────
if (!(await openPane('浏览器', 'browser-check'))) {
  step('浏览器窗选择器可用', false, '当前可见窗格里没有「浏览器」选项')
  return out
}

// ── 1. 起始态 ────────────────────────────────────────────────────────────────
const controls = qa('.dsh-mt_browserBar [data-browser-action]').map((e) => e.getAttribute('data-browser-action'))
step('起始态：地址栏 5 个图标键（后退/前进/刷新/前往/外部打开）', controls.join(',') === 'back,forward,reload,go,external', controls.join(','))
step('起始态：显示「输入网址开始浏览」且没有 iframe', !!q('[data-browser-state="start"]') && frame() === null && /输入网址/.test(sandboxText()), sandboxText())
step('起始态：后退/前进/刷新/外部打开均置灰', ['back', 'forward', 'reload', 'external'].every((a) => btn(a)?.disabled === true), '')
step('起始态：输入框有占位提示', /输入网址/.test(input()?.placeholder || ''), input()?.placeholder || '')

// ── 2. 裸 host:port 归一化 + 本机沙箱令牌 ─────────────────────────────────────
await go('127.0.0.1:' + port + '/ok', 2000)
const src1 = frame()?.getAttribute('src') || ''
const sb1 = frame()?.getAttribute('sandbox') || ''
step('地址栏归一化：裸 host:port 补上 http://', src1 === base + '/ok', src1)
step('输入框回填归一化后的地址', input()?.value === base + '/ok', input()?.value || '')
step('iframe 带沙箱且本机地址额外给 allow-same-origin', /allow-scripts/.test(sb1) && /allow-same-origin/.test(sb1), sb1 || '(无 sandbox 属性)')
step('沙箱令牌不含 allow-top-navigation（页面不能劫持界面）', !/allow-top-navigation/.test(sb1), sb1)
step('可嵌入站点不显示拒绝面板', q('[data-browser-state="blocked"]') === null, '')
step('沙箱状态条为「已启用」', bar()?.getAttribute('data-browser-sandbox') === 'on' && /沙箱已启用/.test(sandboxText()), '')
step('地址写回标签内容（切标签/重开布局保持当前页）', /"url":"http:\/\/127\.0\.0\.1:\d+\/ok"/.test(tabContent()), tabContent())

// ── 3. 四种嵌入拒绝形态 ───────────────────────────────────────────────────────
const blockedCases = [
  ['/blocked', 'X-Frame-Options: DENY'],
  ['/csp', "CSP frame-ancestors 'none'"],
  ['/head405', 'HEAD 回 405（补 GET 才看到 XFO）'],
  ['/headnosignal', 'HEAD 不带信号（补 GET 才看到 XFO）'],
]
for (const [path, why] of blockedCases) {
  await go(base + path, 2000)
  const panel = q('[data-browser-state="blocked"]')
  const title = panel?.querySelector('.dsh-mt_browserBlockedTitle')?.textContent || ''
  step(`拒绝嵌入被识别并说明原因：${why}`, !!panel && /127\.0\.0\.1/.test(title) && frame() === null, title || '(没有面板)')
}
const panelBtns = qa('[data-browser-action="open-external"],[data-browser-action="load-anyway"]').map((e) => e.getAttribute('data-browser-action'))
step('拒绝面板给出两个出口（在浏览器中打开 / 仍然加载）', panelBtns.join(',') === 'open-external,load-anyway', panelBtns.join(','))
btn('load-anyway')?.click(); await sleep(700)
step('点「仍然加载」后保留普通 iframe', !!frame() && frame().getAttribute('src') === base + '/headnosignal', frame()?.getAttribute('src') || '(无 iframe)')

await go(base + '/csp-wild', 2000)
step("CSP frame-ancestors * 视为可嵌入（不误报）", q('[data-browser-state="blocked"]') === null && (frame()?.getAttribute('src') || '') === base + '/csp-wild', frame()?.getAttribute('src') || '')

// ── 4. 危险 scheme 与空输入 ───────────────────────────────────────────────────
const srcBefore = frame()?.getAttribute('src')
await go('javascript:alert(1)', 900)
step('javascript: 被拒并给出明确文案（iframe 不动）', /已阻止/.test(message()) && frame()?.getAttribute('src') === srcBefore, message() || '(无提示)')
await go('   ', 900)
step('空输入提示「无效的网址」', /无效的网址/.test(message()), message() || '(无提示)')

// ── 5. 后退 / 前进 / 刷新 ─────────────────────────────────────────────────────
await go(base + '/ok', 1800)
await go(base + '/csp-wild', 1800)
const beforeBack = frame()?.getAttribute('src')
btn('back').click(); await sleep(1500)
const afterBack = frame()?.getAttribute('src')
step('后退回到上一个地址', afterBack === base + '/ok' && beforeBack === base + '/csp-wild', beforeBack + ' → ' + afterBack)
step('后退后「前进」变为可用', btn('forward').disabled === false, 'disabled=' + btn('forward').disabled)
btn('forward').click(); await sleep(1500)
step('前进回到后一个地址', frame()?.getAttribute('src') === base + '/csp-wild', frame()?.getAttribute('src') || '')
const nodeBefore = frame()
btn('reload').click(); await sleep(1500)
step('刷新重挂 iframe（新节点、地址不变）', frame() !== nodeBefore && frame()?.getAttribute('src') === base + '/csp-wild', '')

// ── 6. 临时解锁 / 恢复沙箱 ───────────────────────────────────────────────────
const sbBefore = frame()?.getAttribute('sandbox')
btn('unlock').click(); await sleep(800)
const offBar = bar()
step('临时解锁：状态条转为「已关闭」并给出危险说明', offBar?.getAttribute('data-browser-sandbox') === 'off' && /沙箱已关闭/.test(sandboxText()) && /dsh-mt_sandboxBarOff/.test(offBar.className), offBar?.className || '')
step('临时解锁：iframe 不再带 sandbox 属性', frame()?.getAttribute('sandbox') === null, String(frame()?.getAttribute('sandbox')))
btn('restore').click(); await sleep(800)
step('恢复沙箱：令牌与状态条都回来', bar()?.getAttribute('data-browser-sandbox') === 'on' && frame()?.getAttribute('sandbox') === sbBefore, String(frame()?.getAttribute('sandbox')))

// ── 7. 夹具侧证据：iframe 真的发出了请求 ──────────────────────────────────────
const hits = await fetch(base + '/hits').then((r) => r.json()).catch(() => null)
const getOk = (hits?.hits ?? []).filter((h) => h.method === 'GET' && h.path === '/ok').length
step('夹具收到 iframe 的真实 GET（≥2：宿主探测一次 + 窗内加载一次）', getOk >= 2, 'GET /ok = ' + getOk)

// ── 8. 折叠态：只留整页（地址栏 / 提示行 / 沙箱条全部让位）──────────────────────
await go(base + '/ok', 2000)
const frameBefore = frame()
const hBefore = frameBefore?.getBoundingClientRect().height ?? 0
step('折叠前：完整模式（地址栏 + 沙箱条 + 整页都在）', mode() === 'full' && !!q('.dsh-mt_browserBar') && !!bar() && !!frameBefore, mode() || 'none')

store.toggleCollapsed('main', 0)
await sleep(1000)
const frameCollapsed = frame()
const hCollapsed = frameCollapsed?.getBoundingClientRect().height ?? 0
step('折叠后：只剩浏览器整页（无地址栏 / 无输入框 / 无沙箱条 / 无提示行）',
  mode() === 'collapsed'
  && q('.dsh-mt_browserBar') === null
  && q('[data-browser-input]') === null
  && q('[data-browser-sandbox]') === null
  && q('[data-browser-message]') === null,
  'mode=' + (mode() || 'none') + ' bar=' + !!q('.dsh-mt_browserBar') + ' sandbox=' + !!q('[data-browser-sandbox]'))
step('折叠后页面还是同一个 iframe（没有重新加载）', frameCollapsed === frameBefore && (frameCollapsed?.getAttribute('src') || '') === base + '/ok', 'sameNode=' + (frameCollapsed === frameBefore))
step('折叠后页面拿到让出来的高度（比折叠前更高）', hCollapsed > hBefore, Math.round(hBefore) + 'px → ' + Math.round(hCollapsed) + 'px')
step('折叠后窗格标题栏与标签栏也隐藏（只剩内容）', q('.dsh-mt_paneBar') === null && q('.dsh-mt_tabBar') === null, '')
const chip = q('[data-pane-chip]')
step('折叠后仍能看到「窗口几」：悬浮窗格名小标在（标题栏与标签栏都不在）',
  !!chip && /窗口\s*\d+/.test(chip.textContent || '') && chip.getBoundingClientRect().height > 0,
  chip ? JSON.stringify(chip.textContent) : '(没有小标)')
step('窗格名小标是只读标签且点击穿透（不挡页面操作）',
  !!chip && getComputedStyle(chip).pointerEvents === 'none' && getComputedStyle(chip).position === 'absolute',
  chip ? ('pointer-events=' + getComputedStyle(chip).pointerEvents + ' position=' + getComputedStyle(chip).position) : '')
step('小标不占布局高度（页面高度仍等于折叠后的高度）',
  Math.abs((frame()?.getBoundingClientRect().height ?? 0) - hCollapsed) < 2,
  Math.round(frame()?.getBoundingClientRect().height ?? 0) + 'px vs ' + Math.round(hCollapsed) + 'px')

// 折叠 + 沙箱临时解锁：危险状态保留一条红色告警，其余仍然不出现
store.toggleCollapsed('main', 0)
await sleep(800)
btn('unlock')?.click()
await sleep(500)
store.toggleCollapsed('main', 0)
await sleep(900)
step('折叠 + 沙箱临时解锁：只多一条红色告警，其余仍然没有', mode() === 'collapsed'
  && q('[data-browser-sandbox="off"]') !== null
  && q('.dsh-mt_browserBar') === null
  && q('[data-browser-input]') === null, 'mode=' + (mode() || 'none') + ' sandbox=' + (bar()?.getAttribute('data-browser-sandbox') ?? 'none'))
btn('restore')?.click()
await sleep(500)
store.toggleCollapsed('main', 0)
await sleep(900)
step('展开后恢复完整模式与沙箱令牌', mode() === 'full' && !!q('.dsh-mt_browserBar') && /allow-scripts/.test(frame()?.getAttribute('sandbox') || ''), mode() || 'none')
step('展开后窗格名小标消失（改由标题栏承担）', q('[data-pane-chip]') === null && q('.dsh-mt_paneBar') !== null, '')

// ── 9. 动画窗：同套图标键 + 折叠只留整页 ─────────────────────────────────────
if (!(await openPane('动画', 'anim-check'))) {
  step('动画窗选择器可用', false, '当前可见窗格里没有「动画」选项')
  return out
}
const animBar = q('.dsh-mt_browserBar')
const animBtn = animBar?.querySelector('.dsh-mt_iconBtn')
step('动画窗地址栏用的是同一套圆形图标键（不是裸按钮）', !!animBtn && animBtn.querySelector('svg') !== null, animBtn ? 'has-icon-button' : '缺图标键')
step('动画窗输入框沿用同一样式（有边框与高度）', !!animBar?.querySelector('.dsh-mt_browserInput'), '')
store.toggleCollapsed('main', 0)
await sleep(900)
step('动画窗折叠后只剩整页（无地址栏、无图标键）', q('[data-anim-mode="collapsed"]') !== null && q('.dsh-mt_browserBar') === null,
  'animMode=' + (q('[data-anim-mode]')?.getAttribute('data-anim-mode') ?? 'none') + ' bar=' + !!q('.dsh-mt_browserBar'))
store.toggleCollapsed('main', 0)
await sleep(700)
step('动画窗展开后地址栏回来', q('.dsh-mt_browserBar') !== null && q('[data-anim-mode="full"]') !== null, '')

// 收尾：回到浏览器窗的「拒绝嵌入」面板这一屏，截图覆盖地址栏 / 沙箱条 / 说明面板
if (await openPane('浏览器', 'browser-shots')) {
  await go(base + '/csp', 1800)
  step('收尾：窗体留在拒绝嵌入面板（截图态）', !!q('[data-browser-state="blocked"]'), '')
}

return out
