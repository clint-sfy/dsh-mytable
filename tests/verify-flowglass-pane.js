/**
 * 验收原版 dsh-flowglass 作为 **dsh-mytable 随包内含子插件**运行：
 *   用户无需单独安装 → 工作台注册表出现原版流镜 → 原版 Drawer/流程 DOM 真正挂入窗格。
 *
 * 用法：node tests/cdp-probe.mjs <ws> <实例URL> tests/verify-flowglass-pane.js <png> fresh <args.json>
 *   args：`{ "session": "<有内容的会话 id>" }`（可选；不给我就在当前空会话上验挂载）。
 * 这是「§4.1 开放接口被另一个独立插件包真实接入」的现场证据。
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const out = { steps: [], fail: false }
const step = (name, ok, detail) => { out.steps.push({ name, ok: !!ok, detail }); if (!ok) out.fail = true }
const store = window.__dshWorktable.splitStore
const activeRoot = () => document.querySelector('[data-mt-workspace][data-mt-active="true"]') ?? document
const pane = () => activeRoot().querySelector('.dsh-mt_pane')
const q = (s) => pane()?.querySelector(s) ?? null
const qa = (s) => (pane() ? [...pane().querySelectorAll(s)] : [])

// 无头浏览器默认在「刚打开的空会话」上；给一个有内容的会话才看得到真东西
if (__probeArgs.session && typeof window.__dshOpenSession === 'function') {
  try { await window.__dshOpenSession(__probeArgs.session) } catch (e) { out.openSessionErr = String(e) }
  await sleep(4000)
}

out.registry = (() => {
  const svc = window.__dshMytable
  if (!svc || typeof svc.paneTypes !== 'function') return null
  try { return svc.paneTypes().map((d) => ({ id: d.id, title: typeof d.title === 'function' ? d.title() : d.title })) } catch (e) { return 'ERR ' + String(e) }
})()

store.open({
  id: 'flow-pane', title: 't', top: null,
  main: [{ id: 'p1', title: '窗口1', min: 200, content: null, tabs: [], active: 0 }],
  chatWidth: { default: 380, min: 260, max: 700 }, chatSide: 'right', chatFullHeight: true,
})
await sleep(1800)
const picks = qa('.dsh-mt_panePick').map((b) => (b.textContent || '').trim())
out.picks = picks
step('新建窗口选择器里只有一个「流镜」',
  picks.filter((t) => t.includes('流镜')).length === 1,
  picks.join(' / ').slice(0, 160))

const pick = qa('.dsh-mt_panePick').find((b) => b.getAttribute('data-plugin-pane') === 'dsh-flowglass:flow')
pick?.click()
await sleep(4500)

const scoped = qa('[data-dsh-toolbox-scope]')
const flowNodes = qa('[data-flow]')
const drawerish = qa('.tb-drawer, .tb-flow, .tb-root, .tb-panel, [class*="tb-"]')
const notices = qa('.tb-notice').map((el) => (el.textContent ?? '').trim())
out.mount = {
  paneText: (pane()?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120),
  toolboxScope: scoped.length,
  flowNodes: flowNodes.length,
  tbClasses: [...new Set(drawerish.map((el) => String(el.className).split(' ')[0]))].slice(0, 10),
  notices,
  slotError: document.querySelector('[data-slot-error]')?.getAttribute('data-slot-error') ?? null,
}
step('窗格里渲染的是原版 Flowglass Drawer/流程 DOM',
  (flowNodes.length > 0 || drawerish.length > 0) && out.mount.slotError === null,
  JSON.stringify(out.mount))
step('没有承载失败降级文案',
  !notices.some((text) => text.includes('承载暂不可用') || text.includes('暂不可用')),
  JSON.stringify(notices))
step('原版流镜由随包子插件注册',
  Array.isArray(out.registry) && out.registry.some((item) => item.id === 'dsh-flowglass:flow'),
  JSON.stringify(out.registry))
return out
