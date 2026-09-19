// 窗口重新编号验收：分栏/关闭之后窗口名永远是 窗口1…窗口N（不留编号空洞）
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const out = { steps: [], fail: false }
const step = (name, ok, detail) => { out.steps.push({ name, ok, detail }); if (!ok) out.fail = true }
const store = window.__dshWorktable && window.__dshWorktable.splitStore
step('splitStore 钩子可用', !!store, null)
if (!store) return out

const titles = () => [...document.querySelectorAll('.dsh-mt_paneTitle')].map((e) => e.textContent.trim())
const pane = (t) => ({ id: 'p-' + t, title: t, min: 120, content: null, tabs: [], active: 0 })

store.open({ id: 'probe-renumber', title: 'probe', top: null, main: [pane('窗口1')], chatWidth: { default: 400, min: 260, max: 700 }, chatSide: 'right', chatFullHeight: true })
await sleep(1400)
step('起始：窗口1', JSON.stringify(titles()) === JSON.stringify(['窗口1']), titles().join('/'))

// 向右分栏两次 → 窗口1/2/3
document.querySelector('[data-pane-action="split-right"]').click(); await sleep(800)
document.querySelectorAll('[data-pane-action="split-right"]')[1].click(); await sleep(800)
out.afterSplit = titles()
step('向右分栏两次 → 窗口1 / 窗口2 / 窗口3', JSON.stringify(out.afterSplit) === JSON.stringify(['窗口1', '窗口2', '窗口3']), out.afterSplit.join('/'))

// 向下分栏 → 新排是窗口4
document.querySelector('[data-pane-action="split-down"]').click(); await sleep(900)
out.afterDown = titles()
step('向下分栏 → 新增窗口4（上排 1/2/3，下排 4）', JSON.stringify(out.afterDown) === JSON.stringify(['窗口1', '窗口2', '窗口3', '窗口4']), out.afterDown.join('/'))

// 关掉窗口2 → 后面的自动补位（1/2/3，而不是 1/3/4）
document.querySelectorAll('[data-pane-action="close-pane"]')[1].click(); await sleep(800)
out.afterClose1 = titles()
step('关掉窗口2 → 重编为 窗口1 / 窗口2 / 窗口3（不留空洞）', JSON.stringify(out.afterClose1) === JSON.stringify(['窗口1', '窗口2', '窗口3']), out.afterClose1.join('/'))

// 一直关到只剩一个 → 名字必须是 窗口1
let guard = 0
while (document.querySelectorAll('[data-pane-action="close-pane"]').length > 0 && guard++ < 6) {
  document.querySelector('[data-pane-action="close-pane"]').click()
  await sleep(700)
}
out.last = titles()
step('关到只剩一个 → 名字就是「窗口1」', JSON.stringify(out.last) === JSON.stringify(['窗口1']), out.last.join('/'))
step('只剩一个时无关闭键', document.querySelectorAll('[data-pane-action="close-pane"]').length === 0, null)
store.close(); await sleep(300)
return out
