/**
 * 「文件变动 → 会话镜头」互动验收：
 *   A. 点层里的「用户输入 / 最终输出」块 → 右侧预览区按行显示那段原文
 *   B. 筛选条里的「输入输出」把列表切成「只看问答」
 *
 * 用法：node tests/cdp-probe.mjs <ws> <实例URL> tests/verify-qa-click.js <png> fresh <args.json>
 *   args：`{ "session": "<有内容的会话 id>" }`（脚本会自己 __dshOpenSession 切过去）
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

try { localStorage.removeItem('dsh.mytable.changes.v1') } catch {}
if (__probeArgs.session && typeof window.__dshOpenSession === 'function') {
  try { await window.__dshOpenSession(__probeArgs.session) } catch (e) { out.openSessionErr = String(e) }
  await sleep(4000)
}
store.open({
  id: 'qa-click', title: 't', top: null,
  main: [{ id: 'p1', title: '窗口1', min: 200, content: null, tabs: [], active: 0 }],
  chatWidth: { default: 380, min: 260, max: 700 }, chatSide: 'right', chatFullHeight: true,
})
await sleep(1600)
picked('文件变动')?.click()
await sleep(3000)
qa('[data-chg-lens]').find((b) => b.getAttribute('data-chg-lens') === 'session')?.click()
await sleep(3000)

// ── A. 点「用户输入」→ 右侧按行预览 ─────────────────────────────────────────
const inputBlock = q('[data-chg-qa-input]')
step('层里的「用户输入」是一整块可点的按钮', inputBlock?.tagName === 'BUTTON', String(inputBlock?.tagName ?? '(没有)'))
inputBlock?.click()
await sleep(1200)
const msgPreview = q('[data-chg-preview="msg"]')
const body = q('[data-chg-msg-body="input"]')
const rows = qa('[data-chg-msg-body="input"] .dsh-mt_diffRow')
out.inputPreview = { preview: !!msgPreview, rows: rows.length, first: (rows[0]?.textContent ?? '').trim().slice(0, 40), tag: (q('[data-chg-msg-preview]')?.textContent ?? '').trim() }
step('点「用户输入」→ 右侧切到对话预览并按行显示原文',
  !!msgPreview && rows.length > 0 && body !== null,
  JSON.stringify(out.inputPreview))

const outputBlock = q('[data-chg-qa-output]')
outputBlock?.click()
await sleep(1200)
const outRows = qa('[data-chg-msg-body="output"] .dsh-mt_diffRow')
out.outputPreview = { rows: outRows.length, first: (outRows[0]?.textContent ?? '').trim().slice(0, 40) }
step('点「最终输出」→ 右侧换成输出原文（行号从 1 开始）',
  outRows.length > 0 && (outRows[0]?.querySelector('.dsh-mt_diffLineNo')?.textContent ?? '') === '1',
  JSON.stringify(out.outputPreview))

// 再点一条文件操作 → 预览切回 diff（互斥关系正确）
const opRow = qa('[data-chg-op]')[0]
opRow?.click()
await sleep(1400)
out.backToOp = { preview: q('[data-chg-preview]')?.getAttribute('data-chg-preview') ?? '', diffRows: qa('.dsh-mt_diffRow').length }
step('再点文件操作行 → 预览切回 diff（两种预览互斥）',
  out.backToOp.preview !== 'msg' && out.backToOp.diffRows > 0,
  JSON.stringify(out.backToOp))

// ── B. 筛选：输入输出 ──────────────────────────────────────────────────────
const ioChip = q('[data-chg-filter="io"]')
step('筛选条里有「输入输出」一项', !!ioChip, (ioChip?.textContent ?? '').trim())
ioChip?.click()
await sleep(1600)
const layers = qa('[data-chg-qa]')
const opsShown = qa('[data-chg-op]').length
out.ioFilter = { chip: (q('[data-chg-filter="io"]')?.textContent ?? '').trim(), layers: layers.length, ops: opsShown, msgs: qa('[data-chg-qa-input]').length }
step('「输入输出」筛选下只剩问答层（不再铺文件操作行）',
  layers.length > 0 && opsShown === 0 && qa('[data-chg-qa-input]').length > 0,
  JSON.stringify(out.ioFilter))
// 这一档是拿来「读问答」的：每层都要有真实的提问/答复文本（曾经的 bug：层号取错源 → 整屏 0 轮、没记录到用户输入）
const texts = qa('[data-chg-qa-input]').map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim())
const emptyOnes = texts.filter((t) => t.includes('没记录到用户输入') || t.replace('用户输入', '').trim() === '')
out.ioData = { rendered: texts.length, empty: emptyOnes.length, sample: texts[0]?.slice(0, 60) ?? '' }
step('「输入输出」下每层都有真实的问答文本（不是「没记录到用户输入」）',
  texts.length > 0 && emptyOnes.length === 0,
  JSON.stringify(out.ioData))
step('「输入输出」下所有层默认展开（直接读，不用逐层点开）',
  layers.length > 0 && layers.every((el) => el.getAttribute('data-chg-qa-open') === '1'),
  layers.slice(0, 5).map((el) => el.getAttribute('data-chg-qa-open')).join(','))
step('「输入输出」这一项按下去是高亮态（和其它筛选项同一套样式）',
  (q('[data-chg-filter="io"]')?.className ?? '').includes('dsh-mt_chgChipOn'),
  q('[data-chg-filter="io"]')?.className ?? '')
// 切回「全部」
q('[data-chg-filter="all"]')?.click()
await sleep(1600)
out.backToAll = { ops: qa('[data-chg-op]').length }
step('切回「全部」→ 文件操作行回来', out.backToAll.ops > 0, JSON.stringify(out.backToAll))
return out
