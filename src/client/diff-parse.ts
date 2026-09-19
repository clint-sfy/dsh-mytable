/**
 * unified diff 解析 + 行内差异计算（纯函数，单测直接打靶）。
 *
 * 服务端只回 `git diff` 的原文（每个文件一段），切分/编号/配对都在这里做：
 *   - 按 `diff --git a/x b/y` 切文件，读 `@@ -old,+new @@` 算两侧行号；
 *   - `-` / `+` / 空格 三类行分别记 old/new 行号，`\ No newline at end of file` 归为 meta；
 *   - **连续的删除块与新增块按顺序配对**（`pairId` 相同）：渲染时给这一对做字符级
 *     「公共前后缀之外就是改动」的高亮，和 VS Code / better-sidebar 的改动手感一致。
 *
 * 不改行本身的 kind（仍是 add / del）——git 风格就是 - 一行 + 一行，配对只影响高亮。
 */

export type DiffRowKind = 'add' | 'del' | 'ctx' | 'meta'

export type DiffRow = {
  kind: DiffRowKind
  text: string
  /** 旧侧行号（新增行没有） */
  oldLine?: number
  /** 新侧行号（删除行没有） */
  newLine?: number
  /** 配对标记：同一次改动的删除行与新增行共享一个 id */
  pairId?: number
}

export type DiffHunk = {
  oldStart: number
  newStart: number
  header: string
  rows: DiffRow[]
}

export type ParsedFileDiff = {
  rel: string
  oldPath?: string
  newPath?: string
  binary: boolean
  hunks: DiffHunk[]
  additions: number
  deletions: number
  /** 文件级元信息（index / new file mode / rename from… 原样保留，便于排查） */
  meta: string[]
}

/** 一个字符级区间（左闭右开） */
export type CharRange = { from: number; to: number }

const HUNK_RE = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/

/** 解析一段（可含多个文件的）unified diff */
export function parseUnifiedDiff(text: string): ParsedFileDiff[] {
  const files: ParsedFileDiff[] = []
  let cur: ParsedFileDiff | null = null
  let hunk: DiffHunk | null = null
  let oldNo = 0
  let newNo = 0
  let pairSeq = 0
  // 连续删除块缓存，遇到新增块时按顺序配对
  let pendingDel: DiffRow[] = []

  const flushPairs = (): void => {
    pendingDel = []
  }
  const pairWithAdd = (addRow: DiffRow): void => {
    const del = pendingDel.shift()
    if (del === undefined) return
    pairSeq++
    del.pairId = pairSeq
    addRow.pairId = pairSeq
  }
  const startFile = (rel: string, oldPath?: string, newPath?: string): void => {
    flushPairs()
    cur = { rel, oldPath, newPath, binary: false, hunks: [], additions: 0, deletions: 0, meta: [] }
    files.push(cur)
    hunk = null
  }

  for (const line of text.split('\n')) {
    if (line.startsWith('diff --git ')) {
      const m = /^diff --git a\/(.+?) b\/(.+)$/.exec(line)
      startFile((m?.[2] ?? '').trim(), m?.[1], m?.[2])
      continue
    }
    if (cur === null) continue
    if (line.startsWith('+++ ')) { cur.newPath = line.slice(4).trim(); continue }
    if (line.startsWith('--- ')) { cur.oldPath = line.slice(4).trim(); continue }
    if (line.startsWith('Binary files ') || line.startsWith('GIT binary patch')) { cur.binary = true; continue }
    if (line.startsWith('@@')) {
      const m = HUNK_RE.exec(line)
      const o = m ? Number(m[1]) : 1
      const n = m ? Number(m[2]) : 1
      oldNo = o
      newNo = n
      hunk = { oldStart: o, newStart: n, header: line, rows: [] }
      cur.hunks.push(hunk)
      flushPairs()
      continue
    }
    if (hunk === null) {
      // 文件级元信息（index / new file mode / similarity index…）
      if (line.trim() !== '') cur.meta.push(line)
      continue
    }
    if (line.startsWith('\\')) {
      hunk.rows.push({ kind: 'meta', text: line.slice(1).trim() })
      continue
    }
    const sign = line[0]
    const body = line.slice(1)
    if (sign === '+') {
      const row: DiffRow = { kind: 'add', text: body, newLine: newNo++ }
      pairWithAdd(row)
      hunk.rows.push(row)
      cur.additions++
      continue
    }
    if (sign === '-') {
      const row: DiffRow = { kind: 'del', text: body, oldLine: oldNo++ }
      pendingDel.push(row)
      hunk.rows.push(row)
      cur.deletions++
      continue
    }
    // 上下文行：两侧行号都前进
    flushPairs()
    hunk.rows.push({ kind: 'ctx', text: body, oldLine: oldNo++, newLine: newNo++ })
  }
  return files
}

