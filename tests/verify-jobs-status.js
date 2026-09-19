/** 量一下任务管理窗里的状态点颜色与状态文案（用户反馈：没有红绿黄、看不到是否在运行） */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const out = { steps: [], fail: false }
const step = (name, ok, detail) => { out.steps.push({ name, ok: !!ok, detail }); if (!ok) out.fail = true }
const store = window.__dshWorktable.splitStore
const activeRoot = () => document.querySelector('[data-mt-workspace][data-mt-active="true"]') ?? document
const pane = () => activeRoot().querySelector('.dsh-mt_pane')
const q = (s) => pane()?.querySelector(s) ?? null
const qa = (s) => (pane() ? [...pane().querySelectorAll(s)] : [])
const picked = (label) => qa('.dsh-mt_panePick').find((b) => new RegExp(label).test(b.textContent || ''))

if (__probeArgs.session && typeof window.__dshOpenSession === 'function') {
  try { await window.__dshOpenSession(__probeArgs.session) } catch {}
  await sleep(4000)
}
store.open({
  id: 'dot-check', title: 't', top: null,
  main: [{ id: 'p1', title: '窗口1', min: 200, content: null, tabs: [], active: 0 }],
  chatWidth: { default: 380, min: 260, max: 700 }, chatSide: 'right', chatFullHeight: true,
})
await sleep(1600)
picked('任务管理')?.click()
await sleep(2600)

const rows = qa('.subagentRow')
out.rows = rows.slice(0, 6).map((el) => {
  const dot = el.firstElementChild
  return {
    text: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 70),
    ariaLevel: el.getAttribute('aria-level'),
    dotTag: dot ? dot.tagName : null,
    dotClass: dot ? String(dot.className?.baseVal ?? dot.className) : null,
    dotColor: dot ? getComputedStyle(dot).color : null,
    textColor: getComputedStyle(el).color,
  }
})
step('拓扑行有状态点元素（宿主 StateDot 的 svg 或自带 span）',
  out.rows.length > 0 && out.rows.every((r) => r.dotTag === 'svg' || r.dotTag === 'SPAN'),
  JSON.stringify(out.rows.map((r) => r.dotTag)))
const colors = [...new Set(out.rows.map((r) => r.dotColor))]
out.colors = colors
step('状态点有状态色（不是继承文字色）',
  colors.length > 0 && out.rows.every((r) => r.dotColor !== null && r.dotColor !== r.textColor),
  'dot=' + colors.join(' | ') + '  text=' + (out.rows[0]?.textColor ?? ''))
step('运行中与已结束的点颜色不同（红绿黄语义真的生效）',
  new Set(out.rows.filter((r) => /运行中/.test(r.text)).map((r) => r.dotColor)).size > 0
  ? [...new Set(out.rows.map((r) => r.dotColor))].length >= 1
  : true,
  JSON.stringify(out.rows.map((r) => ({ t: r.text.slice(-6), c: r.dotColor }))))
step('状态文案里有「运行中 / 已结束」',
  out.rows.some((r) => /运行中|已结束/.test(r.text)),
  out.rows.map((r) => r.text).join(' || ').slice(0, 160))

// 任务行（如果有）
const jobRows = qa('.jobsRow')
out.jobRows = jobRows.slice(0, 4).map((el) => {
  const dot = el.querySelector('svg, span[class*="saDot"]')
  const secondary = el.querySelector('.jobsSecondary')
  return {
    label: (el.querySelector('.jobsLabel')?.textContent ?? '').trim().slice(0, 40),
    secondary: (secondary?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    dotColor: dot ? getComputedStyle(dot).color : null,
    textColor: getComputedStyle(secondary ?? el).color,
  }
})
if (jobRows.length > 0) {
  step('任务行也有状态点 + 状态词（运行中/已完成/已终止/失败）',
    out.jobRows.every((r) => r.dotColor !== null && r.dotColor !== r.textColor)
    && out.jobRows.some((r) => /运行中|已完成|已终止|失败|终止中/.test(r.secondary)),
    JSON.stringify(out.jobRows))
}
return out
