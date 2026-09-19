/**
 * 会话镜头的「文件操作」折叠（纯函数，单测直接打靶）——移植自 DSH-better-sidebar 的
 * `client/changes/ops.ts`，事件形状与它的会话事件日志一致（`tool/call` + `tool/result` 成对）。
 *
 * 一次文件操作（FileOp）= 一个工具调用：
 *   - `read`  → 预览成带行号的内容视图（工具结果里的 `<content>` 正文）
 *   - `write` → 预览成整份新增/对照上一版的行级 diff
 *   - `edit`  → 预览成 old_string → new_string 的行级 diff
 *   - 失败（isError）→ 预览成真实报错文本；未结算（running）→ 标注进行中
 *
 * 另外提供 `lineDiff`：把 before/after 两段文本折成与 git 镜头同一套 `DiffRow`，
 * 这样两个镜头共用一个渲染器（行号 gutter / 行内字符级高亮都一样）。
 */
import type { DiffRow } from './diff-parse'

export type FileOpKind = 'read' | 'write' | 'edit'

export interface FileOp {
  /** 稳定标识：来源工具调用 id */
  callId: string
  kind: FileOpKind
  /** 模型写出来的路径（工作区相对或绝对，原样保留） */
  path: string
  /** 调用时间（epoch ms；只有结果时间时用结果时间） */
  time: number
  /** 所属回合（第几轮；服务端按 `turn/start` 数出来的，0 = 边界信息缺失） */
  turn: number
  /** 所属「问答层」（人打的一条消息开一层；续跑轮归到最近那一层） */
  qa: number
  /** 还没有结果 */
  running: boolean
  /** 结果报错 */
  isError: boolean
  errorText?: string
  /** edit：模型的替换载荷 */
  edit?: { oldString: string; newString: string }
  /** write：整份新内容 */
  content?: string
  /** read：工具结果里的正文 */
  read?: string
  /** 结果里的附加说明（如「已写入 1234 字节」），预览头显示 */
  note?: string
}

/** 工具名 → 操作类型（不认识的工具直接忽略） */
const READ_TOOLS = new Set(['read', 'view', 'see'])
const WRITE_TOOLS = new Set(['write', 'create'])
const EDIT_TOOLS = new Set(['edit', 'str_replace', 'str-replace-editor', 'multi-edit'])

function kindOf(name: string): FileOpKind | undefined {
  if (READ_TOOLS.has(name)) return 'read'
  if (WRITE_TOOLS.has(name)) return 'write'
  if (EDIT_TOOLS.has(name)) return 'edit'
  return undefined
}

/** 防御式解析工具调用参数（模型产出的线上数据，逐字段校验） */
function parseArgs(argsRaw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(argsRaw)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Record<string, unknown>
  } catch {
    return {}
  }
}

