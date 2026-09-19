/**
 * 源码编码守卫：防止「PowerShell 5.1 按 ANSI 读无 BOM UTF-8 → 写回」这类二次编码事故再次悄悄发生。
 *
 * 背景：一次 `Get-Content`(无 -Encoding) + `Set-Content -Encoding UTF8` 就能把整个文件的中文
 * 变成 `鍔ㄧ敾` 这种形态（并且悄悄加上 BOM），编译与运行都不报错，只有人眼看中文注释时才发现。
 *
 * 判据（两个都不依赖硬编码字表，全部现推）：
 *   1. **乱码密度**：先把「已知干净的中文语料」编码成 UTF-8、再按 GBK 解码，得到「二次编码字母表」；
 *      真损坏的文件几乎每个汉字都落在该字母表里（密度 > 50%），干净文件只是零星命中。
 *   2. **BOM**：仓库约定源码为无 BOM 的 UTF-8；出现 BOM 基本可判定被 `Set-Content -Encoding UTF8`
 *      之类写过，必须查。
 *
 * 用法：node tests/encoding.test.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const gbk = new TextDecoder('gbk', { fatal: false })
const utf8 = new TextEncoder()

let pass = 0
const failures = []
const ok = (name) => { console.log('ok   ' + name); pass++ }
const fail = (name, detail) => { failures.push(name + ': ' + detail); console.error('FAIL(' + name + '): ' + detail) }

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === '.tmp' || name === 'lib') continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|js|mjs|md|json|css|yml)$/.test(name)) out.push(p)
  }
  return out
}

const files = [
  ...walk(join(ROOT, 'src')),
  ...walk(join(ROOT, 'tests')),
  ...walk(join(ROOT, 'tools')),
  ...['README.md', 'package.json', 'dsh.plugin.json', 'cordis.patch.yml']
    .map((f) => join(ROOT, f)).filter((f) => { try { return statSync(f).isFile() } catch { return false } }),
]

// ── 语料：从本仓库自己的大文件里取汉字（它们由编码守卫一起体检，损坏时下面会直接报出来）──
const corpusText = [join(ROOT, 'README.md'), join(ROOT, 'src', 'client', 'locales.ts')]
  .map((f) => readFileSync(f, 'utf8'))
  .join('')
const alphabet = new Set()
for (const ch of gbk.decode(utf8.encode(corpusText))) {
  if (ch.codePointAt(0) > 127) alphabet.add(ch)
}
if (alphabet.size < 300) fail('字母表推导', `只得到 ${alphabet.size} 个字符，语料不足或已被破坏`)
else ok(`二次编码字母表现推成功（${alphabet.size} 个字符，语料 = README.md + locales.ts）`)

const isCjk = (ch) => ch >= '\u4e00' && ch <= '\u9fff'
let damaged = 0
let bom = 0
for (const file of files) {
  const rel = file.slice(ROOT.length + 1)
  const bytes = readFileSync(file)
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    bom++
    fail('无 BOM 约定 ' + rel, 'UTF-8 BOM：多半被 PowerShell Set-Content -Encoding UTF8 写过，请核查是否同时发生二次编码')
  }
  const text = bytes.toString('utf8')
  let cjk = 0
  let hits = 0
  for (const ch of text) {
    if (isCjk(ch)) { cjk++; if (alphabet.has(ch)) hits++ }
  }
  if (cjk < 20) continue
  const ratio = hits / cjk
  if (ratio > 0.5) {
    damaged++
    fail('中文未二次编码 ' + rel, `汉字 ${cjk} 个里 ${hits} 个是乱码形态（${(ratio * 100).toFixed(0)}%）：文件疑似被 ANSI 往返破坏，可用 tools/fix-encoding.ps1 反变换`)
  }
}
if (damaged === 0) ok(`扫描 ${files.length} 个文件：没有二次编码迹象`)
if (bom === 0) ok(`扫描 ${files.length} 个文件：没有多余的 UTF-8 BOM`)

console.log(`\n${pass} passed, ${failures.length} failed`)
for (const f of failures) console.error('  - ' + f)
process.exitCode = failures.length === 0 ? 0 : 1
