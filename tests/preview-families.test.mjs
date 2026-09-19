/**
 * 预览家族判定 + CSV 解析的纯逻辑单测（不碰 DOM、不引 React）。
 * 用法：node tests/preview-families.test.mjs
 *
 * 直接打靶 `src/client/preview-family.ts` 与 `src/client/csv.ts`。
 * 这两个模块决定「点开一个文件用什么承载面」——判错就会退回乱码，所以逐类钉死。
 *
 * 覆盖点：
 *   A. 每个家族都有代表扩展名（html/md/code/text/image/pdf/audio/video/table/office/binary）
 *   B. 代码家族靠宽语言表（.py/.go/.yml/.sh/.ps1…）而不是旧的白名单 6 个
 *   C. 音频/视频/表格/Office/二进制的边界（不与 code/text 抢）
 *   D. 未知扩展名仍然是纯文本（不越权当二进制）
 *   E. parseDelimited：引号、转义引号、引号内换行与分隔符、\r\n、末尾无换行、行/列上限截断
 */
import { PREVIEW_FAMILIES, previewFamilyOf } from '../src/client/preview-family.ts'
import { parseDelimited, TABLE_MAX_COLS, TABLE_MAX_ROWS } from '../src/client/csv.ts'

let pass = 0
const failures = []
const ok = (name) => { console.log('ok   ' + name); pass++ }
function fail(name, detail) {
  failures.push(name + ': ' + detail)
  console.error('FAIL(' + name + '): ' + detail)
}
function eq(name, actual, expected) {
  if (actual === expected) ok(name)
  else fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

// ── A. 家族代表扩展名 ────────────────────────────────────────────────────────
const FAMILY_CASES = [
  ['index.html', 'html'], ['page.htm', 'html'],
  ['README.md', 'md'], ['doc.markdown', 'md'],
  ['a.py', 'code'], ['a.ts', 'code'], ['a.json', 'code'], ['Makefile', 'code'], ['run.sh', 'code'],
  ['notes.txt', 'text'], ['app.log', 'text'], ['LICENSE', 'text'], ['data.unknownext', 'text'],
  ['pic.png', 'image'], ['pic.jpg', 'image'], ['pic.svg', 'image'], ['pic.avif', 'image'],
  ['paper.pdf', 'pdf'],
  ['song.mp3', 'audio'], ['song.wav', 'audio'], ['song.flac', 'audio'], ['song.m4a', 'audio'], ['song.oga', 'audio'],
  ['clip.mp4', 'video'], ['clip.webm', 'video'], ['clip.mov', 'video'], ['clip.mkv', 'video'],
  ['sheet.csv', 'table'], ['sheet.tsv', 'table'],
  ['report.docx', 'office'], ['report.doc', 'office'], ['book.xlsx', 'office'], ['deck.pptx', 'office'], ['note.rtf', 'office'],
  ['bundle.zip', 'binary'], ['archive.tar', 'binary'], ['pkg.gz', 'binary'], ['app.exe', 'binary'],
  ['lib.dll', 'binary'], ['data.sqlite', 'binary'], ['font.woff2', 'binary'], ['mod.wasm', 'binary'],
]
for (const [file, family] of FAMILY_CASES) {
  eq(`A ${file} → ${family}`, previewFamilyOf(file), family)
}

// ── B. 代码家族是宽表（旧实现只认 6 个扩展名）──────────────────────────────────
for (const f of ['a.py', 'a.go', 'a.rs', 'a.rb', 'a.php', 'a.yml', 'a.yaml', 'a.toml', 'a.ini', 'a.sql',
  'a.kt', 'a.swift', 'a.lua', 'a.r', 'a.diff', 'a.proto', 'a.gradle', 'a.ps1', 'a.bat', 'a.c', 'a.cpp',
  'a.cs', 'a.scss', 'a.xml', 'Dockerfile', '.gitignore']) {
  eq(`B ${f} 归到代码家族`, previewFamilyOf(f), 'code')
}

// ── C. 边界：不互相抢 ────────────────────────────────────────────────────────
eq('C1 .svg 是图片（不是代码/二进制）', previewFamilyOf('logo.svg'), 'image')
eq('C2 .json 是代码（可着色）', previewFamilyOf('package.json'), 'json'.replace('json', 'code'))
eq('C3 .zip 是二进制（不是代码）', previewFamilyOf('x.zip'), 'binary')
eq('C4 .csv 是表格（不是文本）', previewFamilyOf('x.csv'), 'table')
eq('C5 .mp4 是视频（不是二进制）', previewFamilyOf('x.mp4'), 'video')
eq('C6 .wav 是音频（不是二进制）', previewFamilyOf('x.wav'), 'audio')
eq('C7 .docx 是 Office（不是二进制）', previewFamilyOf('x.docx'), 'office')
eq('C8 .h 是 C 头文件 → 代码', previewFamilyOf('a.h'), 'code')
eq('C9 无扩展名且有 shebang 的文件名不误判 → 文本', previewFamilyOf('somefile'), 'text')
eq('C10 家族清单与判定来源一致（11 个）', PREVIEW_FAMILIES.length, 11)

// ── D. 未知扩展名不越权 ──────────────────────────────────────────────────────
eq('D1 .xyz → 文本（不是二进制）', previewFamilyOf('a.xyz'), 'text')
eq('D2 大写扩展名同样识别', previewFamilyOf('A.PNG'), 'image')
eq('D3 路径里的点不影响（目录名带点）', previewFamilyOf('my.dir/file.txt'), 'text')

// ── E. CSV / TSV 解析 ────────────────────────────────────────────────────────
const p1 = parseDelimited('a,b,c\n1,2,3\n', ',')
eq('E1 基本两行三列', JSON.stringify(p1.rows), JSON.stringify([['a', 'b', 'c'], ['1', '2', '3']]))
eq('E2 不截断', p1.truncated, false)
const p2 = parseDelimited('x,"a,b",y\n', ',')
eq('E3 引号内的分隔符不算分隔', JSON.stringify(p2.rows), JSON.stringify([['x', 'a,b', 'y']]))
const p3 = parseDelimited('x,"say ""hi""",y\n', ',')
eq('E4 双引号转义', JSON.stringify(p3.rows), JSON.stringify([['x', 'say "hi"', 'y']]))
const p4 = parseDelimited('x,"line1\nline2",y\n', ',')
eq('E5 引号内换行属于同一格', JSON.stringify(p4.rows), JSON.stringify([['x', 'line1\nline2', 'y']]))
const p5 = parseDelimited('a,b\r\nc,d\r\n', ',')
eq('E6 CRLF 归一', JSON.stringify(p5.rows), JSON.stringify([['a', 'b'], ['c', 'd']]))
const p6 = parseDelimited('a,b', ',')
eq('E7 末尾无换行也收最后一行', JSON.stringify(p6.rows), JSON.stringify([['a', 'b']]))
const p7 = parseDelimited('a\tb\n1\t2\n', '\t')
eq('E8 TSV 分隔符', JSON.stringify(p7.rows), JSON.stringify([['a', 'b'], ['1', '2']]))
const big = Array.from({ length: TABLE_MAX_ROWS + 20 }, (_, i) => `r${i},x`).join('\n')
const p8 = parseDelimited(big, ',')
eq('E9 行数超上限被截断', p8.rows.length, TABLE_MAX_ROWS)
eq('E10 截断标记置位', p8.truncated, true)
const wide = Array.from({ length: TABLE_MAX_COLS + 5 }, (_, i) => `c${i}`).join(',')
const p9 = parseDelimited(wide, ',')
eq('E11 列数超上限被截断', p9.rows[0].length, TABLE_MAX_COLS)
eq('E12 宽表也标记截断', p9.truncated, true)
eq('E13 空文本 → 空表格', JSON.stringify(parseDelimited('', ',')), JSON.stringify({ rows: [], truncated: false }))

console.log(`\n${pass} passed, ${failures.length} failed`)
for (const f of failures) console.error('  - ' + f)
process.exitCode = failures.length === 0 ? 0 : 1