function pathOf(args: Record<string, unknown>): string | undefined {
  for (const key of ['file_path', 'path', 'filePath']) {
    const value = args[key]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return undefined
}

interface ToolResultMessageLike {
  source?: { kind?: unknown; callId?: unknown }
  content?: unknown
}

interface ToolResultBlockLike {
  type?: unknown
  content?: unknown
  isError?: unknown
}

function resultText(message: ToolResultMessageLike): string | undefined {
  if (!Array.isArray(message.content)) return undefined
  const parts: string[] = []
  for (const block of message.content) {
    if (block === null || typeof block !== 'object') continue
    const candidate = block as ToolResultBlockLike
    if (candidate.type !== 'tool-result') continue
    const inner = candidate.content
    if (!Array.isArray(inner)) continue
    for (const item of inner) {
      if (item === null || typeof item !== 'object') continue
      const textItem = item as { type?: unknown; text?: unknown }
      if (textItem.type === 'text' && typeof textItem.text === 'string') parts.push(textItem.text)
    }
  }
  return parts.length > 0 ? parts.join('\n') : undefined
}

function resultIsError(message: ToolResultMessageLike): boolean {
  if (!Array.isArray(message.content)) return false
  return message.content.some((block) => {
    if (block === null || typeof block !== 'object') return false
    return (block as ToolResultBlockLike).type === 'tool-result'
      && (block as ToolResultBlockLike).isError === true
  })
}

/** 把会话事件日志折成文件操作清单（最新在前） */
export function extractFileOps(events: readonly any[]): FileOp[] {
  const byCall = new Map<string, FileOp>()
  for (const event of events) {
    if (event?.type === 'tool/call') {
      const data = event.data as { name?: unknown; callId?: unknown; arguments?: unknown }
      if (typeof data?.name !== 'string' || typeof data?.callId !== 'string') continue
      const kind = kindOf(data.name)
      if (kind === undefined) continue
      const args = parseArgs(typeof data.arguments === 'string' ? data.arguments : '')
      const path = pathOf(args)
      if (path === undefined) continue
      const base: FileOp = {
        callId: data.callId, kind, path, time: Number(event.time) || 0,
        turn: Number.isSafeInteger(event.turn) ? Number(event.turn) : 0,
        qa: Number.isSafeInteger(event.qa) ? Number(event.qa) : 0,
        running: true, isError: false,
      }
      if (kind === 'edit') {
        const oldString = args.old_string
        const newString = args.new_string
        byCall.set(data.callId, typeof oldString === 'string' && typeof newString === 'string'
          ? { ...base, edit: { oldString, newString } }
          : base)
        continue
      }
      if (kind === 'write') {
        const content = args.content
        byCall.set(data.callId, typeof content === 'string' && content.length > 0 ? { ...base, content } : base)
        continue
      }
      byCall.set(data.callId, base)
    } else if (event?.type === 'tool/result') {
      const message = (event.data as { message?: unknown })?.message as ToolResultMessageLike | undefined
      if (message === undefined) continue
      const callId = message.source?.callId
      if (typeof callId !== 'string') continue
      const op = byCall.get(callId)
      if (op === undefined) continue
      const text = resultText(message)
      const isError = resultIsError(message)
      const patch: { running: boolean; isError: boolean; errorText?: string; read?: string; content?: string; note?: string } = { running: false, isError }
      if (text !== undefined && text.length > 0) {
        if (isError) patch.errorText = text
        else if (op.kind === 'read') patch.read = text
        else if (op.kind === 'write' && op.content === undefined) patch.content = text
        else {
          // 成功结果的短摘要（例如「已写入 …」）拿来当预览头说明
          patch.note = text.split('\n')[0]!.slice(0, 200)
        }
      }
      byCall.set(callId, { ...op, ...patch })
    }
  }
  return [...byCall.values()].sort((a, b) => b.time - a.time)
}

/** 一轮的用量与统计（服务端算好；界面直接显示） */
export interface TurnUsage {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  reasoning: number
  total: number
  /** 结算了几步（几次模型调用） */
  calls: number
}

export interface TurnStat {
  turn: number
  /** 属于第几层「问答」（服务端给的；续跑轮归到最近那一层） */
  qa: number
  /** 这一轮开始时间（epoch ms） */
  time: number
  endTime?: number
  /** 用户输入原文（服务端截断到 4k） */
  input: string
  /** 这一轮的最终输出（该轮最后一条 assistant 文本） */
  output: string
  /** 工具调用总数（含非文件工具） */
  tools: number
  usage: TurnUsage
}

/** 把服务端回的 turns 数组收成 Map（turn → 统计） */
export function turnsToMap(turns: unknown): Map<number, TurnStat> {
  const out = new Map<number, TurnStat>()
  if (!Array.isArray(turns)) return out
  for (const t of turns as Array<Partial<TurnStat>>) {
    if (!Number.isSafeInteger(t?.turn)) continue
    const u = (t.usage ?? {}) as Partial<TurnUsage>
    const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0)
    out.set(Number(t.turn), {
      turn: Number(t.turn),
      qa: num(t.qa),
      time: num(t.time),
      ...(typeof t.endTime === 'number' ? { endTime: t.endTime } : {}),
      input: typeof t.input === 'string' ? t.input : '',
      output: typeof t.output === 'string' ? t.output : '',
      tools: num(t.tools),
      usage: {
        input: num(u.input), output: num(u.output), cacheRead: num(u.cacheRead),
        cacheWrite: num(u.cacheWrite), reasoning: num(u.reasoning), total: num(u.total), calls: num(u.calls),
      },
    })
  }
  return out
}

/** token 数的紧凑写法（12345 → 12.3k），用量行用 */
export function formatTokens(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0'
  if (n < 1000) return String(Math.round(n))
  if (n < 1000 * 1000) return (n / 1000).toFixed(n < 10000 ? 1 : 0) + 'k'
  return (n / (1000 * 1000)).toFixed(1) + 'M'
}

