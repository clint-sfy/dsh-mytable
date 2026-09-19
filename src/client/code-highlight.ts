/**
 * 代码预览的语法着色（对齐编辑器手感：**多语言** + **深浅两套 VS Code 配色** + 行号）。
 *
 * 之前的实现只注册了 4 种 highlight.js 语言（ts/js/css/json），并且只在 6 种扩展名上生效，
 * 其余文件（.py/.go/.rs/.yaml/.sh/.html/.sql…）一律当纯文本渲染——所以看着"没有 VS Code 那种
 * 关键字/字符串/注释分色"。这里改成：
 *   1. 用 highlight.js 的 **common 语言集**（约 40 种主流语言，一行导入，按需再补别名）；
 *   2. 扩展名 → 语言 id 的**宽表**（含 shebang 兜底：无扩展名但有 `#!/usr/bin/env python` 也能认）；
 *   3. 认不出扩展名时用 `highlightAuto` 自动判语言（有体积/耗时闸，纯文本类直接跳过）；
 *   4. token 颜色不再写死：由外层容器上的 `dsh-mt_codeDark` / `dsh-mt_codeLight` 提供一组 CSS 变量，
 *      两套值分别是 VS Code 的 Default Dark+ / Light+ 主题。
 */
import hljs from 'highlight.js/lib/common'
// common 集之外的常用语言（单测实测缺这些：Windows 上 powershell/bat 必须有，docker/tf/gradle/proto 也常用）
import hljsPowerShell from 'highlight.js/lib/languages/powershell'
import hljsDockerfile from 'highlight.js/lib/languages/dockerfile'
import hljsProtobuf from 'highlight.js/lib/languages/protobuf'
import hljsGroovy from 'highlight.js/lib/languages/groovy'
import hljsDos from 'highlight.js/lib/languages/dos'

hljs.registerLanguage('powershell', hljsPowerShell)
hljs.registerLanguage('dockerfile', hljsDockerfile)
hljs.registerLanguage('protobuf', hljsProtobuf)
hljs.registerLanguage('groovy', hljsGroovy)
hljs.registerLanguage('dos', hljsDos)

/** 扩展名 → highlight.js 语言 id（宽表；值必须是 common 集里注册过的 id） */
const LANG_BY_EXT: Record<string, string> = {
  // JS / TS 家族
  ts: 'typescript', tsx: 'typescript', mts: 'typescript', cts: 'typescript',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  // Web
  css: 'css', scss: 'scss', less: 'less', html: 'xml', htm: 'xml', xml: 'xml', svg: 'xml', vue: 'xml',
  // 数据 / 配置
  json: 'json', jsonc: 'json', json5: 'json', yml: 'yaml', yaml: 'yaml', toml: 'ini', ini: 'ini', cfg: 'ini', conf: 'ini',
  // 脚本 / 后端
  py: 'python', pyw: 'python', rb: 'ruby', php: 'php', pl: 'perl', pm: 'perl', lua: 'lua', r: 'r',
  go: 'go', rs: 'rust', java: 'java', kt: 'kotlin', kts: 'kotlin', scala: 'scala', groovy: 'groovy', gradle: 'groovy',
  cs: 'csharp', c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp', hh: 'cpp', m: 'objectivec', mm: 'objectivec',
  swift: 'swift', dart: 'dart', ex: 'elixir', exs: 'elixir', erl: 'erlang', hs: 'haskell', clj: 'clojure', jl: 'julia',
  // Shell / 终端
  sh: 'bash', bash: 'bash', zsh: 'bash', fish: 'bash', ps1: 'powershell', psm1: 'powershell', bat: 'dos', cmd: 'dos',
  // 查询 / 其它语言
  sql: 'sql', graphql: 'graphql', gql: 'graphql', proto: 'protobuf',
  vim: 'vim', makefile: 'makefile', mk: 'makefile', cmake: 'cmake', dockerfile: 'dockerfile', diff: 'diff', patch: 'diff',
}

/** 明确当纯文本的扩展名（不做自动判定，避免在大段自然语言上白跑一遍分词） */
const PLAIN_EXT = /^(txt|log|csv|tsv|text|md|markdown|mdown|rst|adoc)$/i

/** 自动判定的门槛：太长的不判（highlightAuto 要跑全部候选语言，大文件上代价明显） */
const AUTO_MAX_BYTES = 200 * 1024

