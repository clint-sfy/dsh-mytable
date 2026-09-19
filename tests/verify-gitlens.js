/**
 * 聚焦探针：Git 镜头能不能「看见仓库」——用一个跑着新代码的实例 + 真实工作区目录，
 * 只验仓库发现 / 默认选中 / 手动填路径 / 列出改动文件（不依赖会话镜头，因此在没有活跃会话的实例上也能跑）。
 *
 * 用法：node tests/cdp-probe.mjs <ws> <实例URL> tests/verify-gitlens.js <png> fresh .tmp/chg-args.json
 *   args：`{ "fixture": "<.tmp/chg-fixture 绝对路径>" }`（由 tests/prepare-changes-fixture.ps1 准备）。
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
/** 真实指针命中测试：查「指针中心点命中的元素」是不是这个控件（能抓到被遮罩/浮层吃掉点击） */
const hitAt = (el) => {
  if (!el) return { ok: false, hit: 'no element' }
  const r = el.getBoundingClientRect()
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
  return { ok: hit !== null && (hit === el || el.contains(hit) || hit.contains(el)), hit: hit === null ? 'null' : hit.tagName + '.' + String(hit.className || '').split(' ')[0] }
}
const setSelect = (el, value) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('change', { bubbles: true }))
}
/** 控件是否整个落在窗格盒子内：窄窗格里头部溢出会让指针落点变成旁边的宿主元素（真机踩过） */
const inPane = (el) => {
  const box = pane()?.getBoundingClientRect()
  if (!el || !box) return { ok: false, reason: 'no element/box' }
  const r = el.getBoundingClientRect()
  const ok = r.left >= box.left - 1 && r.right <= box.right + 1 && r.top >= box.top - 1 && r.bottom <= box.bottom + 1
  return { ok, self: `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`, pane: `${Math.round(box.left)},${Math.round(box.top)} ${Math.round(box.width)}x${Math.round(box.height)}` }
}

// 视图状态是持久化的（切标签/刷新后回到原位）：先清掉，否则「默认选中哪个仓库」这类断言
// 会被上一轮探针留下的选择污染（实测踩过：留下 DSH-better-sidebar 后默认断言必挂）
try { localStorage.removeItem('dsh.mytable.changes.v1') } catch {}