/** 按文件分组（每组内最新在前，组间按最近一次操作排序） */
export function groupByFile(ops: readonly FileOp[]): Map<string, FileOp[]> {
  const groups = new Map<string, FileOp[]>()
  for (const op of ops) {
    const list = groups.get(op.path) ?? []
    list.push(op)
    groups.set(op.path, list)
  }
  return new Map([...groups.entries()].sort((a, b) => (b[1][0]?.time ?? 0) - (a[1][0]?.time ?? 0)))
}

/** 一层「问答」（= 一条用户提问 + 它的最终答复，里面可以有好几轮） */
export interface QaGroup {
  /** 第几层（1 基；0 = 服务端没给出边界） */
  qa: number
  /** 这一层里最早一轮的开始时间 */
  time: number
  /** 用户输入（该层第一轮的人打的消息；空串表示老日志里没有） */
  input: string
  /** 最终输出（该层最后一轮有输出的那条） */
  output: string
  /** 这一层的 token 用量合计 */
  usage: TurnUsage
  /** 这一层的工具调用数 */
  tools: number
  /** 这一层包含几轮 */
  turns: TurnGroup[]
  /** 涉及文件数 / 操作条数 */
  files: number
  ops: number
}

/**
 * 先按「层」再按「轮」分组：一层 = 一条用户提问 + 最终答复（人打的消息开一层，
 * 之后没有新提问的续跑轮归到这一层）；层内再按轮（服务端的 `turn`）分。
 * 最新的层排最前，层内最新的轮也排最前——「最上面是最新的」。
 */
export function groupByQa(ops: readonly FileOp[], stats: Map<number, TurnStat>): QaGroup[] {
  const byQa = new Map<number, FileOp[]>()
  for (const op of ops) {
    const list = byQa.get(op.qa) ?? []
    list.push(op)
    byQa.set(op.qa, list)
  }
  // 没有任何文件操作、但确实发生过的层也要能看见（比如纯问答），所以层清单以 stats 为准并合并 ops。
  // 注意：`stats` 的 **key 是轮号**、层号在 `value.qa` 里——早期版本拿 `stats.keys()` 当层号，
  // 于是「只看输入输出」时每层都配不上轮，整屏都是「0 轮 / 没记录到用户输入」。
  const qaIds = new Set<number>([...byQa.keys(), ...[...stats.values()].map((s) => s.qa)])
  const groups: QaGroup[] = []
  for (const qa of qaIds) {
    const list = byQa.get(qa) ?? []
    const turnIds = new Set<number>(list.map((o) => o.turn))
    // 这一层里没有文件操作、但 stats 里有记录的轮也要列出来
    for (const [turn, st] of stats) if (st.qa === qa) turnIds.add(turn)
    const turns: TurnGroup[] = [...turnIds].sort((a, b) => b - a).map((turn) => {
      const tOps = list.filter((o) => o.turn === turn)
      return {
        turn,
        time: stats.get(turn)?.time ?? Math.min(...tOps.map((o) => o.time)),
        files: new Set(tOps.map((o) => o.path)).size,
        ops: tOps.length,
        list: tOps,
      }
    })
    const turnStatsOfQa = turns.map((t) => stats.get(t.turn)).filter((s): s is TurnStat => s !== undefined)
    const usage: TurnUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, total: 0, calls: 0 }
    for (const s of turnStatsOfQa) {
      usage.input += s.usage.input
      usage.output += s.usage.output
      usage.cacheRead += s.usage.cacheRead
      usage.cacheWrite += s.usage.cacheWrite
      usage.reasoning += s.usage.reasoning
      usage.total += s.usage.total
      usage.calls += s.usage.calls
    }
    const firstWithInput = turnStatsOfQa.find((s) => s.input !== '')
    const lastWithOutput = [...turnStatsOfQa].reverse().find((s) => s.output !== '')
    groups.push({
      qa,
      time: Math.min(...(turnStatsOfQa.length > 0 ? turnStatsOfQa.map((s) => s.time) : turns.map((t) => t.time)), Number.MAX_SAFE_INTEGER),
      input: firstWithInput?.input ?? '',
      output: lastWithOutput?.output ?? '',
      usage,
      tools: turnStatsOfQa.reduce((n, s) => n + s.tools, 0),
      turns,
      files: new Set(list.map((o) => o.path)).size,
      ops: list.length,
    })
  }
  return groups.sort((a, b) => b.qa - a.qa || b.time - a.time)
}

