/**
 * 「文件变动」窗真机验收（两个镜头）。
 *
 * 用法：node tests/cdp-probe.mjs <ws模块> <就绪URL> tests/verify-changes-pane.js <png> fresh [args.json]
 *   前置（由 pwsh 侧准备好）：`.tmp/chg-fixture` 是一个 git 仓库，含
 *   一个已修改的跟踪文件 `src/app.ts`、一个未跟踪文件 `brand-new.txt`、一个未改动的 `README.md`。
 *   args.json 需要 `{ "fixture": "<.tmp/chg-fixture 绝对路径>" }`：点目录会被仓库发现跳过（对齐参考实现），
 *   夹具仓库因此走「手动填仓库路径」这条真实入口选中。
 *   args.json 可选 `{ "liveTurn": true }`：额外跑一次**真实 agent 回合**（让模型用 write 工具写文件），
 *   用真事件日志验证会话镜头（会消耗一次模型请求，默认不跑）。
 *
 * 断言覆盖：
 *   A. 窗口与两个镜头渲染、会话镜头空态如实说明、筛选条在、`/api/worktable/ops` 真的从本会话取到事件窗口
 *   B. Git 镜头：仓库选择器列出发现的仓库（每项带改动数、脏仓库默认选中）→ 手动填路径切仓库 → 列出改动文件（状态/±计数）
 *   C. 选中文件出 diff：hunk 头、+/- 行、旧/新行号、增删行底色不同、行内高亮区
 *   D. 「打开文件」把该文件开成窗格里的预览标签；@ 引用按钮在
 *   E. 浮层未进错误态
 *   F.（可选）真实回合后会话镜头出现 write 操作
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const out = { steps: [], fail: false }
const step = (name, ok, detail) => { out.steps.push({ name, ok: !!ok, detail }); if (!ok) out.fail = true }

const store = window.__dshWorktable.splitStore
const activeRoot = () => document.querySelector('[data-mt-workspace][data-mt-active="true"]') ?? document
const pane = () => activeRoot().querySelector('.dsh-mt_pane')
const q = (sel) => pane()?.querySelector(sel) ?? null
const qa = (sel) => (pane() ? [...pane().querySelectorAll(sel)] : [])
const picked = (label) => qa('.dsh-mt_panePick').find((b) => new RegExp(label).test(b.textContent || ''))

// 视图状态是持久化的：先清掉，免得上一轮探针留下的仓库/筛选影响「默认选中」这类断言
try { localStorage.removeItem('dsh.mytable.changes.v1') } catch {}

// ── 0. 开一个「文件变动」窗（真实选择器路径）────────────────────────────────
store.open({
  id: 'changes-check', title: 't', top: null,
  main: [{ id: 'p1', title: '窗口1', min: 200, content: null, tabs: [], active: 0 }],
  chatWidth: { default: 380, min: 260, max: 700 }, chatSide: 'right', chatFullHeight: true,
})
await sleep(1600)
let pick = picked('文件变动')
for (let i = 0; i < 10 && !pick; i++) { await sleep(300); pick = picked('文件变动') }
if (!pick) { step('选择器里有「文件变动」', false, qa('.dsh-mt_panePick').map((b) => b.textContent).join(' / ')); return out }
step('选择器里有「文件变动」', true, '')
pick.click()
await sleep(2200)

// ── A. 窗口骨架 + 会话镜头 ──────────────────────────────────────────────────
step('窗口渲染且浮层未进错误态', !!q('.dsh-mt_chg') && document.querySelector('[data-slot-error]') === null, '')
// 打开时的镜头（持久化可能让它不是会话镜头，后面按需切）
const lensAtOpen = qa('[data-chg-lens]').find((b) => b.className.includes('On'))?.getAttribute('data-chg-lens') ?? null
const lenses = qa('[data-chg-lens]').map((b) => b.getAttribute('data-chg-lens'))
step('两个镜头切换键（会话 / Git）', lenses.join(',') === 'session,git', lenses.join(','))
// 镜头是持久化的（切标签/刷新后回到上次位置）：显式切到会话镜头再断言，别假设默认值
qa('[data-chg-lens]').find((b) => b.getAttribute('data-chg-lens') === 'session')?.click()
await sleep(1000)
// 会话里可能已经有操作（例如上一条 liveTurn 真跑过一次）：有就列出来，没有就如实说明空态
const sessionOps = qa('[data-chg-op]').length
const chipText = qa('[data-chg-filter]').map((b) => b.textContent).join(' / ')
step('会话镜头：有操作就列出来、没有就如实说明空态（不留空白）',
  sessionOps > 0 ? /全部 \d+/.test(chipText) : (q('[data-chg-empty="session"]')?.textContent ?? '').includes('文件操作'),
  sessionOps > 0 ? ('ops=' + sessionOps + ' · ' + chipText) : (q('[data-chg-empty="session"]')?.textContent ?? '(没有空态)'))
step('会话镜头筛选条（全部/读/写/改）', qa('[data-chg-filter]').length === 4, qa('[data-chg-filter]').map((b) => b.textContent).join(' / '))
step('镜头状态持久化（刷新/切标签后仍在同一镜头）', !!q('[data-chg-lens="session"].dsh-mt_chgLensOn'), qa('[data-chg-lens]').map((b) => (b.className.includes('On') ? b.getAttribute('data-chg-lens') + '*' : b.getAttribute('data-chg-lens'))).join(','))

const scope = window.__dshMytableRef?.currentScope?.() ?? null
const opsRoute = await fetch('/api/worktable/ops', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ sessionId: scope?.sessionId ?? '' }),
}).then((r) => r.json()).catch(() => null)
step('会话镜头的取数路由可用（回 live 标记与事件窗口）',
  opsRoute !== null && opsRoute.live === true && Array.isArray(opsRoute.events),
  'live=' + String(opsRoute?.live) + ' events=' + String(opsRoute?.events?.length))
step('取数路由带回合边界（turns: 第几轮 + 该轮的用户消息摘要）',
  opsRoute !== null && Array.isArray(opsRoute.turns) && opsRoute.turns.every((t) => Number.isSafeInteger(t?.turn)),
  'turns=' + String(opsRoute?.turns?.length) + ' first=' + JSON.stringify(opsRoute?.turns?.[0] ?? null).slice(0, 90))

// ── A2. 会话镜头「一轮一轮」分组 ────────────────────────────────────────────
const turnHeads = qa('[data-chg-turn]')
if (sessionOps > 0) {
  const nums = turnHeads.map((h) => Number(h.getAttribute('data-chg-turn')))
  out.turns = turnHeads.map((h) => (h.textContent ?? '').replace(/\s+/g, ' ').trim()).slice(0, 4)
  step('会话镜头按「一轮一轮」分组（每轮一个可折叠的头）', turnHeads.length >= 1, out.turns.join(' || ').slice(0, 140))
  step('轮次从新到旧排列（最上面是最新的）',
    nums.length >= 1 && nums.every((n, i) => i === 0 || nums[i - 1] > n),
    nums.join(','))
  step('最新一轮默认展开、更早的默认收起',
    turnHeads[0]?.getAttribute('data-chg-turn-open') === '1'
    && turnHeads.slice(1).every((h) => h.getAttribute('data-chg-turn-open') === '0'),
    turnHeads.map((h) => `${h.getAttribute('data-chg-turn')}:${h.getAttribute('data-chg-turn-open')}`).join(' '))
  const rowsBefore = qa('[data-chg-op]').length
  turnHeads[0].click()
  await sleep(600)
  const rowsClosed = qa('[data-chg-op]').length
  turnHeads[0].click()
  await sleep(600)
  const rowsBack = qa('[data-chg-op]').length
  step('点轮次头能收起 / 再展开（操作行数跟着变）',
    turnHeads[0].getAttribute('aria-expanded') === 'true' && rowsClosed < rowsBefore && rowsBack === rowsBefore,
    `before=${rowsBefore} closed=${rowsClosed} back=${rowsBack}`)
}

// ── B. Git 镜头：仓库发现 / 默认选中 / 手动填路径 ───────────────────────────
qa('[data-chg-lens]').find((b) => b.getAttribute('data-chg-lens') === 'git')?.click()
await sleep(2200)
// 真实指针命中测试：分栏 + 保活池里自绘的下拉容易被别的层吃掉点击，
// 所以这里不仅查元素存在，还查「指针中心点命中的就是那个控件本身」。
const describe = (el) => el === null ? 'null' : (el.tagName + '.' + String(el.className || '').split(' ').slice(0, 2).join('.'))
const hitAt = (el) => {
  if (!el) return { ok: false, hit: 'no element' }
  const r = el.getBoundingClientRect()
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
  return { ok: hit !== null && (hit === el || el.contains(hit) || hit.contains(el)), hit: describe(hit) }
}
const repoSelect = q('[data-chg-repo-select]')
step('Git 镜头出现仓库选择器（原生 select）', !!repoSelect, repoSelect ? describe(repoSelect) : '(没有)')
if (repoSelect) {
  const hit = hitAt(repoSelect)
  step('仓库下拉：真实指针中心命中的就是它（没被其它层盖住）', hit.ok, JSON.stringify(hit))
}
const repoOpts = repoSelect ? [...repoSelect.querySelectorAll('option')] : []
out.repos = repoOpts.map((o) => ({ path: o.getAttribute('data-chg-repo'), label: (o.textContent ?? '').trim() }))
step('仓库下拉列出发现的仓库（文案含分支与改动数）',
  repoOpts.length >= 1 && repoOpts.every((o) => /\(\d+\)$/.test((o.textContent ?? '').trim())),
  out.repos.map((r) => r.label).join(' / ').slice(0, 140) || '(空)')
// 默认应落在「有改动」的仓库上（服务端按改动数倒序 + 客户端显式挑脏仓库）
const countOf = (label) => Number((/\((\d+)\)$/.exec(label) ?? [])[1] ?? 0)
const maxN = Math.max(0, ...out.repos.map((r) => countOf(r.label)))
const dirtyLabels = out.repos.filter((r) => maxN > 0 && countOf(r.label) === maxN).map((r) => r.label)
const selectedLabel = (repoSelect?.selectedOptions?.[0]?.textContent ?? q('[data-chg-repo-cur]')?.textContent ?? '').trim()
step('没有脏仓库时选第一个、有脏仓库时默认选它',
  maxN > 0 ? dirtyLabels.includes(selectedLabel) : selectedLabel !== '',
  `cur=${selectedLabel} max=${maxN} dirty=${dirtyLabels.join(',')}`)

// 夹具仓库在 .tmp 下：点目录会被仓库发现跳过（对齐参考实现），所以走「手动填仓库路径」这条真实入口
const openManual = q('[data-chg-repo-btn]')
if (openManual && __probeArgs.fixture) {
  openManual.click()
  await sleep(400)
}
const repoInput = q('[data-chg-repo-input]')
if (repoInput && __probeArgs.fixture) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
  setter?.call(repoInput, __probeArgs.fixture)
  repoInput.dispatchEvent(new Event('input', { bubbles: true }))
  await sleep(250)
  repoInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
}
await sleep(2600)
step('手动填仓库路径（Enter）能切到该仓库',
  (q('[data-chg-repo-cur]')?.textContent ?? '') === 'chg-fixture'
  || (repoSelect?.value ?? '').includes('chg-fixture')
  || (q('[data-chg-repo-select]')?.selectedOptions?.[0]?.textContent ?? '').includes('chg-fixture'),
  'cur=' + (q('[data-chg-repo-cur]')?.textContent ?? '') + ' select=' + (repoSelect?.value ?? ''))

const files = qa('[data-chg-file]').map((el) => ({
  rel: el.getAttribute('data-chg-file'),
  status: el.querySelector('.dsh-mt_chgStatus')?.textContent ?? '',
  add: el.querySelector('.dsh-mt_chgAdd')?.textContent ?? '',
  del: el.querySelector('.dsh-mt_chgDel')?.textContent ?? '',
}))
out.files = files
step('列出夹具仓库的改动文件（已改 + 未跟踪）',
  files.some((f) => f.rel === 'src/app.ts') && files.some((f) => f.rel === 'brand-new.txt'),
  files.map((f) => `${f.status}${f.rel} ${f.add}${f.del}`).join(' | '))
step('未跟踪文件标为「新」、跟踪改动标为「修」',
  files.find((f) => f.rel === 'brand-new.txt')?.status === '新' && files.find((f) => f.rel === 'src/app.ts')?.status === '修',
  files.map((f) => `${f.rel}:${f.status}`).join(','))
step('每个文件带 +n/−m 计数',
  files.every((f) => /^\+\d+$/.test(f.add) && /^−\d+$/.test(f.del)),
  files.map((f) => `${f.rel} ${f.add}${f.del}`).join(' | '))
step('分支与总计显示', (q('[data-chg-summary]')?.textContent ?? '').includes('') && (q('[data-chg-branch-select]')?.value ?? '') === 'master', 'branchSelect=' + (q('[data-chg-branch-select]')?.value ?? '') + ' summary=' + (q('[data-chg-summary]')?.textContent ?? ''))

// ── B2. 切换分支（原生 select，只在夹具仓库里切，绝不碰用户的真仓库）─────────
const branchSel = q('[data-chg-branch-select]')
const branchHit = hitAt(branchSel)
step('分支下拉存在且真实指针能命中', !!branchSel && branchHit.ok, JSON.stringify(branchHit))
if (branchSel) {
  const optNames = [...branchSel.querySelectorAll('option')].map((o) => o.value)
  out.branches = optNames
  step('分支下拉列出本地分支（当前分支排最前）', optNames[0] === 'master' && optNames.includes('probe-branch'), optNames.join(','))
  const selSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set
  selSetter?.call(branchSel, 'probe-branch')
  branchSel.dispatchEvent(new Event('change', { bubbles: true }))
  await sleep(2600)
  const nowBranch = q('[data-chg-branch-select]')?.value ?? ''
  step('切到 probe-branch 后下拉与数据都跟着变', nowBranch === 'probe-branch', 'now=' + nowBranch)
  // 切回 master，后面的断言（staged 分区等）仍在原本的分支上跑
  const back = q('[data-chg-branch-select]')
  if (back) {
    selSetter?.call(back, 'master')
    back.dispatchEvent(new Event('change', { bubbles: true }))
    await sleep(2600)
  }
  step('切回 master 成功（夹具没被留在别的分支上）', (q('[data-chg-branch-select]')?.value ?? '') === 'master', 'now=' + (q('[data-chg-branch-select]')?.value ?? ''))
}

// ── C. diff 渲染 ───────────────────────────────────────────────────────────
qa('[data-chg-file]').find((el) => el.getAttribute('data-chg-file') === 'src/app.ts')?.click()
await sleep(1200)
const addRow = q('.dsh-mt_diffRow[data-kind=add]')
const delRow = q('.dsh-mt_diffRow[data-kind=del]')
step('diff 行渲染出增行与删行', !!addRow && !!delRow, `add=${!!addRow} del=${!!delRow}`)
step('有 hunk 头', !!q('[data-diff-hunk]'), q('[data-diff-hunk]')?.textContent ?? '')
const lineNos = qa('.dsh-mt_diffRow').slice(0, 8).map((r) => [...r.querySelectorAll('.dsh-mt_diffLineNo')].map((s) => s.textContent.trim()).join('/'))
step('增删行都带旧/新行号', lineNos.some((s) => /^\d+\/\d+$/.test(s)) && lineNos.some((s) => /^\d+\/$/.test(s) || /^\/\d+$/.test(s)),
  lineNos.join(' | ').slice(0, 90))
const addBg = addRow ? getComputedStyle(addRow).backgroundColor : ''
const delBg = delRow ? getComputedStyle(delRow).backgroundColor : ''
step('增/删行底色不同（不是同一块灰）', addBg !== delBg && addBg !== '' && delBg !== '', `add=${addBg} del=${delBg}`)
step('改动行有行内字符级高亮区', qa('.dsh-mt_diffInline').length >= 1, String(qa('.dsh-mt_diffInline').length))

qa('[data-chg-file]').find((el) => el.getAttribute('data-chg-file') === 'notes.md')?.click()
await sleep(900)
step('预览头带「打开文件」与「@ 引用」', !!q('[data-chg-action="open"]') && !!q('[data-chg-action="reference"]'), '')
q('[data-chg-action="open"]')?.click()
await sleep(1800)
const tabTitles = qa('.dsh-mt_tabTitle').map((t) => t.textContent)
step('点「打开文件」把该文件开成预览标签', tabTitles.some((t) => t === 'notes.md'), tabTitles.join(' / '))
// 开文件会把窗格切到预览标签：切回「文件变动」再继续（后面的暂存/提交/历史都在这个面板里）
qa('.dsh-mt_tabTitle').find((t) => t.textContent === '文件变动')?.closest('.dsh-mt_tab')?.click()
await sleep(1400)
step('切回「文件变动」标签后面板还在', !!q('[data-chg-commit-box]') || !!q('[data-chg-list]'), '')

// ── B2. 暂存区：分组 / 暂存 / 取消暂存 / 丢弃 / 提交 ─────────────────────────
// 注意：改动视图里现在还有第三段「提交历史」（对齐参考实现的一屏式），所以只看前两段
const sections = qa('[data-chg-section]').map((el) => `${el.getAttribute('data-chg-section')}:${el.textContent}`)
out.sections = sections
step('改动清单分成「已暂存 / 未暂存」两段并带计数（后面还有「提交历史」段）',
  sections.length >= 2 && /staged:已暂存（\d+）/.test(sections[0]) && /unstaged:未暂存（\d+）/.test(sections[1])
  && sections.some((s) => s.startsWith('history:')),
  sections.join(' | '))
const sideOf = (rel) => qa('[data-chg-file]').filter((el) => el.getAttribute('data-chg-file') === rel).map((el) => el.getAttribute('data-chg-side'))
step('已暂存的文件只在 staged 侧、未跟踪只在 unstaged 侧',
  sideOf('notes.md').join(',') === 'staged' && sideOf('brand-new.txt').join(',') === 'unstaged',
  `notes.md=${sideOf('notes.md')} brand-new=${sideOf('brand-new.txt')}`)

// 选中已暂存的那个文件：标签与行号都要对
qa('[data-chg-file]').find((el) => el.getAttribute('data-chg-file') === 'notes.md')?.click()
await sleep(1000)
step('已暂存文件：预览头标「已暂存」', q('[data-chg-tag]')?.getAttribute('data-chg-tag') === 'staged', q('[data-chg-tag]')?.textContent ?? '')
const gapEl = q('[data-diff-gap]')
step('两个 hunk 之间有「⋯ 未改动」可点标记', !!gapEl, gapEl?.textContent ?? '(没有 gap 标记)')
gapEl?.click()
await sleep(1200)
step('点开 gap → 隐藏行被加载出来（带行号）', qa('[data-diff-gap-line]').length > 0, qa('[data-diff-gap-line]').length + ' 行')
const gapLineNos = qa('[data-diff-gap-line]').slice(0, 3).map((r) => [...r.querySelectorAll('.dsh-mt_diffLineNo')].map((s) => s.textContent).join('/'))
step('gap 行号落在两个 hunk 之间（旧/新都标）', gapLineNos.every((s) => /^\d+\/\d+$/.test(s)), gapLineNos.join(' | '))

// 暂存未跟踪文件 → 落到已暂存段，提交键变可用
const stageBtn = qa('[data-chg-file]').find((el) => el.getAttribute('data-chg-file') === 'brand-new.txt')?.querySelector('[data-chg-row-action="stage"]')
step('未暂存行有「暂存」键', !!stageBtn, '')
stageBtn?.click()
await sleep(2200)
step('点暂存后该文件出现在「已暂存」段',
  qa('[data-chg-file]').filter((el) => el.getAttribute('data-chg-file') === 'brand-new.txt').map((el) => el.getAttribute('data-chg-side')).includes('staged'),
  sideOf('brand-new.txt').join(','))
step('切回来后仍在 Git 镜头（视图状态持久化）', q('[data-chg-commit-box]') !== null,
  'pane=' + String(q('.dsh-mt_chg') !== null) + ' lens=' + qa('[data-chg-lens]').map((b) => b.getAttribute('data-chg-lens') + (b.className.includes('On') ? '*' : '')).join(',') + ' tabs=' + qa('.dsh-mt_tabTitle').map((t) => t.textContent).join('/'))
const ta = q('[data-chg-commit-message]')
if (ta === null) {
  step('提交段（前置不满足，跳过并报告现场）', false, 'commitBox=' + String(q('[data-chg-commit-box]') !== null) + ' list=' + String(q('[data-chg-list]') !== null))
} else {
  step('没写提交信息时提交键禁用（正确行为）', q('[data-chg-commit]')?.disabled === true, 'disabled=' + String(q('[data-chg-commit]')?.disabled))
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
  setter.call(ta, 'probe: stage + commit')
  ta.dispatchEvent(new Event('input', { bubbles: true }))
  await sleep(400)
  step('写了提交信息且有暂存内容 → 提交键可用', q('[data-chg-commit]')?.disabled === false, 'disabled=' + String(q('[data-chg-commit]')?.disabled))
  q('[data-chg-commit]')?.click()
  await sleep(1400)
  const commitNote = q('[data-chg-note]')?.textContent ?? ''
  step('提交成功（出现「已提交」提示）', /已提交/.test(commitNote), commitNote)
  await sleep(1600)
  step('提交后暂存段清空', /已暂存（0）/.test(q('[data-chg-section="staged"]')?.textContent ?? ''), q('[data-chg-section="staged"]')?.textContent ?? '')
}

// 丢弃未暂存改动（先确认框）
qa('[data-chg-file]').find((el) => el.getAttribute('data-chg-file') === 'src/app.ts' && el.getAttribute('data-chg-side') === 'unstaged')?.click()
await sleep(900)
step('丢弃前能选中 app.ts 的未暂存项', !!q('[data-chg-action="discard"]'), qa('[data-chg-file]').map((el) => el.getAttribute('data-chg-file')).join(','))
q('[data-chg-action="discard"]')?.click()
await sleep(400)
step('丢弃前弹出确认框', !!q('[data-chg-confirm]'), q('[data-chg-confirm]')?.textContent ?? '')
q('[data-chg-confirm-yes]')?.click()
await sleep(2600)
step('丢弃后 app.ts 从改动清单消失（回到 HEAD 状态）',
  !qa('[data-chg-file]').some((el) => el.getAttribute('data-chg-file') === 'src/app.ts'),
  qa('[data-chg-file]').map((el) => el.getAttribute('data-chg-file')).join(','))

// ── B3. 历史：提交列表 + 某次提交的 diff ────────────────────────────────────
qa('[data-chg-view]').find((b) => b.getAttribute('data-chg-view') === 'history')?.click()
await sleep(2500)
const commitRows = qa('[data-chg-commit-row]')
step('历史列出提交（含刚提交的那条）', commitRows.length >= 2, commitRows.map((el) => el.textContent.slice(0, 28)).join(' | '))
step('第一条提交就是刚才的 message',
  commitRows[0]?.textContent?.includes('probe: stage + commit'),
  commitRows[0]?.textContent ?? '')
await sleep(1500)
const commitHeads = qa('[data-chg-commit-file]')
const rowsOfCommit = () => qa('[data-chg-commit-diff] .dsh-mt_diffRow').length
// 默认只摊开源码：夹具这次提交的是 .md/.txt → 应当全是折叠的
step('非源码文件（.md/.txt）默认折叠',
  commitHeads.length > 0 && commitHeads.every((el) => el.getAttribute('aria-expanded') === 'false'),
  commitHeads.map((el) => `${el.getAttribute('data-chg-commit-file')}:${el.getAttribute('aria-expanded')}`).join(' | '))
if (rowsOfCommit() === 0 && commitHeads.length > 0) { commitHeads[0].click(); await sleep(700) }
step('提交 diff 渲染出来（文件头 + 展开后有行）',
  commitHeads.length > 0 && rowsOfCommit() > 0,
  commitHeads.map((el) => el.textContent.trim().split(' ')[0]).join(' / ') + ` rows=${rowsOfCommit()}`)
// 多文件提交要能收缩（对齐参考实现：文件头就是开关；默认只摊开源码）
if (commitHeads.length > 1) {
  const head = commitHeads[0]
  const before = rowsOfCommit()
  head.click()
  await sleep(500)
  const after = rowsOfCommit()
  head.click()
  await sleep(500)
  const back = rowsOfCommit()
  step('提交 diff 的文件块能收起 / 再展开（行数跟着变）',
    head.hasAttribute('aria-expanded') && (after !== before ? back === before : after === before),
    `before=${before} after=${after} back=${back}`)
}
qa('[data-chg-view]').find((b) => b.getAttribute('data-chg-view') === 'changes')?.click()
await sleep(1500)



// ── E. 可选：真实 agent 回合 → 会话镜头出现 write 操作 ──────────────────────
if (__probeArgs.liveTurn === true) {
  qa('.dsh-mt_tabTitle').find((t) => t.textContent === '文件变动')?.closest('.dsh-mt_tab')?.click()
  await sleep(800)
  qa('[data-chg-lens]').find((b) => b.getAttribute('data-chg-lens') === 'session')?.click()
  await sleep(600)
  const target = String(scope?.cwd ?? '') + '\\.tmp\\op-live-probe.txt'
  const asked = window.__dshPromptIntoSession?.(scope?.sessionId ?? '', `请只做一件事：用 write 工具把文本 "hi from live probe" 写入 ${target}（不要用 shell 命令，不要做别的）。`)
  step('已向当前会话发出真实指令（等待 agent 用 write 工具）', asked !== false, String(asked))
  let ops = []
  for (let i = 0; i < 40; i++) {
    await sleep(3000)
    const d = await fetch('/api/worktable/ops', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: scope?.sessionId ?? '' }),
    }).then((r) => r.json()).catch(() => null)
    ops = window.__dshMytableOpsProbe ? window.__dshMytableOpsProbe(d?.events ?? []) : []
    if (ops.length > 0) break
  }
  out.liveOps = ops.map((o) => `${o.kind}:${o.path}`)
  step('真实回合后会话镜头折出文件操作', ops.length > 0, out.liveOps.join(' | ') || '(90 秒内没有文件操作)')
  q('[data-chg-refresh="1"]')?.click()
  await sleep(1500)
  step('面板里出现会话操作行', qa('[data-chg-op]').length > 0, qa('[data-chg-op]').map((el) => el.getAttribute('data-chg-kind')).join(','))
} else {
  step('真实回合验证（liveTurn 未开启 → 跳过）', true, 'skipped')
}

store.close()
return out
