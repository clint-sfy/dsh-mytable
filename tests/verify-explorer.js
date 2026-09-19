/**
 * 资源管理器真机验收（真实宿主 + headless 页；写法与样式对齐 DSH-better-sidebar 的文件树）。
 *
 * 用法：node tests/cdp-probe.mjs <ws模块> <就绪URL> tests/verify-explorer.js <png> fresh
 *
 * 两个前提（探针自己搞定）：
 *   1. 查询必须限定在**当前激活工作区**（保活池里其它布局是 visibility:hidden，会命中旧元素造成假失败）；
 *   2. `@` 引用把内容插进**会话草稿**，所以先点「新会话」建一个真实会话（没有会话就没有作用域），
 *      并直接用 `window.__dshMytableRef` 读/清草稿原文——这台宿主的编排器是 contenteditable 富文本，
 *      不是 textarea，读 DOM 值不可靠，草稿原文才是权威证据。
 *
 * 断言覆盖：树与行视觉（34px / 圆角 8 / 目录加粗 / 隐藏项变淡）、宿主官方图标、根行、展开缩进、
 * 键盘 ↑↓ 焦点、悬停才出现的 `@` 胶囊（点它 → 草稿里真的多出 `@相对路径`）、右键菜单项与「引用到对话」、
 * 搜索框（防抖 → 命中数 → 点结果开预览）、预览头（文件名 / 相对路径 / 复制 / @）。
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const out = { steps: [], fail: false }
const step = (name, ok, detail) => { out.steps.push({ name, ok: !!ok, detail }); if (!ok) out.fail = true }

const store = window.__dshWorktable.splitStore
const hook = () => window.__dshMytableRef
const activeRoot = () => document.querySelector('[data-mt-workspace][data-mt-active="true"]') ?? document
const pane = () => activeRoot().querySelector('.dsh-mt_pane')
const q = (sel) => pane()?.querySelector(sel) ?? null
const qa = (sel) => (pane() ? [...pane().querySelectorAll(sel)] : [])
const rows = () => qa('[data-ex-path]').filter((el) => el.getAttribute('data-ex-root-row') !== '1')
const rowByName = (name) => rows().find((el) => (el.querySelector('.dsh-mt_exName')?.textContent ?? '') === name)
const draft = () => hook()?.readDraft?.() ?? ''
const clearDraft = () => { hook()?.clearDraft?.() }
const setInput = (el, v) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  setter.call(el, v)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

// ── 0. 先建会话（@ 引用需要一个会话作用域）────────────────────────────────────
const newBtn = [...document.querySelectorAll('button')].find((b) => /新会话|New session/.test(b.textContent || ''))
newBtn?.click()
await sleep(4000)
const scope = hook()?.currentScope?.() ?? null
step('建立会话（@ 引用的作用域来自当前会话）', !!scope, JSON.stringify(scope))
step('调试出口可用（读草稿原文 / 清草稿）', typeof hook()?.readDraft === 'function' && typeof hook()?.clearDraft === 'function', '')

// ── 1. 开一个资源管理器窗（走真实选择器路径）────────────────────────────────
store.open({
  id: 'explorer-check', title: 't', top: null,
  main: [{ id: 'p1', title: '窗口1', min: 200, content: null, tabs: [], active: 0 }],
  chatWidth: { default: 380, min: 260, max: 700 }, chatSide: 'right', chatFullHeight: true,
})
await sleep(1600)
let pick = qa('.dsh-mt_panePick').find((b) => /资源管理器/.test(b.textContent || ''))
for (let i = 0; i < 10 && !pick; i++) { await sleep(300); pick = qa('.dsh-mt_panePick').find((b) => /资源管理器/.test(b.textContent || '')) }
if (!pick) { step('资源管理器选择器可用', false, '当前可见窗格里没有「资源管理器」选项'); return out }
pick.click()
await sleep(2200)

// ── 2. 树基本形态 ───────────────────────────────────────────────────────────
for (let i = 0; i < 20 && rows().length === 0; i++) await sleep(300)
step('树渲染出行（根目录已列出）', rows().length > 0, 'rows=' + rows().length)
step('根行单独渲染（可整体收起）', !!q('[data-ex-root-row]'), '')
const first = rows()[0]
const style = first ? getComputedStyle(first) : null
step('行高 34px、圆角 8px（对齐 better-sidebar 的行规格）', first?.getBoundingClientRect().height === 34 && style?.borderRadius === '8px',
  (first?.getBoundingClientRect().height ?? 0) + 'px / ' + (style?.borderRadius ?? '?'))
const dirRow = rows().find((el) => el.getAttribute('data-ex-dir') === '1')
step('目录行加粗（600）', dirRow ? Number(getComputedStyle(dirRow).fontWeight) >= 600 : false, dirRow ? getComputedStyle(dirRow).fontWeight : '(没有目录行)')
step('每行都有文件/文件夹图标（宿主 FileTypeIcon 的 svg）', rows().every((el) => el.querySelector('.dsh-mt_exIcon svg') !== null),
  rows().filter((el) => el.querySelector('.dsh-mt_exIcon svg') === null).length + ' 行缺图标')
const hiddenRow = rows().find((el) => (el.querySelector('.dsh-mt_exName')?.textContent ?? '').startsWith('.'))
step('隐藏项照常列出但变淡（opacity .45）', hiddenRow ? Number(getComputedStyle(hiddenRow).opacity) < 0.6 : true,
  hiddenRow ? (hiddenRow.querySelector('.dsh-mt_exName').textContent + ' opacity=' + getComputedStyle(hiddenRow).opacity) : '（该层没有隐藏项，跳过）')

// ── 3. 展开目录 + 缩进 ───────────────────────────────────────────────────────
const targetDir = rowByName('src') ?? dirRow
const before = rows().length
targetDir?.click()
await sleep(1400)
step('点目录行展开出子项', rows().length > before, `${targetDir?.querySelector('.dsh-mt_exName')?.textContent ?? ''}: ${before} → ${rows().length} 行`)
const childRow = rows().find((el) => Number(el.style.paddingLeft.replace('px', '')) > Number(targetDir?.style.paddingLeft.replace('px', '') ?? 0))
step('子项缩进比父项深（扁平兄弟 + 内联 paddingLeft）', !!childRow,
  childRow ? `${childRow.style.paddingLeft} vs 父 ${targetDir?.style.paddingLeft}` : '没找到更深的行')

// ── 4. 键盘导航（趁树还在屏上：开文件后窗格会被预览标签接管）──────────────────
const body = q('[data-ex-tree]')
body?.focus()
const focusPath = () => q('.dsh-mt_exFocus')?.getAttribute('data-ex-path') ?? null
const beforeFocus = focusPath()
body?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
await sleep(300)
const afterFocus = focusPath()
body?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
await sleep(300)
const afterFocus2 = focusPath()
step('键盘 ↑↓ 移动焦点行（两次向下各走一行）', afterFocus !== null && afterFocus !== beforeFocus && afterFocus2 !== afterFocus,
  `${String(beforeFocus).split(/[\\/]/).pop()} → ${String(afterFocus).split(/[\\/]/).pop()} → ${String(afterFocus2).split(/[\\/]/).pop()}`)

// ── 5. 悬停才出现的 @ 胶囊 → 草稿里真的多出 @相对路径 ─────────────────────────
// 根目录可能只有子目录：逐级展开，直到出现文件行（最多试 4 个目录）
let fileRow = rows().find((el) => el.getAttribute('data-ex-dir') === '0')
for (let i = 0; i < 4 && !fileRow; i++) {
  const dir = rows().filter((el) => el.getAttribute('data-ex-dir') === '1' && el.style.paddingLeft !== '6px')[i] ?? rows()[i]
  dir?.click()
  await sleep(1400)
  fileRow = rows().find((el) => el.getAttribute('data-ex-dir') === '0')
}
const refBtn = fileRow?.querySelector('[data-ex-ref]')
const fileName = fileRow?.querySelector('.dsh-mt_exName')?.textContent ?? ''
step('展开后能找到文件行（带 @ 胶囊）', !!fileRow && !!refBtn, fileName || '(没有文件行)')
step('@ 胶囊默认隐藏（悬停/聚焦才出现，对齐 better-sidebar）', refBtn ? getComputedStyle(refBtn).display === 'none' : false,
  refBtn ? 'display=' + getComputedStyle(refBtn).display : '')
clearDraft()
await sleep(300)
refBtn?.click()
await sleep(900)
const draft1 = draft()
step('点 @ 胶囊 → 草稿里多出 @' + fileName, draft1.includes('@') && draft1.toLowerCase().includes(fileName.toLowerCase().replace(/[\\/]+$/, '')),
  JSON.stringify(draft1.slice(0, 120)))

// ── 6. 右键菜单 + 「引用到对话」──────────────────────────────────────────────
clearDraft()
await sleep(300)
fileRow?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 320, clientY: 260 }))
await sleep(400)
const menu = q('[data-ex-menu]')
const items = menu ? [...menu.querySelectorAll('[data-ex-menu-item]')].map((b) => b.getAttribute('data-ex-menu-item')) : []
step('右键弹出菜单（打开预览 / 在右侧新窗口打开 / 复制相对·绝对路径 / 引用到对话）',
  !!menu && ['open', 'openRight', 'copyRel', 'copyAbs', 'reference'].every((k) => items.includes(k)), items.join(','))
menu?.querySelector('[data-ex-menu-item="reference"]')?.click()
await sleep(900)
const draft2 = draft()
step('菜单里的「引用到对话」同样进草稿', draft2.includes('@') && draft2.toLowerCase().includes(fileName.toLowerCase()), JSON.stringify(draft2.slice(0, 120)))
step('点击菜单项后菜单关闭', q('[data-ex-menu]') === null, '')

// ── 7. 搜索 ─────────────────────────────────────────────────────────────────
const search = q('[data-ex-search]')
setInput(search, 'package.json')
await sleep(1600)
const hint = q('[data-ex-search-hint]')?.textContent ?? ''
const resultRows = qa('[data-ex-results] [data-ex-path]')
step('搜索框出结果（命中数提示 + 结果行）', resultRows.length > 0 && /\d/.test(hint), JSON.stringify(hint) + ' rows=' + resultRows.length)
step('搜索结果显示所在目录（与树区分）', resultRows.some((el) => el.querySelector('.dsh-mt_exPath') !== null), '')
const targetResult = resultRows.find((el) => (el.querySelector('.dsh-mt_exName')?.textContent ?? '') === 'package.json') ?? resultRows[0]
const openedName = targetResult?.querySelector('.dsh-mt_exName')?.textContent ?? ''
targetResult?.click()
await sleep(2000)
step('点搜索结果 → 打开预览（标签名与文件一致）', qa('.dsh-mt_tabTitle').some((t) => t.textContent === openedName), openedName)

// ── 8. 预览头（图标 + 名字 + 相对路径 + 复制 + @）─────────────────────────────
const bar = q('[data-view-bar]')
step('预览头渲染（图标 + 文件名 + 相对路径）', !!bar && (bar.querySelector('.dsh-mt_viewName')?.textContent ?? '') === openedName
  && (bar.querySelector('[data-view-path]')?.textContent ?? '').length > 0,
  (bar?.querySelector('.dsh-mt_viewName')?.textContent ?? '(无)') + ' · ' + (bar?.querySelector('[data-view-path]')?.textContent ?? ''))
step('预览头有「复制相对路径」与「@ 引用」两个动作键', !!bar?.querySelector('[data-view-action="copy"]') && !!bar?.querySelector('[data-view-action="reference"]'), '')
clearDraft()
await sleep(300)
bar?.querySelector('[data-view-action="reference"]')?.click()
await sleep(900)
const draft3 = draft()
step('预览头的 @ 把当前文件引用进对话', draft3.includes('@') && draft3.toLowerCase().includes(openedName.toLowerCase()), JSON.stringify(draft3.slice(0, 120)))

// ── 9. 切回资源管理器标签：树还在（预览与树在同一窗格的标签模型里共存）─────────
const explorerTab = qa('.dsh-mt_tabTitle').find((t) => t.textContent === '资源管理器')
explorerTab?.closest('.dsh-mt_tab')?.click()
await sleep(1200)
step('点回「资源管理器」标签，树重新可见', !!q('[data-ex-tree]') && rows().length > 0, 'rows=' + rows().length)

// ── 10. 兜底链路：作用域不可用时也要能把文本塞进编排器（contenteditable）────────
const composerText = () => {
  const col = document.querySelector('#root [data-slot="conversation"]')
  return ((col ?? document).querySelector('[contenteditable="true"]')?.textContent ?? '')
}
clearDraft()
await sleep(300)
const beforeFallback = composerText()
const fallbackOutcome = hook()?.referenceInChat?.(String(scope?.cwd ?? '') + '\\src', true, null) ?? 'no-hook'
await sleep(800)
const afterFallback = composerText()
step('作用域缺失时退化到 DOM 兜底：目录引用仍进了编排器（contenteditable insertText）',
  fallbackOutcome !== 'fail' && fallbackOutcome !== 'no-hook' && afterFallback.length > beforeFallback.length && /@/.test(afterFallback),
  'outcome=' + fallbackOutcome + ' composer=' + JSON.stringify(afterFallback.slice(0, 80)))

// 收尾：清空草稿，别给后面留脏输入
clearDraft()
return out