/** 一轮（一个回合）的文件操作 */
export interface TurnGroup {
  /** 第几轮（1 基；0 表示服务端没给出边界） */
  turn: number
  /** 这一轮里最早一次操作的时间（用作「多久以前」） */
  time: number
  /** 涉及的文件数 */
  files: number
  /** 操作条数 */
  ops: number
  /** 该轮的操作（最新在前） */
  list: FileOp[]
}

/**
 * 按**轮**分组（一轮 = 会话里的一个回合，服务端按 `turn/start` 数）。
 * 最新的一轮排最前；轮内保持「最新在前」，交给 {@link groupByFile} 再按文件聚。
 * 一轮都没有（老日志没边界事件）时退化成单组 turn=0，界面照旧能看。
 */
export function groupByTurn(ops: readonly FileOp[]): TurnGroup[] {
  const groups = new Map<number, FileOp[]>()
  for (const op of ops) {
    const list = groups.get(op.turn) ?? []
    list.push(op)
    groups.set(op.turn, list)
  }
  return [...groups.entries()]
    .map(([turn, list]) => ({
      turn,
      time: Math.min(...list.map((o) => o.time)),
      files: new Set(list.map((o) => o.path)).size,
      ops: list.length,
      list,
    }))
    .sort((a, b) => b.turn - a.turn || b.time - a.time)
}

/**
 * 某次操作之前、该文件最后一次已知内容（尽力而为）：
 * `ops` 是「最新在前」，所以过滤出更早的操作后**从前往后**找第一个能给出内容的——
 * write 的载荷、上一次 edit 的 new_string（编辑后的内容就是下一次的起点）、read 的结果正文。
 * 都找不到（例如本会话第一次就是 write）就返回 undefined，预览退化成「整份新增」。
 */
export function knownContentBefore(ops: readonly FileOp[], path: string, before: FileOp): string | undefined {
  const older = ops.filter((op) => op.path === path && op !== before && op.time <= before.time)
  for (const op of older) {
    if (op.kind === 'write' && op.content !== undefined) return op.content
    if (op.kind === 'edit' && op.edit !== undefined) return op.edit.newString
    if (op.kind === 'read' && op.read !== undefined) return parseReadContent(op.read)
  }
  return undefined
}

/** read 结果里 `<content>` 的正文行（丢掉「(Showing lines …)」提示行） */
function contentLines(raw: string): string[] {
  const m = /<content>([\s\S]*?)<\/content>/.exec(raw)
  const body = m ? m[1]! : raw
  return body.split('\n').filter((line) => !/^\s*\(Showing lines .*\)\s*$/.test(line))
}

/** 该文件在本次操作之前的内容（edit → old_string；write → 反推；read → 结果正文） */
export function previewSides(op: FileOp, ops: readonly FileOp[]): { before?: string; after?: string } {
  if (op.kind === 'edit' && op.edit !== undefined) return { before: op.edit.oldString, after: op.edit.newString }
  if (op.kind === 'write') return { before: knownContentBefore(ops, op.path, op), after: op.content }
  if (op.kind === 'read' && op.read !== undefined) return { after: parseReadContent(op.read) }
  return {}
}

/** read 结果 → 带真实行号的行（没有 `<n>: ` 前缀时退化为顺序计数） */
export interface ReadLine { line: number; text: string }

export function parseReadLines(raw: string): ReadLine[] {
  const out: ReadLine[] = []
  let fallback = 1
  for (const line of contentLines(raw)) {
    if (line.length === 0) continue
    const m = /^\s*(\d+):\s?(.*)$/.exec(line)
    if (m !== null) {
      out.push({ line: Number(m[1]), text: m[2] ?? '' })
      fallback = Number(m[1]) + 1
    } else {
      out.push({ line: fallback, text: line })
      fallback += 1
    }
  }
  return out
}

