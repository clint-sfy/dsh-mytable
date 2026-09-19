import { Context } from '@deepseek-ai/cordis'
import { execFile } from 'node:child_process'
import { readdirSync, realpathSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { basename, dirname, resolve as pathResolve, sep } from 'node:path'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { extractFrameAncestors, type BrowserProbeResult } from './browser-policy'

/**
 * 基础数据目录解析：不加载任何官方包（loadPkg 的兜底只能用它，禁止反向调用包加载函数——否则成环）。
 * 规则与官方 @deepseek-ai/dsh-home-paths 的 resolveDshHome 一致：
 *   DSH_HOME 环境变量优先（空/纯空白视为未设置），否则 ~/.dsh；
 *   支持 ~、~/、~\ 前缀展开；相对路径按进程 cwd 解析；结果归一为绝对路径。
 * 禁止任何业务代码直接拼 homedir()/.dsh —— 自定义 DSH_HOME（Desktop/隔离测试）会读错数据。
 */
function baseDshHome(): string {
  const env = process.env.DSH_HOME
  // 与官方一致：trim 只用于判断是否全空白，实际路径保留原字符串（两端空格有含义）
  const value = env !== undefined && env.trim().length > 0 ? env : pathResolve(homedir(), '.dsh')
  if (value === '~') return homedir()
  if (value.startsWith('~/') || value.startsWith('~\\')) return pathResolve(homedir(), value.slice(2))
  return pathResolve(value)
}

/** 解析 DSH 数据根目录：优先官方 @deepseek-ai/dsh-home-paths（显式配置/DSH_HOME/默认），
 *  不可用或返回非法值时回退 baseDshHome()（同官方规则）。带缓存。 */
let cachedDshHome: string | null = null
/** 本次解析实际走了哪条路径（供测试断言官方包是否真的被使用） */
let dshHomeSource: 'official' | 'fallback' = 'fallback'
function resolveDshHomeSafe(): string {
  if (cachedDshHome) return cachedDshHome
  try {
    const pkg = loadPkg('@deepseek-ai/dsh-home-paths') as any
    if (pkg && typeof pkg.resolveDshHome === 'function') {
      const home = pkg.resolveDshHome(undefined, process.env)
      if (typeof home === 'string' && home.trim() !== '') {
        dshHomeSource = 'official'
        cachedDshHome = home
        return cachedDshHome
      }
    }
  } catch {}
  dshHomeSource = 'fallback'
  cachedDshHome = baseDshHome()
  return cachedDshHome
}

/**
 * dsh-mytable 服务端：健康路由 + 工作区内容窗的数据路由（路由前缀 /api/worktable/* 为插件私有协议，保持不变）。
 * 参考 dsh-better-sidebar 的架构——内容窗能力由本插件自己的服务端路由提供：
 *   - POST /api/worktable/fs     目录列表（资源管理器窗）
 *   - POST /api/worktable/git    git 状态（源代码管理窗）
 *   - WS   /api/worktable/term   node-pty 终端流（终端窗；依赖宿主 node_modules 中的
 *                                node-pty 与 ws，缺失时该路由不注册、终端窗降级提示）
 */

declare const __WT_VERSION__: string
const PLUGIN_VERSION = typeof __WT_VERSION__ === 'undefined' ? 'dev' : __WT_VERSION__

export const name = 'dsh-mytable'
export const inject = ['webServer', 'sessions']

export const HEALTH_PATH = '/api/worktable/health'
/** 浏览器窗的目标站点探测路由（见 apply 内注释） */
export const BROWSER_PROBE_PATH = '/api/worktable/browser/probe'

const MAX_ENTRIES = 500

/** 本地文件/站点静态资源的 MIME 映射（file 与 site 两条路由共用） */
const FILE_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8', map: 'application/json; charset=utf-8',
  md: 'text/markdown; charset=utf-8', markdown: 'text/markdown; charset=utf-8',
  txt: 'text/plain; charset=utf-8', log: 'text/plain; charset=utf-8',
  pdf: 'application/pdf', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', ico: 'image/x-icon', avif: 'image/avif',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
  wasm: 'application/wasm', mp3: 'audio/mpeg', mp4: 'video/mp4', webm: 'video/webm',
  // 文本/配置类（预览里当文本或代码读；MIME 给对，浏览器就不会乱猜）
  xml: 'application/xml; charset=utf-8', yml: 'text/yaml; charset=utf-8', yaml: 'text/yaml; charset=utf-8',
  toml: 'text/plain; charset=utf-8', ini: 'text/plain; charset=utf-8', conf: 'text/plain; charset=utf-8',
  csv: 'text/csv; charset=utf-8', tsv: 'text/tab-separated-values; charset=utf-8',
  py: 'text/x-python; charset=utf-8', sh: 'text/x-shellscript; charset=utf-8',
  ps1: 'text/plain; charset=utf-8', bat: 'text/plain; charset=utf-8', sql: 'text/plain; charset=utf-8',
  // 音频 / 视频（浏览器内置播放器要认这些类型，否则只给一个下载）
  wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac',
  flac: 'audio/flac', opus: 'audio/opus', weba: 'audio/webm',
  ogv: 'video/ogg', mov: 'video/quicktime', m4v: 'video/x-m4v', mkv: 'video/x-matroska', avi: 'video/x-msvideo',
  // Office 文档与压缩包：不内嵌渲染，但要给对 MIME（「在浏览器中打开」时按正确类型下载）
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text', ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation', rtf: 'application/rtf',
  zip: 'application/zip', gz: 'application/gzip', tgz: 'application/gzip', tar: 'application/x-tar',
  '7z': 'application/x-7z-compressed', rar: 'application/vnd.rar', jar: 'application/java-archive',
  exe: 'application/vnd.microsoft.portable-executable', dll: 'application/vnd.microsoft.portable-executable',
  iso: 'application/x-iso9660-image', dmg: 'application/x-apple-diskimage',
  db: 'application/vnd.sqlite3', sqlite: 'application/vnd.sqlite3', sqlite3: 'application/vnd.sqlite3',
}

const SITE_PREFIX = '/api/worktable/site'

// 原生皮肤模板（esbuild text loader 嵌入；/api/worktable/template 路由直接下发）
// @ts-ignore
import dshellCss from '../template/dshell.css'
// @ts-ignore
import dshellHtml from '../template/dshell.html'
const TEMPLATE_PREFIX = '/api/worktable/template'

/**
 * 从本插件模块位置向祖先方向查找并加载 node_modules 包（如 ws / node-pty）。
 * 本包经 junction 链接进 profile，普通 import 可能解析不到 profile 级依赖；
 * 同时尝试 junction 路径与 realpath 两条祖先链。
 */
/** 依赖探测尝试计数（供测试断言「有界探测、无循环重入」） */
let loadProbeAttempts = 0
function loadPkg(pkg: string): any | null {
  const starts = new Set<string>()
  try { starts.add(dirname(fileURLToPath(import.meta.url))) } catch {}
  try { starts.add(realpathSync(dirname(fileURLToPath(import.meta.url)))) } catch {}
  for (const start of starts) {
    let dir: string | null = start
    while (dir && dir !== pathResolve(dir, '..')) {
      loadProbeAttempts++
      try {
        const req = createRequire(pathToFileURL(pathResolve(dir, '__wt_probe__.js')).href)
        return req(pkg)
      } catch {}
      dir = pathResolve(dir, '..')
    }
  }
  // 兜底：DSH profiles/*/node_modules（按 baseDshHome 解析根目录——不能用 resolveDshHomeSafe，否则与本函数成环）
  try {
    const profilesDir = pathResolve(baseDshHome(), 'profiles')
    for (const profile of readdirSync(profilesDir, { withFileTypes: true })) {
      if (!profile.isDirectory() && !profile.isSymbolicLink()) continue
      const nm = pathResolve(profilesDir, profile.name, 'node_modules')
      loadProbeAttempts++
      try {
        const req = createRequire(pathToFileURL(pathResolve(nm, '__wt_probe__.js')).href)
        return req(pkg)
      } catch {}
    }
  } catch {}
  return null
}

/** 测试钩子：依赖探测尝试次数 + 数据目录解析路径（循环回归与官方路径断言用） */
export function __wtLoadProbeStats(): { attempts: number; homeSource: 'official' | 'fallback' } {
  return { attempts: loadProbeAttempts, homeSource: dshHomeSource }
}

/** 解析会话工作目录：服务端 header.cwd 优先，其次客户端传入 cwd，最后进程 cwd */
function serverCwd(ctx: any, sessionId?: string, clientCwd?: string): string {
  if (sessionId) {
    try {
      const headerCwd = ctx.sessions?.get?.(sessionId)?.header?.cwd
      if (typeof headerCwd === 'string' && headerCwd) return headerCwd
    } catch {}
  }
  if (typeof clientCwd === 'string' && clientCwd) return clientCwd
  return process.cwd()
}

