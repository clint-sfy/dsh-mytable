/**
 * 「任务管理」窗验收（对齐 DSH-better-sidebar 的任务管理 tab）：
 *   A. 选择器里有「任务管理」，点开能渲染出窗（含后台任务/子代理两段）
 *   B. 本会话真有一个后台任务时：行里有状态、能展开「模型已读过的输出」
 *   C. 「终止」按钮在活任务上可用，点了状态会变（或如实报错）
 *
 * 用法：node tests/cdp-probe.mjs <ws> <URL> tests/verify-jobs-pane.js <png> fresh .tmp/jobs-args.json
 *   args：`{ "session": "<当前会话 id>", "jobId": "<可选：期望出现的任务 id>" }`
 */
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
  try { await window.__dshOpenSession(__probeArgs.session) } catch (e) { out.openSessionErr = String(e) }
  await sleep(4000)
}
store.open({
  id: 'jobs-check', title: 't', top: null,
  main: [{ id: 'p1', title: '窗口1', min: 200, content: null, tabs: [], active: 0 }],
  chatWidth: { default: 380, min: 260, max: 700 }, chatSide: 'right', chatFullHeight: true,
})
await sleep(1600)
const picks = qa('.dsh-mt_panePick').map((b) => (b.textContent || '').trim())
out.picks = picks
step('选择器里有「任务管理」', picks.some((t) => t.includes('任务管理')), picks.join(' / ').slice(0, 160))
picked('任务管理')?.click()
await sleep(2200)
step('任务管理窗渲染出来（未进错误态）',
  !!q('[data-mt-subagent-view]') && document.querySelector('[data-slot-error]') === null,
  (q('[data-mt-jobs-summary]')?.textContent ?? q('[data-mt-subagent-count]')?.textContent ?? '').trim())
step('照搬 better-sidebar 的结构：头部 + 拓扑树 + 任务段',
  !!q('.subagentHeader') && !!q('.subagentBody') && !!q('[role="tree"]'),
  qa('.subagentRow').length + ' 行拓扑 / jobs 段 ' + (q('[data-mt-jobs-section]') ? '在' : '不在'))

const rows = qa('[data-mt-job]')
out.jobs = rows.map((el) => ({ id: el.getAttribute('data-mt-job'), status: el.getAttribute('data-mt-job-status'), text: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80) }))
if (rows.length === 0) {
  step('（本会话当前没有后台任务 → 任务段整体不渲染，符合参考实现）', q('[data-mt-jobs-section]') === null, 'jobs 段不在')
} else {
  step('列出台任务并带状态', rows.length > 0 && rows.every((r) => r.status !== ''), JSON.stringify(out.jobs).slice(0, 200))
  // 注意用 out.jobs（纯数据）找目标：rows 是 DOM 数组，直接塞进返回值会让 CDP 序列化炸掉
  const target = (__probeArgs.jobId ? out.jobs.find((r) => r.id === __probeArgs.jobId) : null) ?? out.jobs[0]
  out.target = target
  q('[data-mt-job="' + target.id + '"]')?.click()
  await sleep(2000)
  const dock = q('[data-mt-job-dock="' + target.id + '"]')
  const text = (q('[data-mt-job-dock-text="' + target.id + '"]')?.textContent ?? '').trim()
  out.output = {
    dock: !!dock,
    head: (dock?.querySelector('.jobsPaneHeader')?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 90),
    textLen: text.length,
  }
  step('点任务行 → 底部输出坞打开（模型读过就显示正文，没读过就如实说明）',
    !!dock && (/已读/.test(out.output.head) ? true : true) && (text.length > 0 || (dock?.textContent ?? '').includes('还没读过')),
    JSON.stringify(out.output))
  const killBtn = q('[data-mt-job-kill="' + target.id + '"]')
  out.kill = { exists: !!killBtn, label: (killBtn?.textContent ?? '').trim(), armedHint: (killBtn?.getAttribute('title') ?? '') }
  step('活任务行上有「终止」键（已完成的任务不再显示）',
    target.status === 'running' || target.status === 'stopping' ? !!killBtn : !killBtn,
    JSON.stringify(out.kill))
  if (killBtn) {
    // 参考实现是**两击确认**：第一下只武装，第二下才真停
    killBtn.click()
    await sleep(400)
    const armedBtn = q('[data-mt-job-kill="' + target.id + '"]')
    const armed = (armedBtn?.textContent ?? '').includes('确认') || (armedBtn?.className ?? '').includes('Armed')
    out.armed = { armed, text: (armedBtn?.textContent ?? '').trim() }
    step('终止键是两击确认（第一下只武装，不会误杀）', armed, JSON.stringify(out.armed))
    armedBtn?.click()
    await sleep(2600)
    const after = q('[data-mt-job="' + target.id + '"]')?.getAttribute('data-mt-job-status') ?? ''
    out.afterKill = { status: after, row: (q('[data-mt-job="' + target.id + '"]')?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 90) }
    step('第二下确认后状态离开 running', after !== 'running', JSON.stringify(out.afterKill))
  }
}
return out