/** 逐文件的改动行数汇总（服务端已给，这里兜底重算用） */
export function countChanges(files: ParsedFileDiff[]): { additions: number; deletions: number } {
  let additions = 0
  let deletions = 0
  for (const f of files) { additions += f.additions; deletions += f.deletions }
  return { additions, deletions }
}

/**
 * 两行的字符级差异：去掉公共前缀与公共后缀，中间就是改动区间。
 * 相同行返回空区间（不会误报改动）。
 */
export function diffInline(oldText: string, newText: string): { old: CharRange | null; next: CharRange | null } {
  if (oldText === newText) return { old: null, next: null }
  const max = Math.min(oldText.length, newText.length)
  let prefix = 0
  while (prefix < max && oldText[prefix] === newText[prefix]) prefix++
  let suffix = 0
  while (suffix < max - prefix && oldText[oldText.length - 1 - suffix] === newText[newText.length - 1 - suffix]) suffix++
  const oldMid = { from: prefix, to: oldText.length - suffix }
  const newMid = { from: prefix, to: newText.length - suffix }
  return {
    old: oldMid.to > oldMid.from ? oldMid : null,
    next: newMid.to > newMid.from ? newMid : null,
  }
}

/** 把配对行整理成 `pairId → { old: 文本, next: 文本 }`，供渲染时算行内区间 */
export function collectPairs(files: ParsedFileDiff[]): Map<number, { old: string; next: string }> {
  const rows: DiffRow[] = []
  for (const f of files) for (const h of f.hunks) rows.push(...h.rows)
  return pairsFromRows(rows)
}

/** 同一件事的行内版本：直接从行数组建配对表（会话镜头与 Git 镜头共用） */
export function pairsFromRows(rows: readonly DiffRow[]): Map<number, { old: string; next: string }> {
  const dels = new Map<number, string>()
  const adds = new Map<number, string>()
  for (const row of rows) {
    if (row.pairId === undefined) continue
    if (row.kind === 'del') dels.set(row.pairId, row.text)
    else if (row.kind === 'add') adds.set(row.pairId, row.text)
  }
  const out = new Map<number, { old: string; next: string }>()
  for (const [id, oldText] of dels) {
    const next = adds.get(id)
    if (next !== undefined) out.set(id, { old: oldText, next })
  }
  return out
}

/** 一段未改动区间（两个 hunk 之间、或文件开头到第一个 hunk 之前） */
export type GapInfo = {
  /** 这段区间在**旧侧**的起始行号（1 基） */
  oldStart: number
  /** 新侧起始行号 */
  newStart: number
  /** 行数（两侧相同） */
  count: number
}

/** 一个文件 diff 的排版信息：每个 hunk 头在第几行、每段 gap 渲染在第几行之前 */
export type DiffLayout = {
  /** 第 k 个 hunk 头应渲染在 rows 的哪个下标处 */
  hunkRowIndex: number[]
  /** 渲染下标 → 该处之前的未改动区间（含文件开头那段） */
  gaps: Map<number, GapInfo>
}

/**
 * 由 hunk 头算出「未改动区间」的位置与行号：`@@ -a,b +c,d @@` 只给了起点，
 * 每个 hunk 占多少行由它的 rows 决定（旧侧 = 有 oldLine 的行数，新侧同理）。
 * 客户端拿它画「⋯ N 行未改动」，展开时按行号去取内容。
 */
export function diffLayout(file: ParsedFileDiff): DiffLayout {
  const hunkRowIndex: number[] = []
  const gaps = new Map<number, GapInfo>()
  let rowIndex = 0
  let prevOldEnd = 0
  let prevNewEnd = 0
  for (const hunk of file.hunks) {
    const oldCount = hunk.rows.reduce((acc, r) => acc + (r.oldLine !== undefined ? 1 : 0), 0)
    const newCount = hunk.rows.reduce((acc, r) => acc + (r.newLine !== undefined ? 1 : 0), 0)
    const oldStart = hunk.oldStart > 0 ? hunk.oldStart : prevOldEnd + 1
    const newStart = hunk.newStart > 0 ? hunk.newStart : prevNewEnd + 1
    const gapCount = oldStart - prevOldEnd - 1
    if (gapCount > 0) gaps.set(rowIndex, { oldStart: prevOldEnd + 1, newStart: prevNewEnd + 1, count: gapCount })
    hunkRowIndex.push(rowIndex)
    rowIndex += hunk.rows.length
    prevOldEnd = oldStart + oldCount - 1
    prevNewEnd = newStart + newCount - 1
  }
  return { hunkRowIndex, gaps }
}

/** 从整份文件文本里取一段行（gap 展开时用；start 为 1 基） */
export function sliceLines(text: string, start: number, count: number): string[] {
  if (count <= 0) return []
  const lines = text.split('\n')
  return lines.slice(Math.max(0, start - 1), Math.max(0, start - 1) + count)
}
