// 分栏与关闭窗口验收（真实宿主）：向右分栏 / 向下分栏 / 关闭窗口（至少留一个）
// 用法：node tests/cdp-probe.mjs <ws> <url> tests/verify-pane-split.js [png] fresh
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const out = { steps: [], fail: false }
const step = (name, ok, detail) => { out.steps.push({ name, ok, detail }); if (!ok) out.fail = true }

const store = window.__dshWorktable && window.__dshWorktable.splitStore
step('splitStore 钩子可用', !!store, null)
if (!store) return out

const panes = () => [...document.querySelectorAll('.dsh-mt_pane')]
const rects = () => panes().map((el) => {
  const r = el.getBoundingClientRect()
  return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }
})
const actionBtn = (kind, n = 0) => [...document.querySelectorAll('[data-pane-action="' + kind + '"]')][n]
const emptyPane = (title) => ({ id: 'p-' + title, title, min: 120, content: null, tabs: [], active: 0 })

// 打开一个只有 1 个窗口的布局（=用户「窗口1」的状态）
store.open({ id: 'probe-split', title: 'probe', top: null, main: [emptyPane('窗1')], chatWidth: { default: 420, min: 260, max: 900 } })
await sleep(1500)
step('起始：1 个窗口', panes().length === 1, JSON.stringify(rects()))
// 只剩一个窗口时不该有「关闭窗口」按钮
step('只剩一个窗口时无「关闭窗口」按钮', !actionBtn('close-pane'), String(document.querySelectorAll('[data-pane-action="close-pane"]').length))
step('窗口工具栏有「向右分栏」「向下分栏」', !!actionBtn('split-right') && !!actionBtn('split-down'), null)

// ── 向右分栏（点真实按钮）────────────────────────────────────────────
const r1 = rects()[0]
actionBtn('split-right').click()
await sleep(900)
const after1 = rects()
step('向右分栏 → 2 个窗口', after1.length === 2, JSON.stringify(after1))
step('新窗口在原窗口右侧、同排（y 相同、x 变大、宽度各占一半，差值为分隔条间隙）',
  after1.length === 2 && after1[1].y === after1[0].y && after1[1].x > after1[0].x && Math.abs(after1[1].w - after1[0].w) <= 6,
  `r1.w=${r1.w} → ${after1.map((r) => r.w).join('/')}`)
step('新窗口空 → 显示「新建窗口选择器」', document.querySelectorAll('.dsh-mt_panePick').length > 0, String(document.querySelectorAll('.dsh-mt_panePick').length))

// 再向右分栏一次（第 2 个窗口）
actionBtn('split-right', 1).click()
await sleep(900)
const after2 = rects()
step('对第 2 个窗口再向右分栏 → 3 个窗口且同一排', after2.length === 3 && after2.every((r) => r.y === after2[0].y), JSON.stringify(after2))
step('只切开被点的那个窗口（第 1 个宽度不变，被切的那个约一分为二）',
  Math.abs(after2[0].w - after1[0].w) <= 2 && Math.abs(after2[1].w - after1[1].w / 2) <= 6,
  `${after1.map((r) => r.w).join('/')} → ${after2.map((r) => r.w).join('/')}`)

// ── 向下分栏（新增一排）──────────────────────────────────────────────
step('两排上限未到时「向下分栏」可用', !actionBtn('split-down').disabled, null)
actionBtn('split-down').click()
await sleep(1000)
const after3 = rects()
const rowsByY = [...new Set(after3.map((r) => r.y))]
step('向下分栏 → 4 个窗口、2 排', after3.length === 4 && rowsByY.length === 2, JSON.stringify(after3))
step('新排在上排下方且高度约一半', after3.length === 4
  && after3[3].y > after3[0].y
  && Math.abs(after3[3].h - after3[0].h) <= Math.max(6, after3[0].h * 0.2),
  `上排 h=${after3[0].h} 下排 h=${after3[3].h} y=${after3[0].y}/${after3[3].y}`)
step('两排之后「向下分栏」仍可用（行列表模型无上限）', actionBtn('split-down').disabled === false, actionBtn('split-down').getAttribute('title'))
actionBtn('split-down').click(); await sleep(1100)
const after4 = rects()
const rowsY4 = [...new Set(after4.map((r) => r.y))]
out.rows3 = after4.map((r) => `${r.x},${r.y} ${r.w}x${r.h}`)
step('再向下分栏 → 3 排、5 个窗口', rowsY4.length === 3 && after4.length === 5, JSON.stringify(after4))
step('三排都在左侧内容区（x 相同、宽度一致）', after4.every((r) => r.x === after4[0].x), out.rows3.join(' | '))
actionBtn('split-down').click(); await sleep(1100)
const after5 = rects()
const rowsY5 = [...new Set(after5.map((r) => r.y))]
step('第四次向下 → 4 排（无排数上限）', rowsY5.length === 4, `排数=${rowsY5.length} 窗口数=${after5.length}`)
step('各排高度之和 ≈ 内容区高度', (() => {
  const per = {}
  for (const r of after5) per[r.y] = r.h
  const sum = Object.values(per).reduce((a, b) => a + b, 0)
  const total = after5.reduce((a, r) => Math.max(a, r.y + r.h), 0) - Math.min(...after5.map((r) => r.y))
  return Math.abs(sum - total) <= 12
})(), JSON.stringify(after5.map((r) => `${r.y}:${r.h}`)))
  actionBtn('split-down').getAttribute('title'))

// ── 关闭窗口：至少留一个 ──────────────────────────────────────────────
step('多个窗口时每个窗口都有「关闭窗口」', document.querySelectorAll('[data-pane-action="close-pane"]').length === 4,
  String(document.querySelectorAll('[data-pane-action="close-pane"]').length))
actionBtn('close-pane').click()
await sleep(800)
step('关闭一个窗口 → 3 个', panes().length === 3, String(panes().length))
actionBtn('close-pane').click()
await sleep(800)
actionBtn('close-pane').click()
await sleep(800)
const last = rects()
step('连续关闭 → 只剩 1 个窗口', last.length === 1, JSON.stringify(last))
step('只剩 1 个窗口时「关闭窗口」按钮消失（关不掉最后一个）',
  !actionBtn('close-pane') && document.querySelectorAll('[data-pane-action="close-pane"]').length === 0,
  String(document.querySelectorAll('[data-pane-action="close-pane"]').length))
// 兜底：即使直接调 API 也不能清空
const before = panes().length
store.closePane('main', 0)
await sleep(500)
step('直接调 closePane 也不会删掉最后一个窗口', panes().length === before && before === 1, String(panes().length))
step('最后一个窗口仍可用（选择器在位）', document.querySelectorAll('.dsh-mt_panePick').length > 0, String(document.querySelectorAll('.dsh-mt_panePick').length))

// 收尾
store.close()
await sleep(300)
return out