function json(res: any, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

async function readJsonBody(req: any): Promise<any> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  const text = Buffer.concat(chunks).toString('utf8')
  if (!text) return {}
  try { return JSON.parse(text) } catch { return {} }
}

/** 列出一个目录层级（目录在前、大小写不敏感排序、上限 500、隐藏项标注） */
async function listDirectory(path: string) {
  const abs = pathResolve(path)
  const dirents = await readdir(abs, { withFileTypes: true })
  const entries = dirents
    .map((d) => ({ name: d.name, path: abs + sep + d.name, isDir: d.isDirectory(), hidden: d.name.startsWith('.') }))
    .sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
  const truncated = entries.length > MAX_ENTRIES
  return { path: abs, entries: truncated ? entries.slice(0, MAX_ENTRIES) : entries, truncated }
}

/** 搜索上限：大仓库下保证有界（命中数 / 扫描数 / 深度三个闸） */
const SEARCH_MAX_RESULTS = 200
const SEARCH_MAX_SCAN = 20000
const SEARCH_MAX_DEPTH = 12
/** 递归时整棵跳过的目录（依赖与产物目录，命中它们的价值远低于代价） */
const SEARCH_SKIP_DIRS = new Set([
  'node_modules', '.git', '.hg', '.svn', 'dist', 'build', 'out', 'target',
  '__pycache__', '.venv', 'venv', '.cache', '.next', '.nuxt', '.turbo', 'coverage',
])

/**
 * 按名字/相对路径子串搜索（大小写不敏感）。目录优先、结果上限 200、扫描上限 20000、
 * 深度上限 12；跳过大目录；权限错误逐目录忽略（不因一个目录没权限就整体失败）。
 */
async function searchByName(root: string, query: string) {
  const needle = query.toLowerCase()
  const entries: Array<{ name: string; path: string; isDir: boolean; hidden: boolean }> = []
  let scanned = 0
  let truncated = false
  const walk = async (dir: string, depth: number): Promise<void> => {
    if (truncated || depth > SEARCH_MAX_DEPTH) return
    let dirents: Awaited<ReturnType<typeof readdir>>
    try {
      dirents = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    const dirs: string[] = []
    for (const d of dirents) {
      if (scanned >= SEARCH_MAX_SCAN) { truncated = true; return }
      scanned++
      const abs = dir + sep + d.name
      const isDir = d.isDirectory()
      const rel = abs.slice(root.length + 1)
      if (d.name.toLowerCase().includes(needle) || rel.toLowerCase().includes(needle)) {
        entries.push({ name: d.name, path: abs, isDir, hidden: d.name.startsWith('.') })
        if (entries.length >= SEARCH_MAX_RESULTS) { truncated = true; return }
      }
      if (isDir && !SEARCH_SKIP_DIRS.has(d.name)) dirs.push(abs)
    }
    for (const sub of dirs) await walk(sub, depth + 1)
  }
  await walk(root, 0)
  entries.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
    return a.path.localeCompare(b.path, undefined, { sensitivity: 'base' })
  })
  return { root, entries, scanned, truncated }
}

function gitExec(args: string[], cwd: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    execFile('git', args, { cwd, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      if (err) reject(err)
      else resolvePromise(stdout)
    })
  })
}

/** 会话事件里工具结果文本的截断上限（事件日志可能带很大的结果） */
const OPS_TEXT_MAX = 100 * 1024

/** 把一条会话事件收窄成「折叠文件操作」所需的字段（tool/call 的名字/参数、tool/result 的文本/错误位） */
function narrowOpsEvent(ev: any): any {
  if (ev?.type === 'tool/call') {
    const d = ev.data ?? {}
    return {
      seq: ev.seq, time: ev.time, type: 'tool/call',
      data: {
        name: typeof d.name === 'string' ? d.name : '',
        callId: typeof d.callId === 'string' ? d.callId : '',
        arguments: typeof d.arguments === 'string' ? d.arguments.slice(0, OPS_TEXT_MAX) : '',
      },
    }
  }
  const message = ev?.data?.message ?? {}
  const blocks = Array.isArray(message.content) ? message.content : []
  const outBlocks: any[] = []
  for (const block of blocks) {
    if (block === null || typeof block !== 'object' || block.type !== 'tool-result') continue
    const inner = Array.isArray(block.content) ? block.content : []
    const texts: any[] = []
    for (const item of inner) {
      if (item !== null && typeof item === 'object' && item.type === 'text' && typeof item.text === 'string') {
        texts.push({ type: 'text', text: item.text.slice(0, OPS_TEXT_MAX) })
      }
    }
    outBlocks.push({ type: 'tool-result', isError: block.isError === true, content: texts })
  }
  return {
    seq: ev.seq, time: ev.time, type: 'tool/result',
    data: { message: { source: { callId: typeof message?.source?.callId === 'string' ? message.source.callId : '' }, content: outBlocks } },
  }
}

/** 一轮里给界面看的统计（用户输入 / 最终输出 / token 用量 / 工具调用数 / 属于哪一层问答） */
type TurnStat = {
  turn: number
  /** 属于第几层「问答」（人打的一条消息开一层；续跑轮归到最近那一层） */
  qa: number
  time: number
  endTime?: number
  /** 事件序号范围（排查归属用） */
  startSeq?: number
  endSeq?: number
  input: string
  output: string
  tools: number
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number; reasoning: number; total: number; calls: number }
}
/** 单条文本的传输上限（用户输入 / 最终输出各自截到这里，避免长回合把响应撑大） */
const TURN_TEXT_MAX = 4000

function makeTurnStat(turn: number, time: number): TurnStat {
  return {
    turn, qa: 0, time, input: '', output: '', tools: 0,
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, total: 0, calls: 0 },
  }
}

function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text
}

/** 消息正文里的文本块拼起来（assistant 的最终输出、user 的输入都走这里） */
function messageText(message: any): string {
  const blocks = Array.isArray(message?.content) ? message.content : []
  const parts: string[] = []
  for (const b of blocks) {
    if (b !== null && typeof b === 'object' && b.type === 'text' && typeof b.text === 'string') parts.push(b.text)
  }
  return parts.join('\n').trim()
}

/** 把一个 step 的 usage 累加到本轮（字段缺失按 0；calls 记住结算了几步） */
function addUsage(stat: TurnStat, usage: any): void {
  if (usage === null || typeof usage !== 'object') return
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0)
  stat.usage.input += num(usage.inputTokens)
  stat.usage.output += num(usage.outputTokens)
  stat.usage.cacheRead += num(usage.cacheReadTokens)
  stat.usage.cacheWrite += num(usage.cacheWriteTokens)
  stat.usage.reasoning += num(usage.reasoningTokens)
  stat.usage.total += num(usage.totalTokens) || (num(usage.inputTokens) + num(usage.outputTokens))
  stat.usage.calls += 1
}

/**
 * 一个子会话的「最后活动」：从它自己的事件日志尾部往回找最近的一条助手文本与最近一次工具调用
 * （对齐 DSH-better-sidebar 的 `subagent-activity.lastActivity`）。
 * 只读快照，不改任何状态；找不到就返回空对象。
 */
function lastActivityOf(events: readonly any[]): { text?: string; tool?: { name: string; args: string } } {
  const out: { text?: string; tool?: { name: string; args: string } } = {}
  const argsOf = (raw: unknown): string => {
    if (typeof raw !== 'string' || raw === '') return ''
    try {
      const parsed = JSON.parse(raw)
      if (parsed !== null && typeof parsed === 'object') {
        const first = Object.values(parsed as Record<string, unknown>).find((v) => typeof v === 'string')
        if (typeof first === 'string') return first.replace(/\s+/g, ' ').trim()
      }
    } catch { /* 不是 JSON 就原样给 */ }
    return raw.replace(/\s+/g, ' ').trim()
  }
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i]
    if (ev?.type === 'tool/call' && out.tool === undefined) {
      const d = ev.data ?? {}
      if (typeof d.name === 'string' && d.name !== '') {
        out.tool = { name: d.name, args: argsOf(d.arguments).slice(0, 400) }
      }
    } else if (ev?.type === 'assistant/message' && out.text === undefined) {
      const blocks = Array.isArray(ev?.data?.message?.content) ? ev.data.message.content : []
      const parts: string[] = []
      for (const b of blocks) {
        if (b !== null && typeof b === 'object' && b.type === 'text' && typeof b.text === 'string') parts.push(b.text)
      }
      const text = parts.join('\n').trim()
      if (text !== '') out.text = text.slice(0, 1200)
    }
    if (out.text !== undefined && out.tool !== undefined) break
  }
  return out
}