/** read 正文（保留空行；markdown 结构依赖空行） */
export function parseReadContent(raw: string): string {
  return contentLines(raw)
    .map((line) => line.replace(/^\s*\d+:\s/, ''))
    .join('\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '')
}

/**
 * 行级 diff（与会话镜头共用 git 镜头的 DiffRow 形状）：
 * 掐掉公共前缀/后缀行，中间部分先是删除行、再是新增行；
 * 两侧行数相同时逐行配对（`pairId`），渲染时可做字符级高亮。
 */
export function lineDiff(before: string, after: string): DiffRow[] {
  const a = before === '' ? [] : before.split('\n')
  const b = after === '' ? [] : after.split('\n')
  let prefix = 0
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++
  let suffix = 0
  while (suffix < a.length - prefix && suffix < b.length - prefix && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) suffix++
  const rows: DiffRow[] = []
  for (let i = 0; i < prefix; i++) rows.push({ kind: 'ctx', text: a[i]!, oldLine: i + 1, newLine: i + 1 })
  const delCount = a.length - prefix - suffix
  const addCount = b.length - prefix - suffix
  const pairLimit = Math.min(delCount, addCount)
  let pairSeq = 0
  for (let i = 0; i < delCount; i++) {
    const row: DiffRow = { kind: 'del', text: a[prefix + i]!, oldLine: prefix + i + 1 }
    if (i < pairLimit) { pairSeq += 1; row.pairId = pairSeq }
    rows.push(row)
  }
  for (let i = 0; i < addCount; i++) {
    const row: DiffRow = { kind: 'add', text: b[prefix + i]!, newLine: prefix + i + 1 }
    if (i < pairLimit) row.pairId = i + 1
    rows.push(row)
  }
  for (let i = 0; i < suffix; i++) {
    const ai = a.length - suffix + i
    rows.push({ kind: 'ctx', text: a[ai]!, oldLine: ai + 1, newLine: b.length - suffix + i + 1 })
  }
  return rows
}

/** 汇总：各类型操作数（面板上的筛选条用） */
export function opCounts(ops: readonly FileOp[]): Record<FileOpKind, number> {
  const out: Record<FileOpKind, number> = { read: 0, write: 0, edit: 0 }
  for (const op of ops) out[op.kind] += 1
  return out
}

/** 一次操作涉及的字节数（write 载荷 / edit 新旧串 / read 正文）；拿不到返回 0 */
export function bytesOf(op: FileOp): number {
  const size = (s: string | undefined): number => (s === undefined ? 0 : new TextEncoder().encode(s).length)
  if (op.kind === 'edit' && op.edit !== undefined) return size(op.edit.oldString) + size(op.edit.newString)
  if (op.kind === 'write') return size(op.content)
  if (op.kind === 'read') return size(op.read)
  return 0
}

/** 人类可读体积（B / KB / MB） */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return ''
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1024 / 1024).toFixed(1) + ' MB'
}

/** 相对时间：返回 i18n 词条与数量，由界面拼文案（保持纯函数、便于单测） */
export function relativeLabel(ms: number, now: number): { key: 'justNow' | 'minutes' | 'hours' | 'days'; n: number } {
  const diff = Math.max(0, now - ms)
  const min = Math.floor(diff / 60000)
  if (min < 1) return { key: 'justNow', n: 0 }
  if (min < 60) return { key: 'minutes', n: min }
  const hours = Math.floor(min / 60)
  if (hours < 24) return { key: 'hours', n: hours }
  return { key: 'days', n: Math.floor(hours / 24) }
}

/** 事件累积上限（与服务端窗口一致）：只留最近这一段，避免长时间轮询把内存撑大 */
export const OPS_EVENTS_CAP = 4000

/** 把新拉到的事件并进累积数组（按 seq 去重 + 保序 + 截断到上限） */
export function mergeEvents(prev: readonly any[], incoming: readonly any[]): any[] {
  if (incoming.length === 0) return prev as any[]
  const seen = new Set(prev.map((e) => Number(e?.seq)))
  const merged = [...prev]
  for (const ev of incoming) {
    const seq = Number(ev?.seq)
    if (!Number.isFinite(seq) || seen.has(seq)) continue
    seen.add(seq)
    merged.push(ev)
  }
  merged.sort((a, b) => Number(a?.seq) - Number(b?.seq))
  return merged.length > OPS_EVENTS_CAP ? merged.slice(merged.length - OPS_EVENTS_CAP) : merged
}
