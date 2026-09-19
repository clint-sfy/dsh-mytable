/**
 * 代码预览着色真机验收：夹具文件由探针自己经 `/api/worktable/write` 造出来，然后读**渲染后的实际颜色**。
 *
 * 用法：node tests/cdp-probe.mjs <ws模块> <就绪URL> tests/verify-code-highlight.js <png> fresh
 *
 * 断言覆盖（对齐"像 VS Code"这个诉求）：
 *   A. .py / .yml 这些以前完全不上色的语言，现在能识别（`data-code-lang`）并分出关键字/字符串/注释
 *   B. 颜色就是 VS Code Default Dark+ 的取值（#569CD6 关键字 / #CE9178 字符串 / #6A9955 注释）
 *   C. 同一屏里至少 3 种不同颜色（"不同颜色区分"的直接证据）
 *   D. 行号列存在、行数正确、不可选中
 *   E. 切到浅色主题 → 关键字变成 Light+ 的 #0000FF（两套配色 + 实时跟随）
 *   F. 认不出的扩展名不上色、不出行号（不误判、不回归）
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const out = { steps: [], fail: false }
const step = (name, ok, detail) => { out.steps.push({ name, ok: !!ok, detail }); if (!ok) out.fail = true }

const store = window.__dshWorktable.splitStore
const activeRoot = () => document.querySelector('[data-mt-workspace][data-mt-active="true"]') ?? document
const q = (sel) => activeRoot().querySelector(sel)
const qa = (sel) => [...activeRoot().querySelectorAll(sel)]

// 夹具基准目录：问一次 /api/worktable/fs（空 path → 服务端按 cwd 兜底并回绝对路径）。
// 注意不要点「新会话」：新建/切换会话会让工作台浮层不渲染（未绑定项目的会话不显示工作台）。
const fsInfo = await fetch('/api/worktable/fs', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: '' }),
}).then((r) => r.json()).catch(() => null)
const base = String(fsInfo?.path ?? '')
step('拿到服务端基准目录（/api/worktable/fs 空 path 兜底）', !!base, base)
const writeFixture = async (rel, content) => {
  const path = base + '\\' + rel.split('/').join('\\')
  const r = await fetch('/api/worktable/write', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path, content }),
  })
  return r.ok ? path : null
}
const colorOf = (sel) => {
  const el = q(sel)
  return el ? getComputedStyle(el).color : ''
}

// ── 0. 夹具：一个 python 文件、一个 yaml 文件、一个未知扩展名文件 ──────────────
const PY_TEXT = [
  '# 注释也应当有颜色',
  'import os',
  '',
  'def greet(name):',
  '    return f"hi {name}"',
  '',
  'COUNT = 42',
  'print(greet("mytable"))',
].join('\n') + '\n'
const pyPath = await writeFixture('.tmp/hl-verify.py', PY_TEXT)
const ymlPath = await writeFixture('.tmp/hl-verify.yml', 'name: mytable\nport: 3080\nlist:\n  - a\n  - b\n')
const oddPath = await writeFixture('.tmp/hl-verify.unknownext', '这是一段中文说明，并不是代码。Just prose here, no syntax.\n')
step('夹具写入成功（经 /api/worktable/write）', !!pyPath && !!ymlPath && !!oddPath, [pyPath, ymlPath, oddPath].map((p) => (p ? 'ok' : 'null')).join(','))

store.open({
  id: 'hl-check', title: 't', top: null,
  main: [{ id: 'p1', title: '窗口1', min: 200, content: null, tabs: [], active: 0 }],
  chatWidth: { default: 380, min: 260, max: 700 }, chatSide: 'right', chatFullHeight: true,
})
await sleep(1500)

// ── A. Python：以前完全不上色的语言 ──────────────────────────────────────────
store.openTab('main', 0, { kind: 'file', path: pyPath })
await sleep(2200)
step('浮层没有进入错误态（渲染期抛错会让 shell.overlay 变成 data-slot-error）',
  document.querySelector('[data-slot-error]') === null, document.querySelector('[data-slot-error]')?.getAttribute('data-slot-error') ?? '')
step('预览确实渲染出来了（有预览头）', !!q('[data-view-bar]'), q('.dsh-mt_paneWipText')?.textContent ?? '')
const pyWrap = q('.dsh-mt_codeWrap')
step('A1 .py 被识别成 python 并进入着色路径', pyWrap?.getAttribute('data-code-lang') === 'python', pyWrap?.getAttribute('data-code-lang') ?? '(没有着色容器)')
step('A2 关键字 / 字符串 / 注释都分出来了',
  !!q('.dsh-mt_code .hljs-keyword') && !!q('.dsh-mt_code .hljs-string') && !!q('.dsh-mt_code .hljs-comment'),
  `keyword=${!!q('.hljs-keyword')} string=${!!q('.hljs-string')} comment=${!!q('.hljs-comment')}`)

// ── B. 颜色 = VS Code 配色（先强制深色再切浅色，不依赖这台机器当前是什么主题）────
const setScheme = (dark) => {
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  if (dark) document.body.setAttribute('data-ds-dark-theme', '')
  else document.body.removeAttribute('data-ds-dark-theme')
}
setScheme(true)
await sleep(900)
const kwColor = colorOf('.dsh-mt_code .hljs-keyword')
const strColor = colorOf('.dsh-mt_code .hljs-string')
const comColor = colorOf('.dsh-mt_code .hljs-comment')
step('B1 深色下关键字 = VS Code Default Dark+ #569CD6', kwColor === 'rgb(86, 156, 214)', kwColor)
step('B2 深色下字符串 = Dark+ #CE9178', strColor === 'rgb(206, 145, 120)', strColor)
step('B3 深色下注释 = Dark+ #6A9955', comColor === 'rgb(106, 153, 85)', comColor)

// ── C. 同屏至少 3 种颜色 ────────────────────────────────────────────────────
const colors = [...new Set(qa('.dsh-mt_code span[class^="hljs-"]').map((el) => getComputedStyle(el).color))]
step('C1 同一份代码里至少 3 种不同颜色（"不同颜色区分"的直接证据）', colors.length >= 3, colors.join(' | '))

// ── D. 行号列 ───────────────────────────────────────────────────────────────
const gutter = q('.dsh-mt_codeNums')
const gutterLines = (gutter?.textContent ?? '').split('\n')
// 期望行数直接由夹具文本推出来（与实现同源：按 \n 切分），避免写死数字
const expectedLines = PY_TEXT.split('\n').length
step('D1 行号列存在且行数与代码一致', !!gutter && gutterLines.length === expectedLines && gutterLines[0] === '1' && gutterLines[expectedLines - 1] === String(expectedLines),
  gutter ? `${gutterLines.length} 行（期望 ${expectedLines}）` : '(没有行号列)')
step('D2 行号不可选中且粘在左侧（横向滚动不跑）', gutter ? getComputedStyle(gutter).userSelect === 'none' && getComputedStyle(gutter).position === 'sticky' : false,
  gutter ? `user-select=${getComputedStyle(gutter).userSelect} position=${getComputedStyle(gutter).position}` : '')

// ── E. 切浅色主题：换成 VS Code Light+ ───────────────────────────────────────
setScheme(false)
await sleep(900)
const kwLight = colorOf('.dsh-mt_code .hljs-keyword')
step('E1 切浅色 → 关键字变 Light+ #0000FF（两套配色，不是写死一套）', kwLight === 'rgb(0, 0, 255)', kwLight)
const strLight = colorOf('.dsh-mt_code .hljs-string')
step('E2 浅色下字符串 = Light+ #A31515', strLight === 'rgb(163, 21, 21)', strLight)
setScheme(true)
await sleep(900)
step('E3 切回深色 → 颜色跟着回来', colorOf('.dsh-mt_code .hljs-keyword') === 'rgb(86, 156, 214)', colorOf('.dsh-mt_code .hljs-keyword'))

// ── F. YAML + 未知扩展名 ────────────────────────────────────────────────────
store.openTab('main', 0, { kind: 'file', path: ymlPath })
await sleep(2000)
step('F1 .yml 也被识别（yaml）并着色', q('.dsh-mt_codeWrap')?.getAttribute('data-code-lang') === 'yaml'
  && !!q('.dsh-mt_code .hljs-attr, .dsh-mt_code .hljs-string'), q('.dsh-mt_codeWrap')?.getAttribute('data-code-lang') ?? '(无)')

store.openTab('main', 0, { kind: 'file', path: oddPath })
await sleep(2000)
step('F2 认不出的扩展名：不上色也不出行号（退纯文本，不误判）',
  q('.dsh-mt_codeWrap') === null && q('.dsh-mt_codeNums') === null && !!q('.dsh-mt_txt'), '')

// ── G. markdown 里的围栏代码块也要着色 ───────────────────────────────────────
const mdPath = await writeFixture('.tmp/hl-verify.md', [
  '# 标题',
  '',
  '正文一段。',
  '',
  '```py',
  'import os',
  'def hi(name):',
  '    return f"hi {name}"  # 注释',
  '```',
  '',
].join('\n'))
store.openTab('main', 0, { kind: 'file', path: mdPath })
await sleep(2200)
const mdHost = q('.dsh-mt_md')
step('G1 markdown 正文渲染且容器带主题调色板类', !!mdHost && /dsh-mt_hl(Dark|Light)/.test(mdHost.className), mdHost?.className ?? '(无 .dsh-mt_md)')
const fenceKw = q('.dsh-mt_md pre code .hljs-keyword')
step('G2 围栏 ```py 里的关键字被着色', !!fenceKw, fenceKw ? JSON.stringify(fenceKw.textContent) : '(围栏里没有 hljs span)')
step('G3 围栏颜色 = 深色 VS Code Dark+ #569CD6', fenceKw ? getComputedStyle(fenceKw).color === 'rgb(86, 156, 214)' : false,
  fenceKw ? getComputedStyle(fenceKw).color : '')

store.close()
return out
