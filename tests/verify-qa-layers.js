/**
 * 「文件变动 → 会话镜头」两层结构验收：**一层 = 一次提问 + 最终答复 + 统计**，
 * 层里再按轮（turn）列出这一轮改了哪些文件；最新的一层与最新的一轮都在最上面。
 *
 * 用法：node tests/cdp-probe.mjs <ws> <实例URL> tests/verify-qa-layers.js <png> fresh <args.json>
 *   args：`{ "session": "<有内容的会话 id>" }`——无头浏览器里默认是刚打开的空会话，
 *   要验两层结构得先 `window.__dshOpenSession(id)` 切过去（脚本里已处理）。
 *   会话 id 可直接用 `$env:DSH_SESSION_ID`（当前会话自己就有几十轮数据，最适合当靶子）。
 *
 * 断言：层分组 / 顶部会话统计（轮数 + token 用量）/ 层从新到旧 / 最新层默认展开 /
 *       层头提问摘要 / 层内「用户输入 → 最终输出 → 统计」顺序 / 层里的轮可折叠。
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

// 无头浏览器里默认是「刚打开的空会话」；要验两层结构得先切到有内容的那个会话
if (__probeArgs.session && typeof window.__dshOpenSession === 'function') {
  try { await window.__dshOpenSession(__probeArgs.session) } catch (e) { out.openSessionErr = String(e) }
  await sleep(4000)
}
out.scopeId = window.__dshMytableRef?.currentScope?.()?.sessionId ?? null

store.open({
  id: 'qa-check', title: 't', top: null,
  main: [{ id: 'p1', title: '窗口1', min: 200, content: null, tabs: [], active: 0 }],
  chatWidth: { default: 380, min: 260, max: 700 }, chatSide: 'right', chatFullHeight: true,
})
await sleep(1600)
picked('文件变动')?.click()
await sleep(3000)
qa('[data-chg-lens]').find((b) => b.getAttribute('data-chg-lens') === 'session')?.click()
await sleep(3000)

const layers = qa('[data-chg-qa]')
out.layerCount = layers.length
out.sessionStats = (q('[data-chg-session-stats]')?.textContent ?? '').trim()
step('会话镜头按「层」分组（每层 = 一次提问）', layers.length >= 1, 'layers=' + layers.length)
step('顶部有会话统计（轮数 + token 用量）', /本次会话/.test(out.sessionStats) && /总计/.test(out.sessionStats), out.sessionStats)

const nums = layers.map((el) => Number(el.getAttribute('data-chg-qa')))
step('层从新到旧排列（最上面是最新的）', nums.length >= 1 && nums.every((n, i) => i === 0 || nums[i - 1] > n), nums.slice(0, 8).join(','))
step('最新一层默认展开、更早的默认收起',
  layers[0]?.getAttribute('data-chg-qa-open') === '1' && layers.slice(1).every((el) => el.getAttribute('data-chg-qa-open') === '0'),
  layers.slice(0, 5).map((el) => `${el.getAttribute('data-chg-qa')}:${el.getAttribute('data-chg-qa-open')}`).join(' '))

const first = layers[0]
const ask = (first?.querySelector('[data-chg-qa-ask]')?.textContent ?? '').trim()
const inputText = (q('[data-chg-qa-input]')?.textContent ?? '').trim()
const outputText = (q('[data-chg-qa-output]')?.textContent ?? '').trim()
const statsText = (q('[data-chg-qa-stats]')?.textContent ?? '').trim()
out.firstLayer = { ask, inputText: inputText.slice(0, 80), outputText: outputText.slice(0, 80), statsText }
step('层头显示用户输入摘要', ask.length > 2, ask.slice(0, 60))
step('层内最上面是「用户输入」原文', inputText.startsWith('用户输入') && inputText.length > 8, inputText.slice(0, 70))
step('紧接着是「最终输出」原文', outputText.startsWith('最终输出'), outputText.slice(0, 70))
step('再往下是本层统计（输入/输出/缓存/总计/调用次数）',
  /输入/.test(statsText) && /输出/.test(statsText) && /总计/.test(statsText), statsText.slice(0, 120))

const rounds = first ? [...first.querySelectorAll('[data-chg-turn]')] : []
out.rounds = rounds.map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 70))
step('层里再按「轮」列出（每轮可折叠）', rounds.length >= 1, out.rounds.join(' || ').slice(0, 140))
const opsBefore = qa('[data-chg-op]').length
q('[data-chg-qa-head]')?.click()
await sleep(700)
const opsClosed = qa('[data-chg-op]').length
const closedState = q('[data-chg-qa]')?.getAttribute('data-chg-qa-open')
q('[data-chg-qa-head]')?.click()
await sleep(700)
const opsBack = qa('[data-chg-op]').length
step('点层头能收起 / 再展开（文件操作行跟着变）',
  closedState === '0' && opsClosed < opsBefore && opsBack === opsBefore,
  `before=${opsBefore} closed=${opsClosed} back=${opsBack} state=${closedState}`)
return out