/** git 仓库探测：path 所在仓库根（不在仓库里返回 null） */
async function gitRootOf(path: string): Promise<string | null> {
  try {
    const out = await gitExec(['rev-parse', '--show-toplevel'], path)
    const root = out.trim()
    return root === '' ? null : pathResolve(root)
  } catch {
    return null
  }
}

/** 当前分支名（detached 时用短 hash；失败给空串） */
async function branchOf(root: string): Promise<string> {
  try {
    const out = await gitExec(['rev-parse', '--abbrev-ref', 'HEAD'], root)
    const name = out.trim()
    if (name === '' || name === 'HEAD') {
      const sha = await gitExec(['rev-parse', '--short', 'HEAD'], root)
      return sha.trim()
    }
    return name
  } catch {
    return ''
  }
}

/** 已改动的文件数（staged + unstaged + untracked，按路径去重） */
async function changeCountOf(root: string): Promise<number> {
  try {
    const out = await gitExec(['status', '--porcelain'], root)
    const paths = new Set<string>()
    for (const line of out.split(/\r?\n/)) {
      if (line.trim() === '') continue
      const p = line.slice(3).trim().replace(/^"|"$/g, '')
      const arrow = p.indexOf(' -> ')
      paths.add(arrow === -1 ? p : p.slice(arrow + 4))
    }
    return paths.size
  } catch {
    return 0
  }
}

/**
 * 本地分支名（当前分支排最前；detached 时把 HEAD 的短 sha 也放进去当唯一项）。
 * 对齐 DSH-better-sidebar 的 `git for-each-ref --format=%(refname:short) refs/heads`——
 * 不用 `git branch`，因为后者的 `*`/颜色/`(HEAD detached …)` 都要再解析。
 */
async function branchNamesOf(root: string): Promise<{ current: string; names: string[] }> {
  const current = await branchOf(root)
  let names: string[] = []
  try {
    const out = await gitExec(['for-each-ref', '--format=%(refname:short)', 'refs/heads'], root)
    names = out.split(/\r?\n/).map((s) => s.trim()).filter((s) => s !== '')
  } catch { names = [] }
  if (current !== '' && !names.includes(current)) names = [current, ...names]
  return { current, names }
}

/**
 * 仓库发现（对齐 DSH-better-sidebar 的 repoRoots）：
 *   1. cwd 自己在仓库里（含「cwd 是仓库子目录」的情况）→ 就用它；
 *   2. 否则看 **直接子目录**（跳过点目录与 node_modules，有数量上限）里哪些是仓库；
 *   3. 还是空 → 再向下多探两层（有界：目录数/结果数两闸），工作区里嵌套一层项目也能找到。
 * 早期版本只做「深度 3 递归 + 400 目录」的深度优先扫描，遇到大目录会把预算耗光而漏掉同级仓库，
 * 这里改成参考实现的「先看一层、再看两层补充」。
 */
const REPO_CHILD_LIMIT = 60
const REPO_DEEP_MAX_DEPTH = 3
const REPO_DEEP_MAX_DIRS = 300
const REPO_MAX_REPOS = 20
const REPO_SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'out', 'target', '.cache', '.venv', 'venv', '__pycache__', 'coverage'])
function isSkippableDir(name: string): boolean {
  return name.startsWith('.') || REPO_SKIP_DIRS.has(name)
}
type RepoEntry = { path: string; name: string; branch: string; changes: number }
async function discoverRepos(base: string): Promise<{ root: string; repos: RepoEntry[]; searched: string }> {
  const abs = pathResolve(base)
  const self = await gitRootOf(abs)
  if (self !== null) {
    const one: RepoEntry = { path: self, name: basename(self), branch: await branchOf(self), changes: await changeCountOf(self) }
    return { root: abs, repos: [one], searched: abs }
  }
  const repos: RepoEntry[] = []
  const seen = new Set<string>()
  const add = async (p: string): Promise<void> => {
    const abs2 = pathResolve(p)
    const key = abs2.toLowerCase()
    if (seen.has(key) || repos.length >= REPO_MAX_REPOS) return
    seen.add(key)
    repos.push({ path: abs2, name: basename(abs2), branch: await branchOf(abs2), changes: await changeCountOf(abs2) })
  }
  // 1) 直接子目录（最像「工作区下面是各个项目」的结构）
  let children: Awaited<ReturnType<typeof readdir>> = []
  try {
    children = await readdir(abs, { withFileTypes: true })
  } catch {
    children = []
  }
  const dirs = children
    .filter((d) => d.isDirectory() && !isSkippableDir(d.name))
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .slice(0, REPO_CHILD_LIMIT)
  for (const name of dirs) {
    const root = await gitRootOf(abs + sep + name)
    if (root !== null) await add(root)
  }
  // 2) 还没有 → 向下再探两层（有界）
  if (repos.length === 0) {
    let scanned = 0
    const walk = async (dir: string, depth: number): Promise<void> => {
      if (depth > REPO_DEEP_MAX_DEPTH || repos.length >= REPO_MAX_REPOS || scanned >= REPO_DEEP_MAX_DIRS) return
      let entries: Awaited<ReturnType<typeof readdir>>
      try {
        entries = await readdir(dir, { withFileTypes: true })
      } catch {
        return
      }
      if (entries.some((d) => d.isDirectory() && d.name === '.git')) {
        await add(dir)
        return
      }
      for (const d of entries) {
        if (!d.isDirectory() || isSkippableDir(d.name)) continue
        if (scanned >= REPO_DEEP_MAX_DIRS) return
        scanned++
        await walk(dir + sep + d.name, depth + 1)
      }
    }
    await walk(abs, 0)
  }
  // 有改动的仓库排前面，其次是名字（这样面板默认选中的就是「有东西可看」的那个）
  repos.sort((a, b) => (b.changes - a.changes) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  return { root: abs, repos, searched: abs }
}

/** 逐文件的 diff 上限（防超大改动把响应撑爆） */
const DIFF_MAX_FILES = 60
const DIFF_MAX_BYTES_PER_FILE = 400 * 1024
const DIFF_MAX_BYTES_TOTAL = 2 * 1024 * 1024
/** 未跟踪文件合成 diff 时的行数上限（新文件可能有几万行） */
const DIFF_UNTRACKED_MAX_LINES = 4000

/** 把「整份新文件」合成为一条 unified diff（未跟踪文件 / 空仓库里的文件） */
function synthesizeAddedDiff(rel: string, text: string): { diff: string; additions: number } {
  const lines = text.split('\n')
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  const shown = lines.slice(0, DIFF_UNTRACKED_MAX_LINES)
  const body = shown.map((l) => '+' + l).join('\n')
  const diff = `--- /dev/null\n+++ b/${rel}\n@@ -0,0 +1,${shown.length} @@\n${body}\n`
  return { diff, additions: shown.length }
}

/** 一段 unified diff 的增删计数 */
function countDiffLines(diff: string): { additions: number; deletions: number } {
  let additions = 0
  let deletions = 0
  for (const line of diff.split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) additions++
    else if (line.startsWith('-') && !line.startsWith('---')) deletions++
  }
  return { additions, deletions }
}

/** 把 `git diff` 输出按文件切开（键 = b/ 侧相对路径） */
function splitDiffByFile(diffText: string): Map<string, string> {
  const chunks = new Map<string, string>()
  for (const part of diffText.split(/^(?=diff --git )/m)) {
    if (!part.startsWith('diff --git ')) continue
    const m = /^diff --git a\/(.+?) b\/(.+)$/m.exec(part)
    const rel = (m?.[2] ?? '').trim()
    if (rel !== '') chunks.set(rel, part)
  }
  return chunks
}

/**
 * 工作区改动 + 每个文件的 unified diff，**已暂存与未暂存分开**（对齐编辑器的 SCM 视图）：
 *   - `staged`   = `git diff --cached`（进了索引的改动）
 *   - `unstaged` = `git diff`（工作区里还没进索引的改动）
 *   - 未跟踪文件 git 不给 diff，按「整份新增」合成到 unstaged；
 *   - 空仓库（没有 HEAD）时所有文件按新增合成；
 *   - 单文件查询给 path 就只回该文件。
 */
