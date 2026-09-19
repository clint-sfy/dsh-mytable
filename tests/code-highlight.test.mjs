/**
 * 代码预览着色的纯逻辑单测（不碰 DOM）。用法：node tests/code-highlight.test.mjs
 *
 * 直接打靶 `src/client/code-highlight.ts`（Node 24 类型剥离）。覆盖：
 *   A. 扩展名 → 语言：主流语言都要认得（这正是不再"只有 6 种扩展名有色"的证据）
 *   B. 无扩展名/特殊文件名：Makefile / Dockerfile / shebang 兜底
 *   C. 纯文本类（.txt/.log/.md）不着色，走纯文本路径
 *   D. 认不出的扩展名：不着色（不误判自然语言）
 *   E. 着色产物确实是 highlight.js 的 span 标记，且行号文本正确
 */
import { highlightCode, highlightFence, lineNumbersOf } from '../src/client/code-highlight.ts'

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

// ── A. 主流语言识别 ──────────────────────────────────────────────────────────
const LANG_CASES = [
  ['a.py', 'python'], ['a.ts', 'typescript'], ['a.tsx', 'typescript'], ['a.js', 'javascript'],
  ['a.go', 'go'], ['a.rs', 'rust'], ['a.java', 'java'], ['a.c', 'c'], ['a.cpp', 'cpp'],
  ['a.cs', 'csharp'], ['a.rb', 'ruby'], ['a.php', 'php'], ['a.sh', 'bash'], ['a.ps1', 'powershell'],
  ['a.yml', 'yaml'], ['a.yaml', 'yaml'], ['a.toml', 'ini'], ['a.ini', 'ini'],
  ['a.sql', 'sql'], ['a.html', 'xml'], ['a.xml', 'xml'], ['a.css', 'css'], ['a.scss', 'scss'],
  ['a.json', 'json'], ['a.kt', 'kotlin'], ['a.swift', 'swift'], ['a.lua', 'lua'], ['a.r', 'r'],
  ['a.diff', 'diff'], ['a.proto', 'protobuf'], ['a.bat', 'dos'], ['a.gradle', 'groovy'],
]
for (const [file, lang] of LANG_CASES) {
  const r = highlightCode('x = 1', file)
  eq(`A 识别语言 ${file} → ${lang}`, r.lang, lang)
}

// ── B. 特殊文件名 / shebang ───────────────────────────────────────────────────
eq('B1 Makefile', highlightCode('all:\n\techo hi', 'Makefile').lang, 'makefile')
eq('B2 Dockerfile', highlightCode('FROM node:20', 'Dockerfile').lang, 'dockerfile')
eq('B3 shebang python（无扩展名）', highlightCode('#!/usr/bin/env python3\nprint(1)', 'run').lang, 'python')
eq('B4 shebang bash（无扩展名）', highlightCode('#!/bin/bash\necho hi', 'run').lang, 'bash')
eq('B5 .gitignore', highlightCode('node_modules', '.gitignore').lang, 'bash')

// ── C. 纯文本类不着色 ────────────────────────────────────────────────────────
for (const f of ['a.txt', 'a.log', 'a.md', 'a.markdown', 'a.csv']) {
  eq(`C 纯文本不着色 ${f}`, highlightCode('这是一段说明文字 hello world', f).lang, 'plain')
}

// ── D. 认不出的扩展名不误判 ───────────────────────────────────────────────────
const unknown = highlightCode('这是一段中文说明，不是代码。The quick brown fox jumps over the lazy dog.', 'a.unknownext')
eq('D1 未知扩展名 + 自然语言 → 不着色', unknown.lang, 'plain')

// ── E. 产物形态 ─────────────────────────────────────────────────────────────
const py = highlightCode('import os\n\ndef greet(name):\n    # 打招呼\n    return f"hi {name}"\n', 'a.py')
eq('E1 python 着色：识别为 python', py.lang, 'python')
eq('E2 python 着色：产物含 hljs span 标记', /<span class="hljs-/.test(py.html), true)
eq('E3 python 着色：关键字/字符串/注释都分出来了',
  /hljs-keyword/.test(py.html) && /hljs-string/.test(py.html) && /hljs-comment/.test(py.html), true)
const ts = highlightCode('const n: number = 42\n', 'a.ts')
eq('E4 着色结果已转义（无裸 < > 破坏结构）', /<span class="hljs-/.test(ts.html) && !/<(?!\/?span|\/?code)/.test(ts.html), true)
eq('E5 行号：单行文件也是 1 行', lineNumbersOf('abc'), '1')
eq('E6 行号：3 行 → 1\\n2\\n3', lineNumbersOf('a\nb\nc'), '1\n2\n3')
// 末尾换行在 <pre white-space:pre> 里会多出一个空行盒，行号必须一起多一行才不会错位
eq('E7 行号：末尾换行也会算一个空行（与 pre 的行盒对齐）', lineNumbersOf('a\nb\n'), '1\n2\n3')
eq('E8 空文件 → 1 行', lineNumbersOf(''), '1')

// ── F. markdown 围栏代码块 ───────────────────────────────────────────────────
const fencePy = highlightFence('import os\nprint("hi")\n', 'py')
eq('F1 围栏 ```py → 有 span 着色', /<span class="hljs-/.test(fencePy), true)
eq('F2 围栏 ```py → 关键字分出来了', /hljs-keyword/.test(fencePy), true)
eq('F3 围栏 ```ts 别名可用', /<span class="hljs-/.test(highlightFence('const n: number = 1\n', 'ts')), true)
eq('F4 围栏 ```sh 别名可用', /<span class="hljs-/.test(highlightFence('echo "$HOME"\n', 'sh')), true)
eq('F5 围栏语言认不出 + 自然语言 → 交回默认渲染（空串）', highlightFence('这是一段说明，不是代码。Just prose.', 'zzz'), '')
eq('F6 围栏无语言标注 → 不猜语言（与 VS Code 一致，交回默认渲染）', highlightFence('def f(x):\n    return x + 1\n', ''), '')
eq('F7 围栏语言标错/不存在 → 也不乱猜', highlightFence('some words here', 'not-a-lang'), '')

console.log(`\n${pass} passed, ${failures.length} failed`)
for (const f of failures) console.error('  - ' + f)
process.exitCode = failures.length === 0 ? 0 : 1