store.open({
  id: 'gitlens-check', title: 't', top: null,
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
step('浮层未进错误态', document.querySelector('[data-slot-error]') === null, String(document.querySelector('[data-slot-error]')?.getAttribute('data-slot-error') ?? ''))

qa('[data-chg-lens]').find((b) => b.getAttribute('data-chg-lens') === 'git')?.click()
await sleep(2400)
const repoSelect = q('[data-chg-repo-select]')
step('Git 镜头出现仓库下拉（原生 select）', !!repoSelect, repoSelect ? 'select' : '(没有)')
if (repoSelect) {
  const hit = hitAt(repoSelect)
  const inside = inPane(repoSelect)
  step('仓库下拉：整个落在窗格内、真实指针中心命中的就是它', hit.ok && inside.ok, JSON.stringify({ hit, inside }))
}
const repoOpts = repoSelect ? [...repoSelect.querySelectorAll('option')] : []
out.repos = repoOpts.map((o) => ({ path: o.getAttribute('data-chg-repo'), label: (o.textContent ?? '').trim() }))
step('仓库下拉非空且每项带「分支 · 名字（改动数）」',
  repoOpts.length >= 1 && repoOpts.every((o) => /\(\d+\)$/.test((o.textContent ?? '').trim())),
  out.repos.map((r) => r.label).join(' / ') || '(空)')
const countOf = (label) => Number((/\((\d+)\)$/.exec(label) ?? [])[1] ?? 0)
const maxN = Math.max(0, ...out.repos.map((r) => countOf(r.label)))
const dirty = out.repos.filter((r) => maxN > 0 && countOf(r.label) === maxN).map((r) => r.label)
const selectedLabel = (repoSelect?.selectedOptions?.[0]?.textContent ?? q('[data-chg-repo-cur]')?.textContent ?? '').trim()
step('默认选中「有改动」的仓库（没有脏仓库就选第一个）',
  maxN > 0 ? dirty.includes(selectedLabel) : selectedLabel !== '',
  `cur=${selectedLabel} max=${maxN} dirty=${dirty.join(',')}`)

// 工作区干净时也要能看历史（用户的原话：「工作区都很干净」→ 那也该看到提交记录）：
// 切到一个干净仓库，断言改动视图里直接就有「提交历史」段、行里带作者，点一条能出该提交的 diff
if (repoSelect) {
  const clean = out.repos.find((r) => /\(0\)$/.test(r.label))
  if (clean) {
    setSelect(repoSelect, clean.path)
    await sleep(3000)
    const rows = qa('[data-chg-commit-row]').map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim())
    out.cleanRepoRows = rows.slice(0, 3)
    const section = q('[data-chg-section="history"]')
    step('干净工作区的 Git 镜头里直接有「提交历史」段（不用切子视图）',
      !!section && rows.length > 0,
      `section="${(section?.textContent ?? '').trim()}" rows=${rows.length} first="${rows[0] ?? ''}"`)
    step('提交行两行式且带作者（别人的提交也看得出是谁的）',
      rows.length > 0 && rows.every((t) => t.includes('·')),
      rows.slice(0, 2).join(' || '))
    qa('[data-chg-commit-row]')[0]?.click()
    await sleep(2800)
    const heads = qa('[data-chg-commit-file]')
    const files = heads.map((el) => el.getAttribute('data-chg-commit-file'))
    out.cleanCommitDiff = { preview: q('[data-chg-preview]')?.getAttribute('data-chg-preview') ?? '', files: files.slice(0, 6), rows: qa('.dsh-mt_diffRow').length }
    step('点提交行能看到该提交的 diff（改动视图里也能）',
      out.cleanCommitDiff.preview === 'commit' && files.length > 0,
      JSON.stringify(out.cleanCommitDiff))
    // 多文件提交要能收缩：每块一个开关（aria-expanded），默认只有源码摊开
    if (heads.length > 1) {
      const collapsed = heads.filter((el) => el.getAttribute('aria-expanded') === 'false')
      out.foldState = heads.map((el) => `${el.getAttribute('data-chg-commit-file')}:${el.getAttribute('aria-expanded') ?? 'none'}`).slice(0, 8)
      step('多文件提交里每块都可折叠，且默认只摊开源码（其余是 aria-expanded=false）',
        heads.every((el) => el.hasAttribute('aria-expanded') || el.disabled)
        && (collapsed.length > 0 || heads.every((el) => el.getAttribute('aria-expanded') === 'true')),
        out.foldState.join(' | '))
      const firstOpen = heads.find((el) => el.getAttribute('aria-expanded') === 'true')
      const target = firstOpen ?? heads[0]
      const beforeRows = qa('.dsh-mt_diffRow').length
      target.click()
      await sleep(600)
      const afterRows = qa('.dsh-mt_diffRow').length
      const nowState = target.getAttribute('aria-expanded')
      target.click()
      await sleep(600)
      const backRows = qa('.dsh-mt_diffRow').length
      out.foldToggle = { beforeRows, afterRows, backRows, state: nowState, file: target.getAttribute('data-chg-commit-file') }
      step('点文件头能收起 / 再点展开（行数跟着变）',
        afterRows < beforeRows ? backRows === beforeRows : afterRows === beforeRows,
        JSON.stringify(out.foldToggle))
      const collapseAll = q('[data-chg-commit-collapse-all]')
      if (collapseAll) {
        collapseAll.click()
        await sleep(600)
        const allCollapsed = qa('[data-chg-commit-file]').every((el) => el.getAttribute('aria-expanded') === 'false' || el.disabled)
        step('「全部折叠」一键收起所有文件', allCollapsed && qa('.dsh-mt_diffRow').length === 0, 'rows=' + String(qa('.dsh-mt_diffRow').length))
      }
    }
  }
}

// 夹具仓库在 .tmp 下：点目录会被仓库发现跳过（对齐参考实现），所以走「手动填仓库路径」这条真实入口
q('[data-chg-repo-btn]')?.click()
await sleep(400)
const repoInput = q('[data-chg-repo-input]')
if (repoInput && __probeArgs.fixture) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
  setter?.call(repoInput, __probeArgs.fixture)
  repoInput.dispatchEvent(new Event('input', { bubbles: true }))
  await sleep(250)
  repoInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
}
await sleep(2600)
const curLabel = (q('[data-chg-repo-select]')?.selectedOptions?.[0]?.textContent ?? q('[data-chg-repo-cur]')?.textContent ?? '').trim()
step('手动填仓库路径（Enter）能切到夹具仓库', curLabel.includes('chg-fixture'), 'cur=' + curLabel)
const files = qa('[data-chg-file]').map((el) => `${el.querySelector('.dsh-mt_chgStatus')?.textContent ?? ''}${el.getAttribute('data-chg-file')}`)
out.files = files
step('夹具仓库里列出改动文件', files.length >= 2 && files.some((f) => f.includes('src/app.ts')), files.join(' | '))

// 分支下拉：能列出本地分支，并且真的切得动（只在夹具仓库里切）
const branchSel = q('[data-chg-branch-select]')
out.branches = branchSel ? [...branchSel.querySelectorAll('option')].map((o) => o.value) : []
step('分支下拉存在、可命中、列出本地分支（当前分支排最前）',
  !!branchSel && hitAt(branchSel).ok && inPane(branchSel).ok && out.branches.includes('master') && out.branches.includes('probe-branch') && out.branches[0] === branchSel.value,
  JSON.stringify({ hit: branchSel ? hitAt(branchSel) : null, inside: branchSel ? inPane(branchSel) : null, branches: out.branches, value: branchSel?.value ?? '' }))
if (branchSel) {
  setSelect(branchSel, 'probe-branch')
  await sleep(2600)
  const now = q('[data-chg-branch-select]')?.value ?? ''
  step('切到 probe-branch 真的生效', now === 'probe-branch', 'now=' + now)
  const back = q('[data-chg-branch-select]')
  if (back) { setSelect(back, 'master'); await sleep(2600) }
  const restored = q('[data-chg-branch-select]')?.value ?? ''
  step('切回 master 恢复原状（夹具没被留在别的分支）', restored === 'master', 'now=' + restored)
}
return out