/** 按文件名/首行识别无扩展名的常见文件（Makefile / Dockerfile / shebang） */
function langFromNameOrShebang(path: string, text: string): string | undefined {
  const base = (path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? '').toLowerCase()
  if (base === 'makefile' || base === 'gnumakefile') return 'makefile'
  if (base === 'dockerfile' || base.startsWith('dockerfile.')) return 'dockerfile'
  if (base === 'cmakelists.txt') return 'cmake'
  if (base === '.gitignore' || base === '.npmignore' || base === '.dockerignore') return 'bash'
  const first = text.slice(0, 200)
  // `#!/usr/bin/env python3` 与 `#!/bin/bash` 都要认：先吃掉路径，再可选吃掉 env，最后取命令名
  const sh = /^#!\s*(?:\S*\/)?(?:env\s+)?([A-Za-z0-9_.-]+)/.exec(first)
  if (sh) {
    const name = (sh[1] ?? '').toLowerCase()
    if (name.startsWith('python')) return 'python'
    if (name === 'sh' || name === 'bash' || name === 'zsh' || name === 'fish') return 'bash'
    if (name.startsWith('node')) return 'javascript'
    if (name === 'pwsh' || name === 'powershell') return 'powershell'
    if (name === 'ruby') return 'ruby'
    if (name === 'perl') return 'perl'
  }
  return undefined
}

/** 扩展名（小写，不含点） */
function extOf(path: string): string {
  const base = path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? ''
  const dot = base.lastIndexOf('.')
  return dot <= 0 ? '' : base.slice(dot + 1).toLowerCase()
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 这个路径是否属于「代码/配置」（有可用着色语言，或 Makefile/Dockerfile 这类特殊文件名）。
 *  预览家族判定用它把 .py/.go/.yml/.sh… 归到「代码预览」开关下，而不是笼统当纯文本。 */
export function isCodePath(path: string): boolean {
  const explicit = LANG_BY_EXT[extOf(path)]
  if (explicit !== undefined && hljs.getLanguage(explicit) != null) return true
  return langFromNameOrShebang(path, '') !== undefined
}

/** 一次着色的结果：HTML + 实际用的语言 id（`plain` 表示没着色） */
export type HighlightResult = { html: string; lang: string }

/**
 * 给一段代码着色。识别失败/异常一律退化为转义后的原文（绝不因为着色把预览搞崩）。
 */
export function highlightCode(text: string, path: string): HighlightResult {
  const ext = extOf(path)
  const explicit = LANG_BY_EXT[ext] ?? langFromNameOrShebang(path, text)
  try {
    if (explicit !== undefined && hljs.getLanguage(explicit) !== null && hljs.getLanguage(explicit) !== undefined) {
      return { html: hljs.highlight(text, { language: explicit, ignoreIllegals: true }).value, lang: explicit }
    }
    if (explicit === undefined && !PLAIN_EXT.test(ext) && text.length <= AUTO_MAX_BYTES) {
      const auto = hljs.highlightAuto(text)
      // 自动判定结果太弱（relevance 低）就当纯文本，别给自然语言乱上色
      if (auto.language !== undefined && auto.relevance >= 5) return { html: auto.value, lang: auto.language }
    }
  } catch { /* 退化 */ }
  return { html: escapeHtml(text), lang: 'plain' }
}

/** 行号列文本（1..n） */export function lineNumbersOf(text: string): string {
  const count = text.length === 0 ? 1 : text.split('\n').length
  let out = ''
  for (let i = 1; i <= count; i++) out += (i === 1 ? '' : '\n') + i
  return out
}

/** markdown 围栏里常见的短写 → highlight.js 的正式语言 id */
const FENCE_ALIAS: Record<string, string> = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', tsx: 'typescript', py: 'python', rb: 'ruby', rs: 'rust',
  sh: 'bash', shell: 'bash', zsh: 'bash', ps: 'powershell', pwsh: 'powershell',
  yml: 'yaml', md: 'markdown', docker: 'dockerfile', 'c++': 'cpp', 'c#': 'csharp', htm: 'xml',
}

/**
 * markdown 围栏代码块（```lang）用：返回 highlight.js 的 span 标记。
 * 返回空串表示「按默认渲染」（markdown-it 会自己包 `<pre><code>`）——语言认不出、或自动判定
 * 结果太弱时就走这条路，不给普通文本乱上色。外层容器带 `dsh-mt_hlDark/Light` 时颜色才对。
 */
export function highlightFence(code: string, lang: string): string {
  const raw = (lang || '').trim().toLowerCase()
  // 没标语言就不猜（VS Code 对无标注围栏也是纯文本），交回默认渲染
  if (raw === '') return ''
  const target = FENCE_ALIAS[raw] ?? raw
  try {
    if (hljs.getLanguage(target) != null) {
      return hljs.highlight(code, { language: target, ignoreIllegals: true }).value
    }
  } catch { /* 退化到默认渲染 */ }
  return ''
}