async function workspaceChanges(root: string, onlyPath?: string): Promise<{
  isRepo: boolean
  root: string
  branch: string
  files: Array<{
    path: string
    rel: string
    status: string
    untracked: boolean
    staged?: { diff: string; additions: number; deletions: number }
    unstaged?: { diff: string; additions: number; deletions: number }
  }>
  truncated: boolean
}> {
  let branch = ''
  try { branch = (await gitExec(['rev-parse', '--abbrev-ref', 'HEAD'], root)).trim() } catch { branch = '' }
  const hasHead = await gitExec(['rev-parse', '--verify', 'HEAD'], root).then(() => true).catch(() => false)
  let porcelain = ''
  try { porcelain = await gitExec(['status', '--porcelain=v1', '-z'], root) } catch { porcelain = '' }
  const entries = porcelain.split('\0').filter((s) => s.length > 2).map((chunk) => ({
    status: chunk.slice(0, 2),
    rel: chunk.slice(3).replace(/\\/g, '/'),
  }))
  const wantRel = (rel: string): boolean => onlyPath === undefined || pathResolve(root, rel) === pathResolve(onlyPath)

  const stagedChunks = new Map<string, string>()
  const unstagedChunks = new Map<string, string>()
  if (hasHead) {
    const pathArg = onlyPath !== undefined ? ['--', onlyPath] : []
    try { for (const [k, v] of splitDiffByFile(await gitExec(['diff', '--no-color', '-U3', '--cached', ...pathArg], root))) stagedChunks.set(k, v) } catch { /* 忽略 */ }
    try { for (const [k, v] of splitDiffByFile(await gitExec(['diff', '--no-color', '-U3', ...pathArg], root))) unstagedChunks.set(k, v) } catch { /* 忽略 */ }
  }

  const files: Array<{
    path: string
    rel: string
    status: string
    untracked: boolean
    staged?: { diff: string; additions: number; deletions: number }
    unstaged?: { diff: string; additions: number; deletions: number }
  }> = []
  let truncated = false
  let totalBytes = 0
  const cap = (diff: string): string | null => {
    if (diff.length > DIFF_MAX_BYTES_PER_FILE) { truncated = true; return diff.slice(0, DIFF_MAX_BYTES_PER_FILE) }
    if (totalBytes + diff.length > DIFF_MAX_BYTES_TOTAL) { truncated = true; return null }
    totalBytes += diff.length
    return diff
  }
  for (const entry of entries) {
    if (!wantRel(entry.rel)) continue
    if (files.length >= DIFF_MAX_FILES) { truncated = true; break }
    const isUntracked = entry.status === '??'
    const item: (typeof files)[number] = { path: pathResolve(root, entry.rel), rel: entry.rel, status: entry.status, untracked: isUntracked }
    // 索引侧（X）与工作区侧（Y）：porcelain 的两位分别代表二者
    const x = entry.status[0] ?? ' '
    const y = entry.status[1] ?? ' '
    const stagedDiff = stagedChunks.get(entry.rel)
    if (x !== ' ' && x !== '?' && stagedDiff !== undefined) {
      const d = cap(stagedDiff)
      if (d !== null) item.staged = { diff: d, ...countDiffLines(d) }
    }
    const workDiff = unstagedChunks.get(entry.rel)
    if (isUntracked) {
      try {
        const text = await readFile(pathResolve(root, entry.rel), 'utf8')
        const d = cap(synthesizeAddedDiff(entry.rel, text).diff)
        if (d !== null) item.unstaged = { diff: d, ...countDiffLines(d) }
      } catch { /* 二进制 / 读不了：只留在清单里 */ }
    } else if (y !== ' ' && workDiff !== undefined) {
      const d = cap(workDiff)
      if (d !== null) item.unstaged = { diff: d, ...countDiffLines(d) }
    } else if (!hasHead) {
      try {
        const text = await readFile(pathResolve(root, entry.rel), 'utf8')
        const d = cap(synthesizeAddedDiff(entry.rel, text).diff)
        if (d !== null) item.unstaged = { diff: d, ...countDiffLines(d) }
      } catch { /* 跳过 */ }
    }
    files.push(item)
  }
  return { isRepo: true, root, branch: branch === 'HEAD' ? '' : branch, files, truncated }
}

/** 一次 git 子命令（写操作）：失败把 stderr 原文带回去给界面显示 */
async function gitRun(root: string, args: string[]): Promise<{ ok: boolean; output: string }> {
  try {
    const out = await gitExec(args, root)
    return { ok: true, output: out.trim() }
  } catch (err: any) {
    const detail = String(err?.stderr ?? err?.message ?? err).trim()
    return { ok: false, output: detail.slice(0, 2000) }
  }
}

/**
 * 提交历史（一页 N 条）：hash / 短 hash / 作者 / 时间 / 标题 / 引用装饰。
 * `%D` 是 `git log --decorate` 的引用列表（HEAD -> main, origin/main, tag: v1 …），
 * 参考实现也把它显示在行里——一眼能看出哪些提交是分叉上的、哪些打了 tag。
 */
async function gitLogPage(root: string, limit: number, skip: number): Promise<{ isRepo: boolean; root: string; commits: Array<{ hash: string; short: string; author: string; time: number; subject: string; refs: string[] }> }> {
  const out = await gitRun(root, ['log', `--max-count=${limit}`, `--skip=${skip}`, '--decorate=short', '--pretty=format:%H%x1f%h%x1f%an%x1f%at%x1f%s%x1f%D'])
  if (!out.ok) return { isRepo: true, root, commits: [] }
  const commits = out.output.split('\n').filter((l) => l.trim() !== '').map((line) => {
    const [hash = '', short = '', author = '', at = '0', subject = '', refs = ''] = line.split('\x1f')
    const refNames = refs.split(',').map((s) => s.trim()).filter((s) => s !== '' && s !== 'HEAD')
    return { hash, short, author, time: Number(at) * 1000, subject, refs: refNames }
  })
  return { isRepo: true, root, commits }
}

/** git 状态快照（porcelain v1 -z；非仓库返回 isRepo:false） */
async function gitStatus(cwd: string) {
  try {
    const branchRaw = await gitExec(['rev-parse', '--abbrev-ref', 'HEAD'], cwd)
    const porcelain = await gitExec(['status', '--porcelain=v1', '-z'], cwd)
    const entries = porcelain
      .split('\0')
      .filter((s) => s.length > 2)
      .map((s) => ({ xy: s.slice(0, 2), path: s.slice(3) }))
    return { isRepo: true, branch: branchRaw.trim() || 'HEAD', entries }
  } catch {
    return { isRepo: false, branch: undefined, entries: [] }
  }
}

/** 终端 WebSocket 升级路由（同步注册 + ctx.effect，同 better-sidebar；node-pty 缺失时不注册） */
function setupTerminal(webServer: any, ctx: any) {
  if (typeof webServer.registerUpgrade !== 'function') return
  const wsMod = loadPkg('ws')
  const ptyMod = loadPkg('node-pty')
  ctx.logger?.info?.('[dsh-mytable] term deps: ws=' + (wsMod ? 'ok' : 'MISSING') + ' node-pty=' + (ptyMod ? 'ok' : 'MISSING'))
  if (!wsMod || !ptyMod) {
    ctx.logger?.warn('[dsh-mytable] 终端路由未注册：ws/node-pty 不可用')
    return
  }
  const WebSocketServer = wsMod.WebSocketServer ?? wsMod.default?.WebSocketServer
  if (!WebSocketServer) return
  const pty = ptyMod.default ?? ptyMod
  const wss = new WebSocketServer({ noServer: true })
  const spawnShell = (): { cmd: string; args: string[] } =>
    process.platform === 'win32'
      // 不带 -NoProfile / -NoLogo：加载用户个人配置（conda init 的 (base) 环境、别名、函数都在这里），
      // 与 DSH-better-sidebar 的默认起法一致（其 shellArgs 默认为空）。代价是首屏有 PowerShell 横幅、启动略慢。
      ? { cmd: 'powershell.exe', args: [] }
      : { cmd: process.env.SHELL || '/bin/bash', args: [] }
  const clampDim = (v: number, fallback: number) => Math.min(1024, Math.max(2, Number.isFinite(v) ? v : fallback))

  ctx.effect(() => webServer.registerUpgrade({
    path: '/api/worktable/term',
    handler: (req: any, socket: any, head: any) => {
      wss.handleUpgrade(req, socket, head, (ws: any) => {
        const u = new URL(req.url ?? '/', 'http://dsh.internal')
        const cwd = serverCwd(ctx, u.searchParams.get('sessionId') || undefined, u.searchParams.get('cwd') || undefined)
        const cols = clampDim(Number(u.searchParams.get('cols')), 80)
        const rows = clampDim(Number(u.searchParams.get('rows')), 24)
        let term: any = null
        try {
          const shell = spawnShell()
          term = pty.spawn(shell.cmd, shell.args, { name: 'xterm-256color', cols, rows, cwd, env: process.env })
        } catch (err) {
          try { ws.send('\r\n[worktable] 终端启动失败：' + String(err)) } catch {}
          try { ws.close() } catch {}
          return
        }
        term.onData((d: string) => { try { ws.send(d) } catch {} })
        term.onExit(() => { try { ws.close() } catch {} })
        ws.on('message', (raw: any) => {
          const text = String(raw)
          try {
            const msg = JSON.parse(text)
            if (msg && msg.type === 'resize' && Number.isFinite(msg.cols) && Number.isFinite(msg.rows)) {
              term.resize(clampDim(msg.cols, cols), clampDim(msg.rows, rows))
              return
            }
          } catch {}
          try { term.write(text) } catch {}
        })
        ws.on('close', () => { try { term.kill() } catch {} })
      })
    },
  }), 'dsh-mytable: terminal upgrade')
}

