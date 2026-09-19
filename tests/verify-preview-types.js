/**
 * 「各种文件类型都有合适的预览」真机验收：夹具由探针自己经 `/api/worktable/write` 造出来
 * （文本直接写，wav/docx/zip 这类走 `encoding:'base64'` 写二进制）。
 *
 * 用法：node tests/cdp-probe.mjs <ws模块> <就绪URL> tests/verify-preview-types.js <png> fresh
 *
 * 断言覆盖：
 *   A. csv/tsv → 解析成表格（表头 + 数据行，不再是文本坨）
 *   B. pdf → 内嵌 iframe 承载 + MIME 正确（浏览器自带阅读器）
 *   C. wav（真 WAV 字节）→ <audio controls> 且**元数据真的加载出来了**（readyState ≥ 1）
 *   D. mp4 → <video controls>
 *   E. docx / zip → 「不支持内嵌预览」面板（打开 / 复制路径），**不再把二进制当文本读成乱码**
 *   F. 未知扩展名仍是纯文本（不越权）
 *   G. 预览头对每种类型都带「在浏览器中打开」
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const out = { steps: [], fail: false }
const step = (name, ok, detail) => { out.steps.push({ name, ok: !!ok, detail }); if (!ok) out.fail = true }

const store = window.__dshWorktable.splitStore
const activeRoot = () => document.querySelector('[data-mt-workspace][data-mt-active="true"]') ?? document
const q = (sel) => activeRoot().querySelector(sel)
const qa = (sel) => [...activeRoot().querySelectorAll(sel)]
const url = (p) => '/api/worktable/file?path=' + encodeURIComponent(p)

// 基准目录（空 path 让服务端按 cwd 兜底并回绝对路径）
const fsInfo = await fetch('/api/worktable/fs', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: '' }),
}).then((r) => r.json()).catch(() => null)
const base = String(fsInfo?.path ?? '')
const write = async (rel, content, encoding) => {
  const path = base + '\\.tmp\\' + rel
  const r = await fetch('/api/worktable/write', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path, content, ...(encoding ? { encoding } : {}) }),
  })
  const d = await r.json().catch(() => null)
  return r.ok ? path : null
}
const headType = async (path) => {
  const r = await fetch(url(path), { method: 'HEAD' }).catch(() => null)
  return r ? String(r.headers.get('content-type') ?? '') : ''
}

// ── 夹具 ────────────────────────────────────────────────────────────────────
// 最小可用 PDF（纯 ASCII 手写，够浏览器认成 PDF 文档）
const PDF = [
  '%PDF-1.4',
  '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
  '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
  '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 100]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj',
  '4 0 obj<</Length 44>>stream',
  'BT /F1 18 Tf 20 50 Td (mytable pdf) Tj ET',
  'endstream endobj',
  '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj',
  'trailer<</Root 1 0 R>>',
  '%%EOF',
].join('\n')
// 真 WAV：44 字节头 + 800 个 16bit 静音样本（0.05s @16kHz）
const wavBase64 = (() => {
  const samples = 800
  const buf = new Uint8Array(44 + samples * 2)
  const dv = new DataView(buf.buffer)
  const ascii = (off, s) => { for (let i = 0; i < s.length; i++) buf[off + i] = s.charCodeAt(i) }
  ascii(0, 'RIFF'); dv.setUint32(4, 36 + samples * 2, true); ascii(8, 'WAVE')
  ascii(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true)
  dv.setUint32(24, 16000, true); dv.setUint32(28, 32000, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true)
  ascii(36, 'data'); dv.setUint32(40, samples * 2, true)
  let bin = ''
  for (const b of buf) bin += String.fromCharCode(b)
  return btoa(bin)
})()
// zip/docx：PK 头 + 少量字节（只验证「家族分流到面板」，不冒充可解析的文档）
const zipBase64 = btoa('PK\x03\x04\x14\x00\x00\x00\x00\x00mytable-zip-fixture')

const csvPath = await write('preview.csv', 'name,qty,note\napple,3,"fresh, red"\npear,10,ok\n')
const pdfPath = await write('preview.pdf', PDF)
const wavPath = await write('preview.wav', wavBase64, 'base64')
const zipPath = await write('preview.zip', zipBase64, 'base64')
const docxPath = await write('preview.docx', zipBase64, 'base64')
const oddPath = await write('preview.unknownext', '这是一段说明文字，不是代码也不是二进制。\n')
step('夹具写入成功（文本 + base64 二进制两条路）',
  [csvPath, pdfPath, wavPath, zipPath, docxPath, oddPath].every((p) => p !== null),
  [csvPath, pdfPath, wavPath, zipPath, docxPath, oddPath].filter((p) => p === null).length + ' 个失败')

store.open({
  id: 'preview-types', title: 't', top: null,
  main: [{ id: 'p1', title: '窗口1', min: 200, content: null, tabs: [], active: 0 }],
  chatWidth: { default: 380, min: 260, max: 700 }, chatSide: 'right', chatFullHeight: true,
})
await sleep(1500)
const open = async (p, wait = 2200) => { store.openTab('main', 0, { kind: 'file', path: p }); await sleep(wait) }

// ── A. CSV → 表格 ───────────────────────────────────────────────────────────
await open(csvPath)
const table = q('table.dsh-mt_table')
const heads = table ? [...table.querySelectorAll('thead th')].map((th) => th.textContent) : []
const bodyRows = table ? [...table.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent)) : []
step('A1 csv 解析成表格且行数正确（3 行）', !!table && q('[data-table-rows]')?.getAttribute('data-table-rows') === '3',
  q('[data-table-rows]')?.getAttribute('data-table-rows') ?? '(没有表格)')
step('A2 表头 = 首行', JSON.stringify(heads) === JSON.stringify(['name', 'qty', 'note']), JSON.stringify(heads))
step('A3 引号内的逗号算同一格', bodyRows[0]?.[2] === 'fresh, red', JSON.stringify(bodyRows[0] ?? []))
step('A4 不再落到纯文本分支（没有 .dsh-mt_txt）', q('.dsh-mt_txt') === null, '')

// ── B. PDF → 内嵌 iframe + MIME ─────────────────────────────────────────────
await open(pdfPath)
const pdfFrame = q('iframe')
step('B1 pdf 用内嵌 iframe 承载且 src 指向该文件', !!pdfFrame && (pdfFrame.getAttribute('src') ?? '').startsWith('/api/worktable/file?path='),
  pdfFrame?.getAttribute('src')?.slice(0, 60) ?? '(没有 iframe)')
step('B2 服务端按 application/pdf 下发（浏览器自带阅读器能直接开）', (await headType(pdfPath)).includes('application/pdf'), await headType(pdfPath))

// ── C. WAV → 音频播放器且真的加载了元数据 ───────────────────────────────────
await open(wavPath, 2600)
const audio = q('audio[data-media-player="audio"]')
await sleep(1200)
step('C1 wav 渲染成 <audio controls>', !!audio && audio.hasAttribute('controls') && (audio.getAttribute('src') ?? '').startsWith('/api/worktable/file?path='),
  audio ? ('controls=' + audio.hasAttribute('controls')) : '(没有 audio)')
step('C2 音频元数据真的加载出来了（readyState ≥ 1，说明是合法音频）', !!audio && audio.readyState >= 1,
  audio ? 'readyState=' + audio.readyState : '')
step('C3 服务端按 audio/wav 下发', (await headType(wavPath)).includes('audio/wav'), await headType(wavPath))

// ── D. MP4 → 视频播放器（本夹具不是可解码视频，只验承载与 MIME）─────────────
const mp4Path = await write('preview.mp4', 'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDE=', 'base64')
await open(mp4Path, 2200)
const video = q('video[data-media-player="video"]')
step('D1 mp4 渲染成 <video controls>', !!video && video.hasAttribute('controls'), video ? 'controls=true' : '(没有 video)')
step('D2 服务端按 video/mp4 下发', (await headType(mp4Path)).includes('video/mp4'), await headType(mp4Path))

// ── E. Office / 压缩包 → 说明面板（不再当文本读）─────────────────────────────
await open(docxPath)
const office = q('[data-nopreview-kind="office"]')
step('E1 docx 走 Office 说明面板（不是在读乱码）', !!office && q('.dsh-mt_txt') === null, office ? 'panel=office' : '(没有面板)')
step('E2 面板给出「在浏览器中打开」与「复制绝对路径」两个出口',
  !!office?.querySelector('[data-nopreview-action="open"]') && !!office?.querySelector('[data-nopreview-action="copy"]'), '')
step('E3 服务端按 docx 的 MIME 下发', (await headType(docxPath)).includes('wordprocessingml'), await headType(docxPath))

await open(zipPath)
const binary = q('[data-nopreview-kind="binary"]')
step('E4 zip 走二进制说明面板', !!binary && q('.dsh-mt_txt') === null, binary ? 'panel=binary' : '(没有面板)')
step('E5 服务端按 application/zip 下发', (await headType(zipPath)).includes('zip'), await headType(zipPath))

// ── F. 未知扩展名仍是纯文本（不越权当二进制）─────────────────────────────────
await open(oddPath, 2000)
step('F1 未知扩展名仍是纯文本预览', !!q('.dsh-mt_txt') && q('[data-nopreview-kind]') === null && q('table.dsh-mt_table') === null, '')

// ── G. 预览头的「在浏览器中打开」────────────────────────────────────────────
const bar = q('[data-view-bar]')
step('G1 预览头带「在浏览器中打开」键（每种类型都能丢给真浏览器）', !!bar?.querySelector('[data-view-action="open-external"]'), '')

store.close()
return out