export function apply(ctx: Context) {
  const webServer = (ctx as any).webServer
  if (!webServer) {
    ctx.logger?.warn('[dsh-mytable] ctx.webServer 不可用（headless profile？），跳过服务端路由')
    return
  }

  webServer.register({
    kind: 'exact',
    path: HEALTH_PATH,
    handler: (_req: any, res: any) => {
      json(res, 200, { plugin: 'dsh-mytable', version: PLUGIN_VERSION, ok: true })
    },
  })

  // 浏览器窗的目标站点探测：宿主代取响应头，客户端据此判断该站点能不能被 iframe 嵌入
  // （X-Frame-Options / CSP frame-ancestors 正是浏览器拒绝加载 iframe 时用的信号）。
  // 只回传响应头、只放行 http(s)、8 秒硬超时；跨站请求（sec-fetch-site: cross-site）直接拒。
  webServer.register({
    kind: 'exact',
    path: BROWSER_PROBE_PATH,
    handler: async (req: any, res: any) => {
      if (String(req.headers?.['sec-fetch-site'] ?? '') === 'cross-site') {
        json(res, 403, { error: 'cross-site probe refused' }); return
      }
      const raw = new URL(req.url ?? '/', 'http://dsh.internal').searchParams.get('url') || ''
      let target: URL
      try {
        target = new URL(raw)
      } catch {
        json(res, 400, { error: 'invalid url' }); return
      }
      if (target.protocol !== 'http:' && target.protocol !== 'https:') {
        json(res, 400, { error: 'only http(s) urls can be probed' }); return
      }
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 8000)
      try {
        let response = await fetch(target, { method: 'HEAD', redirect: 'follow', signal: controller.signal })
        // 部分服务器对 HEAD 回 405/501：补一次 GET（只取头，body 丢弃）
        let retriedAsGet = false
        if (response.status === 405 || response.status === 501) {
          response = await fetch(target, { method: 'GET', redirect: 'follow', signal: controller.signal })
          retriedAsGet = true
        }
        // 也有站点只在 GET 上带 X-Frame-Options / CSP（HEAD 不带）：两个信号都缺时补一次 GET，
        // 否则会把「禁止嵌入」的站点误判成可嵌入，用户只会看到一个语焉不详的空白 iframe。
        const hasEmbedSignals = response.headers.get('content-security-policy') !== null
          || response.headers.get('x-frame-options') !== null
        if (!hasEmbedSignals && !retriedAsGet) {
          response = await fetch(target, { method: 'GET', redirect: 'follow', signal: controller.signal })
        }
        const frameAncestors = extractFrameAncestors(response.headers.get('content-security-policy'))
        const xFrameOptions = response.headers.get('x-frame-options')
        // 补做的 GET 会带回真实 body 而没人读：显式取消，别把 socket 挂在那儿。
        void response.body?.cancel()
        const out: BrowserProbeResult = {
          reachable: true,
          url: response.url,
          status: response.status,
          ...(xFrameOptions !== null ? { xFrameOptions } : {}),
          ...(frameAncestors !== undefined ? { frameAncestors } : {}),
        }
        json(res, 200, out)
      } catch {
        // DNS / TLS / 连接失败 / 超时：无从判断，客户端保持普通 iframe
        json(res, 200, { reachable: false })
      } finally {
        clearTimeout(timer)
      }
    },
  })

  // 本地文件读取（资源管理器点击 .html 后浏览器标签内打开）
  webServer.register({
    kind: 'exact',
    path: '/api/worktable/file',
    handler: async (req: any, res: any) => {
      try {
        const u = new URL(req.url ?? '/', 'http://dsh.internal')
        const p = u.searchParams.get('path') || ''
        if (!p) { json(res, 400, { error: 'missing path' }); return }
        const abs = pathResolve(p)
        const stat = await import('node:fs/promises').then((m) => m.stat(abs))
        if (stat.size > 20 * 1024 * 1024) { json(res, 413, { error: 'file too large' }); return }
        const data = await readFile(abs)
        const ext = (abs.split('.').pop() || '').toLowerCase()
        const types: Record<string, string> = {
          html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8',
          css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8',
          json: 'application/json; charset=utf-8', md: 'text/markdown; charset=utf-8', markdown: 'text/markdown; charset=utf-8', txt: 'text/plain; charset=utf-8', log: 'text/plain; charset=utf-8',
          pdf: 'application/pdf', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', ico: 'image/x-icon',
        }
        res.writeHead(200, { 'content-type': FILE_TYPES[ext] ?? 'application/octet-stream', 'cache-control': 'no-store' })
        res.end(data)
      } catch (err) {
        json(res, 404, { error: String(err) })
      }
    },
  })

  // 本地站点（目录级静态托管）：点开 index.html 时挂载整个所在目录，
  // 让 ./assets/... 等相对引用正常解析（前缀路由，余下路径 = <rootToken>/<相对路径>）。
  // 原生皮肤模板：HTML 骨架 + 设计系统样式表（随插件分发，主题自动适配）
  webServer.register({
    kind: 'prefix',
    path: TEMPLATE_PREFIX,
    handler: (req: any, res: any) => {
      try {
        if (req.method !== 'GET') { res.writeHead(405); res.end(); return }
        const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname
        const rel = pathname.slice(TEMPLATE_PREFIX.length)
        if (rel === '/dshell.css') {
          res.writeHead(200, { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'no-store' })
          res.end(dshellCss)
        } else {
          res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
          res.end(dshellHtml)
        }
      } catch (err) {
        res.writeHead(404); res.end(String(err))
      }
    },
  })

  webServer.register({
    kind: 'prefix',
    path: SITE_PREFIX,
    handler: async (req: any, res: any) => {
      try {
        if (req.method !== 'GET') { res.writeHead(405); res.end(); return }
        const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname
        const segs = pathname.slice(SITE_PREFIX.length).split('/').filter(Boolean)
        const rootToken = decodeURIComponent(segs.shift() ?? '')
        const rel = segs.map((s) => { try { return decodeURIComponent(s) } catch { return s } }).join('/')
        if (!rootToken) { json(res, 400, { error: 'missing root' }); return }
        const root = pathResolve(rootToken)
        let abs = pathResolve(root, rel)
        if (abs !== root && !abs.startsWith(root + sep)) { json(res, 403, { error: 'outside root' }); return }
        const statMod = await import('node:fs/promises')
        let info = await statMod.stat(abs).catch(() => null)
        if (info && info.isDirectory()) {
          abs = pathResolve(abs, 'index.html')
          info = await statMod.stat(abs).catch(() => null)
        }
        if (!info || !info.isFile()) { json(res, 404, { error: 'not found' }); return }
        if (info.size > 40 * 1024 * 1024) { json(res, 413, { error: 'file too large' }); return }
        const data = await readFile(abs)
        const ext = (abs.split('.').pop() || '').toLowerCase()
        res.writeHead(200, { 'content-type': FILE_TYPES[ext] ?? 'application/octet-stream', 'cache-control': 'no-store' })
        res.end(data)
      } catch (err) {
        json(res, 404, { error: String(err) })
      }
    },
  })

  webServer.register({
    kind: 'exact',
    path: '/api/worktable/fs',
    handler: async (req: any, res: any) => {
      try {
        const body = await readJsonBody(req)
        const path = typeof body.path === 'string' && body.path
          ? body.path
          : serverCwd(ctx, body.sessionId, body.cwd)
        json(res, 200, await listDirectory(path))
      } catch (err) {
        json(res, 500, { path: '', entries: [], truncated: false, error: String(err) })
      }
    },
  })

  // 文件名搜索（资源管理器搜索框）：按名字/相对路径子串匹配，限定在有界遍历里
  // （跳过大目录、限制深度与扫描/命中上限），大仓库也不会把服务卡住。
  webServer.register({
    kind: 'exact',
    path: '/api/worktable/search',
    handler: async (req: any, res: any) => {
      try {
        const body = await readJsonBody(req)
        const query = typeof body.query === 'string' ? body.query.trim() : ''
        const root = typeof body.path === 'string' && body.path
          ? body.path
          : serverCwd(ctx, body.sessionId, body.cwd)
        if (!query) { json(res, 200, { root, entries: [], scanned: 0, truncated: false }); return }
        json(res, 200, await searchByName(pathResolve(root), query))
      } catch (err) {
        json(res, 500, { root: '', entries: [], scanned: 0, truncated: false, error: String(err) })
      }
    },
  })

  // 文件变动（diff）：工作区改动清单 + 每个文件的 unified diff；也支持单文件查询
  webServer.register({
    kind: 'exact',
    path: '/api/worktable/diff',
    handler: async (req: any, res: any) => {
      try {
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return }
        const body = await readJsonBody(req)
        const cwd = typeof body.cwd === 'string' && body.cwd
          ? body.cwd
          : serverCwd(ctx, body.sessionId, undefined)
        const base = pathResolve(cwd)
        const explicitRepo = typeof body.repo === 'string' && body.repo ? pathResolve(body.repo) : null
        const root = explicitRepo ?? await gitRootOf(base)
        if (root === null) { json(res, 200, { isRepo: false, root: base, branch: '', files: [], truncated: false }); return }
        const onlyPath = typeof body.path === 'string' && body.path ? pathResolve(body.path) : undefined
        json(res, 200, await workspaceChanges(root, onlyPath))
      } catch (err) {
        json(res, 500, { isRepo: false, root: '', branch: '', files: [], truncated: false, error: String(err) })
      }
    },
  })

  // 仓库发现（文件变动窗的仓库选择器）：不在仓库里就向下找子目录里的仓库
  webServer.register({
    kind: 'exact',
    path: '/api/worktable/repos',
    handler: async (req: any, res: any) => {
      try {
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return }
        const body = await readJsonBody(req)
        const cwd = typeof body.cwd === 'string' && body.cwd
          ? body.cwd
          : serverCwd(ctx, body.sessionId, undefined)
        json(res, 200, await discoverRepos(cwd))
      } catch (err) {
        json(res, 500, { root: '', repos: [], error: String(err) })
      }
    },
  })

  // 会话镜头的数据源：本会话事件日志里的文件操作（tool/call + tool/result）。
  // 只把「折叠文件操作需要的字段」发过去，并把超长文本截断——事件日志里的工具结果可能很大。
  webServer.register({
    kind: 'exact',
    path: '/api/worktable/ops',
    handler: async (req: any, res: any) => {
      try {
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return }
        const body = await readJsonBody(req)
        const sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
        if (!sessionId) { json(res, 400, { error: 'missing sessionId', events: [], lastSeq: 0, live: false }); return }
        const rawAfter = body.afterSeq
        const afterSeq = Number.isSafeInteger(rawAfter) && rawAfter >= 0 ? rawAfter : -1
        let all: any[] | undefined
        try { all = ctx.sessions?.get?.(sessionId)?.snapshotEvents?.() } catch { all = undefined }
        if (all === undefined) {
          // 会话不在内存里（历史会话未水合 / 不是本进程的会话）：如实回空窗口 + live:false
          json(res, 200, { events: [], lastSeq: Math.max(afterSeq, 0), live: false }); return
        }
        const narrowed: any[] = []
        /**
         * 「一层 = 一次提问 + 最终答复」「一层里再按轮看」都要在服务端算：会话事件流里
         * `turn/start` / `turn/end` 是回合边界、`step/start` 是回合内的模型步，而 `/ops` 只把
         * tool/call + tool/result 发给客户端（客户端看不到边界事件）。
         * 这里对**全量**事件数一遍（不受 afterSeq 影响，保证增量轮询时编号一致），每轮取四样：
         *   - 用户输入：`user/message`（payload 就是消息本身，`source.kind === 'user'` 才是人打的）
         *   - 最终输出：该轮最后一条 `assistant/message` 的正文
         *   - token 用量：`assistant/message.usage` 按步累加
         *   - 一层（qa）：人打的消息开一层，其后没有新提问的续跑轮归到这一层
         */
        let turn = 0
        let step = 0
        let qa = 0
        const turns: TurnStat[] = []
        const humans: Array<{ seq: number; turn: number; text: string }> = []
        for (const ev of all) {
          const type = ev?.type
          if (type === 'turn/start') {
            turn += 1
            step = 0
            const stat = makeTurnStat(turn, Number(ev?.time) || 0)
            stat.startSeq = Number(ev?.seq) || 0
            stat.qa = qa
            turns.push(stat)
            continue
          }
          if (type === 'turn/end') {
            const cur = turns[turns.length - 1]
            if (cur !== undefined) {
              cur.endTime = Number(ev?.time) || cur.endTime
              cur.endSeq = Number(ev?.seq) || cur.endSeq
            }
            continue
          }
          if (type === 'step/start') { step += 1; continue }
          if (type === 'user/message') {
            const cur = turns[turns.length - 1]
            // user/message 的 payload 就是消息本身；assistant/message 才是 {message, usage}
            const msg = ev?.data?.message ?? ev?.data
            const text = messageText(msg)
            if (text !== '' && msg?.source?.kind === 'user') {
              humans.push({ seq: Number(ev?.seq) || 0, turn: cur?.turn ?? 0, text: clip(text, TURN_TEXT_MAX) })
              if (cur !== undefined) {
                if (cur.input === '') { cur.input = clip(text, TURN_TEXT_MAX); qa += 1; cur.qa = qa } else {
                  // 同一轮里又来一条人打的消息（插话/steering）：并进这一轮的输入
                  cur.input = clip(cur.input + '\n\n' + text, TURN_TEXT_MAX)
                }
              }
            }
            continue
          }
          if (type === 'assistant/message') {
            const cur = turns[turns.length - 1]
            if (cur !== undefined) {
              const text = messageText(ev?.data?.message)
              if (text !== '') cur.output = clip(text, TURN_TEXT_MAX)
              addUsage(cur, ev?.data?.usage)
            }
            continue
          }
          if (type === 'tool/call') {
            const cur = turns[turns.length - 1]
            if (cur !== undefined) cur.tools += 1
          }
          if (type !== 'tool/call' && type !== 'tool/result') continue
          if (!(Number(ev.seq) > afterSeq)) continue
          narrowed.push({ ...narrowOpsEvent(ev), turn, step, qa })
        }
        // 收尾：还没归层（qa=0）的轮次（开场之前 / 续跑）挂到最近一次提问那一层
        let lastQa = 0
        for (const t of turns) {
          if (t.input !== '' && t.qa > 0) { lastQa = t.qa; continue }
          if (t.qa === 0 && lastQa > 0) t.qa = lastQa
        }
        const cap = 4000
        const window_ = narrowed.length > cap ? narrowed.slice(narrowed.length - cap) : narrowed
        // 会话总量：所有轮的 token 与工具调用累加（界面顶部一行「会话统计」）
        const total = turns.reduce((acc, t) => ({
          input: acc.input + t.usage.input,
          output: acc.output + t.usage.output,
          cacheRead: acc.cacheRead + t.usage.cacheRead,
          cacheWrite: acc.cacheWrite + t.usage.cacheWrite,
          reasoning: acc.reasoning + t.usage.reasoning,
          total: acc.total + t.usage.total,
          calls: acc.calls + t.usage.calls,
          tools: acc.tools + t.tools,
        }), { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, total: 0, calls: 0, tools: 0 })
        json(res, 200, {
          events: window_,
          turns: turns.slice(-200),
          ...(body.debug === true
            ? { debug: { humans: humans.slice(-12), turns: turns.slice(-12).map((t) => ({ turn: t.turn, qa: t.qa, startSeq: t.startSeq, endSeq: t.endSeq, inputLen: t.input.length, outputLen: t.output.length, tools: t.tools })) } }
            : {}),
          total: { ...total, turns: turns.length },
          lastSeq: window_.length > 0 ? Number(window_[window_.length - 1]?.seq) : Math.max(afterSeq, 0),
          live: true,
        })
      } catch (err) {
        json(res, 500, { events: [], lastSeq: 0, live: false, error: String(err) })
      }
    },
  })

  /**
   * 子代理「实时行」路由（对齐 DSH-better-sidebar 的 `subagents.live`）：
   * 一次请求把整棵树里 **running** 子会话的最后一段文本 / 最后一次工具调用折出来，
   * 而不是每个卡片各发一次历史请求。来源是各子会话自己的事件日志（只读快照）。
   * `ctx.get('subagents').listDescendants` 不可用时如实回空表（界面退化成只有状态）。
   */
  webServer.register({
    kind: 'exact',
    path: '/api/worktable/subagent-live',
    handler: async (req: any, res: any) => {
      try {
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return }
        const body = await readJsonBody(req)
        const rootSessionId = typeof body.rootSessionId === 'string' ? body.rootSessionId : ''
        if (rootSessionId === '') { json(res, 400, { live: {}, error: 'missing rootSessionId' }); return }
        const subagents: any = typeof ctx.get === 'function' ? ctx.get('subagents') : undefined
        if (subagents === undefined || subagents === null || typeof subagents.listDescendants !== 'function') {
          json(res, 200, { live: {}, unavailable: true }); return
        }
        let descendants: any[] = []
        try { descendants = await subagents.listDescendants(rootSessionId) } catch { descendants = [] }
        const live: Record<string, { text?: string; tool?: { name: string; args: string } }> = {}
        for (const entry of Array.isArray(descendants) ? descendants : []) {
          if (entry?.kind !== 'child' || entry?.activity !== 'running') continue
          if (typeof entry?.label === 'string' && entry.label.startsWith('Side: ')) continue
          try {
            const activity = lastActivityOf(ctx.sessions?.get?.(entry.id)?.snapshotEvents?.() ?? [])
            if (activity.text !== undefined || activity.tool !== undefined) live[String(entry.id)] = activity
          } catch { /* 一个子会话读不到就跳过它 */ }
        }
        json(res, 200, { live })
      } catch (err) {
        json(res, 500, { live: {}, error: String(err) })
      }
    },
  })

  /**
   * 任务管理窗的两条路由（对齐 DSH-better-sidebar 的 jobs 路由设计）：
   *   - 任务**清单**不用路由：客户端从宿主会话推送镜像里就有（`jobsBySession`）；
   *   - `job-output` **重放「模型已经读过的输出」**：来源是本会话事件日志里
   *     `job_output` 工具调用的参数 `job_id` + 配对的结果文本。**不消费** registry 的读游标，
   *     所以不会把模型没看到的内容提前吃掉；模型没读过时如实回 `read:false`。
   *   - `job-kill` 直接用 registry 的 `kill`，用「本会话的活 Agent」当 caller 做围栏
   *     （只能停本会话的任务）；registry / agent 不在时如实降级，不假装成功。
   */
  webServer.register({
    kind: 'exact',
    path: '/api/worktable/job-output',
    handler: async (req: any, res: any) => {
      try {
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return }
        const body = await readJsonBody(req)
        const sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
        const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : ''
        if (!sessionId || !jobId) { json(res, 400, { text: '', read: false, calls: 0, error: 'missing sessionId/jobId' }); return }
        let all: any[] | undefined
        try { all = ctx.sessions?.get?.(sessionId)?.snapshotEvents?.() } catch { all = undefined }
        if (all === undefined) { json(res, 200, { text: '', read: false, calls: 0, live: false }); return }
        const texts: string[] = []
        let calls = 0
        const pending = new Map<string, boolean>()
        for (const ev of all) {
          if (ev?.type === 'tool/call') {
            const d = ev.data ?? {}
            if (typeof d.name !== 'string' || !/^job_output$/i.test(d.name)) continue
            let args: any = {}
            try { args = typeof d.arguments === 'string' ? JSON.parse(d.arguments) : (d.arguments ?? {}) } catch { args = {} }
            const id = typeof args?.job_id === 'string' ? args.job_id : (typeof args?.jobId === 'string' ? args.jobId : '')
            if (id !== jobId) continue
            calls += 1
            if (typeof d.callId === 'string') pending.set(d.callId, true)
            continue
          }
          if (ev?.type !== 'tool/result') continue
          const message = ev?.data?.message ?? {}
          const callId = message?.source?.callId
          if (typeof callId !== 'string' || pending.get(callId) !== true) continue
          pending.delete(callId)
          const blocks = Array.isArray(message.content) ? message.content : []
          for (const block of blocks) {
            if (block === null || typeof block !== 'object' || block.type !== 'tool-result') continue
            if (block.isError === true) continue
            const inner = Array.isArray(block.content) ? block.content : []
            const parts: string[] = []
            for (const item of inner) {
              if (item !== null && typeof item === 'object' && item.type === 'text' && typeof item.text === 'string') parts.push(item.text)
            }
            if (parts.length > 0) texts.push(parts.join('\n'))
          }
        }
        const joined = texts.join('\n\n')
        const limited = joined.slice(0, OPS_TEXT_MAX)
        json(res, 200, {
          text: limited,
          truncated: joined.length > limited.length,
          read: texts.length > 0,
          calls,
          live: true,
        })
      } catch (err) {
        json(res, 500, { text: '', read: false, calls: 0, error: String(err) })
      }
    },
  })

  webServer.register({
    kind: 'exact',
    path: '/api/worktable/job-kill',
    handler: async (req: any, res: any) => {
      try {
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return }
        const body = await readJsonBody(req)
        const sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
        const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : ''
        const reason = typeof body.reason === 'string' && body.reason !== '' ? body.reason : 'stopped from dsh-mytable'
        if (!jobId) { json(res, 200, { ok: false, output: 'missing jobId' }); return }
        const registry: any = typeof ctx.get === 'function' ? ctx.get('jobs') : undefined
        if (registry === undefined || registry === null || typeof registry.kill !== 'function') {
          json(res, 200, { ok: false, output: 'jobs-unavailable' }); return
        }
        const agents: any = typeof ctx.get === 'function' ? ctx.get('agents') : undefined
        const caller = sessionId !== '' && agents !== undefined && agents !== null && typeof agents.get === 'function'
          ? agents.get(sessionId)
          : undefined
        if (caller === undefined && sessionId !== '') {
          // 会话没有活着的 Agent（已结束/未水合）：别用「无 caller」去停，那会绕过围栏
          json(res, 200, { ok: false, output: 'agent-not-live' }); return
        }
        const outcome = registry.kill(jobId, caller, reason)
        json(res, 200, { ok: true, outcome: String(outcome) })
      } catch (err) {
        json(res, 500, { ok: false, output: String(err) })
      }
    },
  })

  // 文件变动窗·Git 镜头的写操作：暂存 / 取消暂存 / 丢弃改动 / 提交。
  // 都是真改 git 状态（丢弃还会删文件），所以服务端只做「一条命令一件事」，界面负责确认。
  const gitAction = async (req: any, res: any, run: (root: string, body: any) => Promise<{ ok: boolean; output: string }>) => {
    try {
      if (req.method !== 'POST') { res.writeHead(405); res.end(); return }
      const body = await readJsonBody(req)
      const cwd = typeof body.cwd === 'string' && body.cwd ? body.cwd : serverCwd(ctx, body.sessionId, undefined)
      const root = (typeof body.repo === 'string' && body.repo ? pathResolve(body.repo) : null) ?? await gitRootOf(pathResolve(cwd))
      if (root === null) { json(res, 200, { ok: false, output: 'not a git repository' }); return }
      json(res, 200, await run(root, body))
    } catch (err) {
      json(res, 500, { ok: false, output: String(err) })
    }
  }

  webServer.register({
    kind: 'exact',
    path: '/api/worktable/git-stage',
    handler: (req: any, res: any) => gitAction(req, res, async (root, body) => {
      const rel = typeof body.path === 'string' && body.path ? body.path : ''
      return gitRun(root, rel !== '' ? ['add', '--', rel] : ['add', '-A'])
    }),
  })

  webServer.register({
    kind: 'exact',
    path: '/api/worktable/git-unstage',
    handler: (req: any, res: any) => gitAction(req, res, async (root, body) => {
      const rel = typeof body.path === 'string' && body.path ? body.path : ''
      // 有 HEAD 用 reset；空仓库（无 HEAD）用 rm --cached 把文件移出索引
      const hasHead = await gitExec(['rev-parse', '--verify', 'HEAD'], root).then(() => true).catch(() => false)
      if (hasHead) return gitRun(root, rel !== '' ? ['reset', '-q', 'HEAD', '--', rel] : ['reset', '-q', 'HEAD'])
      return gitRun(root, rel !== '' ? ['rm', '--cached', '-q', '--', rel] : ['rm', '--cached', '-r', '-q', '--', '.'])
    }),
  })

  webServer.register({
    kind: 'exact',
    path: '/api/worktable/git-discard',
    handler: (req: any, res: any) => gitAction(req, res, async (root, body) => {
      const rel = typeof body.path === 'string' && body.path ? body.path : ''
      if (rel === '') return { ok: false, output: 'missing path' }
      const untracked = typeof body.untracked === 'boolean' ? body.untracked : false
      if (untracked) {
        // 未跟踪文件没有可回滚的版本：直接删（界面必须先确认）
        try {
          await import('node:fs/promises').then((m) => m.rm(pathResolve(root, rel), { force: true }))
          return { ok: true, output: 'removed ' + rel }
        } catch (err) {
          return { ok: false, output: String(err) }
        }
      }
      return gitRun(root, ['checkout', '--', rel])
    }),
  })

  webServer.register({
    kind: 'exact',
    path: '/api/worktable/git-commit',
    handler: (req: any, res: any) => gitAction(req, res, async (root, body) => {
      const message = typeof body.message === 'string' ? body.message.trim() : ''
      if (message === '') return { ok: false, output: 'missing message' }
      return gitRun(root, ['commit', '-m', message])
    }),
  })

  // 分支清单（Git 镜头头部那个分支下拉的数据源）：只回本地分支，当前分支排最前
  webServer.register({
    kind: 'exact',
    path: '/api/worktable/git-branches',
    handler: async (req: any, res: any) => {
      try {
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return }
        const body = await readJsonBody(req)
        const cwd = typeof body.cwd === 'string' && body.cwd ? body.cwd : serverCwd(ctx, body.sessionId, undefined)
        const root = (typeof body.repo === 'string' && body.repo ? pathResolve(body.repo) : null) ?? await gitRootOf(pathResolve(cwd))
        if (root === null) { json(res, 200, { isRepo: false, root: pathResolve(cwd), branch: '', branches: [] }); return }
        const info = await branchNamesOf(root)
        json(res, 200, { isRepo: true, root, branch: info.current, branches: info.names })
      } catch (err) {
        json(res, 500, { isRepo: false, root: '', branch: '', branches: [], error: String(err) })
      }
    },
  })

  // 切分支（对齐 DSH-better-sidebar 的 checkout）：只允许切到**本地已有**分支，
  // 名字先挡一次「- 开头 / 带空白」（免得被 git 当参数解析），失败把 git 的原文带回界面
  // （工作区有冲突改动时 git 自己会拒绝，这里不额外加戏）。
  webServer.register({
    kind: 'exact',
    path: '/api/worktable/git-checkout',
    handler: (req: any, res: any) => gitAction(req, res, async (root, body) => {
      const branch = typeof body.branch === 'string' ? body.branch.trim() : ''
      if (branch === '') return { ok: false, output: 'missing branch' }
      if (branch.startsWith('-') || /[\s\u0000]/.test(branch)) return { ok: false, output: 'invalid branch name: ' + branch }
      const known = await branchNamesOf(root)
      if (!known.names.includes(branch)) return { ok: false, output: 'no such local branch: ' + branch }
      return gitRun(root, ['checkout', branch])
    }),
  })

  webServer.register({
    kind: 'exact',
    path: '/api/worktable/git-log',
    handler: async (req: any, res: any) => {
      try {
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return }
        const body = await readJsonBody(req)
        const cwd = typeof body.cwd === 'string' && body.cwd ? body.cwd : serverCwd(ctx, body.sessionId, undefined)
        const root = (typeof body.repo === 'string' && body.repo ? pathResolve(body.repo) : null) ?? await gitRootOf(pathResolve(cwd))
        if (root === null) { json(res, 200, { isRepo: false, root: pathResolve(cwd), commits: [] }); return }
        const limit = Math.min(200, Math.max(1, Number(body.limit) || 30))
        const skip = Math.max(0, Number(body.skip) || 0)
        json(res, 200, await gitLogPage(root, limit, skip))
      } catch (err) {
        json(res, 500, { isRepo: false, root: '', commits: [], error: String(err) })
      }
    },
  })

  // 某次提交的 diff（多文件）：客户端用同一套解析器渲染。
  // `-m --first-parent` 是参考实现的做法：合并提交默认**没有任何 patch**，
  // 点历史里的 merge 提交就会看到空白；加上它以后 merge 显示对第一父提交的差异，
  // 对普通提交则是无副作用的（照样回它自己的 patch）。
  webServer.register({
    kind: 'exact',
    path: '/api/worktable/git-show',
    handler: (req: any, res: any) => gitAction(req, res, async (root, body) => {
      const hash = typeof body.hash === 'string' ? body.hash.trim() : ''
      if (hash === '') return { ok: false, output: 'missing hash' }
      const out = await gitRun(root, ['show', '--no-ext-diff', '--no-color', '--format=', '-U3', '-m', '--first-parent', hash])
      return out.ok ? { ok: true, output: out.output.slice(0, DIFF_MAX_BYTES_TOTAL) } : out
    }),
  })

  // 取某个版本的文件全文（diff 里「未改动区间」展开时用：工作区那份用工作区文件，
  // 已暂存那份要读索引里的 blob，否则会跟后续未暂存的编辑对不上）
  webServer.register({
    kind: 'exact',
    path: '/api/worktable/git-blob',
    handler: (req: any, res: any) => gitAction(req, res, async (root, body) => {
      const rel = typeof body.rel === 'string' ? body.rel.trim() : ''
      const rev = typeof body.rev === 'string' && body.rev !== '' ? body.rev : ''
      if (rel === '') return { ok: false, output: 'missing rel' }
      // rev 为空 → 索引版本（`:rel`）；否则 `rev:rel`
      const out = await gitRun(root, ['show', rev === '' ? `:${rel}` : `${rev}:${rel}`])
      return out.ok ? { ok: true, output: out.output.slice(0, 4 * 1024 * 1024) } : out
    }),
  })

  // 工作区列表（自定义窗口会话分组用）：
  // 优先走宿主正式服务 ctx.workspaceRegistry（0.1.1/0.1.2 均有，正确感知 DSH_HOME 与存储后端）；
  // 不可用时回退按 resolveDshHomeSafe() 读 storages/workspace.json（只读）。
  // 返回结构是客户端契约，两种来源都映射成同一 shape。
  webServer.register({
    kind: 'exact',
    path: '/api/worktable/workspaces',
    handler: async (_req: any, res: any) => {
      try {
        // cordis 对未 inject 服务的属性访问会直接 throw（不返回 undefined），必须 try-catch 探测
        let registry: any = null
        try { registry = (ctx as any).workspaceRegistry ?? null } catch {}
        if (!registry) {
          try { registry = ctx.get?.('workspaceRegistry') ?? null } catch {}
        }
        if (registry && typeof registry.list === 'function') {
          const list = registry.list() ?? []
          const workspaceIds: string[] = []
          const tables: Record<string, { title?: string; sessionIds?: string[] }> = {}
          for (const ws of list) {
            const id = String(ws?.id ?? '')
            if (!id) continue
            workspaceIds.push(id)
            tables[id] = {
              title: typeof ws?.title === 'string' ? ws.title : undefined,
              sessionIds: Array.isArray(ws?.sessionIds) ? ws.sessionIds.map(String) : [],
            }
          }
          let archived: string[] = []
          try { archived = (registry.archivedSessionIds ?? []).map(String) } catch {}
          json(res, 200, {
            unit: { name: 'workspace', version: 2 },
            global: { initialized: true, workspaceIds, archivedSessionIds: archived },
            tables: { workspaces: tables },
          })
          return
        }
        const file = pathResolve(resolveDshHomeSafe(), 'storages', 'workspace.json')
        const raw = await readFile(file, 'utf8')
        // 容忍 BOM（外部工具改写可能带 EF BB BF，JSON.parse 会抛错）
        json(res, 200, JSON.parse(raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw))
      } catch (err) {
        json(res, 404, { error: String(err) })
      }
    },
  })

  // 本地文件写入（MD 编辑模式保存回磁盘）
  webServer.register({
    kind: 'exact',
    path: '/api/worktable/write',
    handler: async (req: any, res: any) => {
      try {
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return }
        const body = await readJsonBody(req)
        const p = typeof body.path === 'string' ? body.path : ''
        const content = typeof body.content === 'string' ? body.content : ''
        if (!p) { json(res, 400, { error: 'missing path' }); return }
        if (content.length > 20 * 1024 * 1024) { json(res, 413, { error: 'content too large' }); return }
        const abs = pathResolve(p)
        // encoding:'base64' → 按二进制写入（真机验收要造 wav/pdf/docx 这类夹具；文本写盘路径不变）
        const base64 = body.encoding === 'base64'
        const data = base64 ? Buffer.from(content, 'base64') : content
        await import('node:fs/promises').then((m) => m.writeFile(abs, data, base64 ? undefined : 'utf8'))
        json(res, 200, { ok: true, bytes: base64 ? data.length : Buffer.byteLength(content, 'utf8') })
      } catch (err) {
        json(res, 500, { error: String(err) })
      }
    },
  })

  // 新建分组：创建目录（仅当父目录已存在，避免递归误建深层垃圾目录）
  webServer.register({
    kind: 'exact',
    path: '/api/worktable/mkdir',
    handler: async (req: any, res: any) => {
      try {
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return }
        const body = await readJsonBody(req)
        const p = typeof body.path === 'string' ? body.path.trim() : ''
        if (!p) { json(res, 400, { error: 'missing path' }); return }
        const abs = pathResolve(p)
        const fsx = await import('node:fs/promises')
        const parent = dirname(abs)
        try { await fsx.access(parent) } catch { json(res, 400, { error: 'parent not found' }); return }
        await fsx.mkdir(abs)
        json(res, 200, { ok: true, path: abs })
      } catch (err: any) {
        json(res, err?.code === 'EEXIST' ? 200 : 500, err?.code === 'EEXIST' ? { ok: true, exists: true } : { error: String(err) })
      }
    },
  })

  webServer.register({
    kind: 'exact',
    path: '/api/worktable/git',
    handler: async (req: any, res: any) => {
      const body = await readJsonBody(req)
      const cwd = serverCwd(ctx, body.sessionId, body.cwd)
      json(res, 200, await gitStatus(cwd))
    },
  })

  setupTerminal(webServer, ctx)
}
