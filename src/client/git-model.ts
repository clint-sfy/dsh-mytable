/**
 * Git 镜头的文件模型（纯逻辑，单测直接打靶）：把「一个文件」摊成按侧（已暂存 / 未暂存）的列表项，
 * 以及 porcelain 状态位到语义的映射。
 *
 * 一个文件可能同时出现在两侧（既暂存了一版、又改了工作区），这与编辑器的 SCM 视图一致；
 * 未跟踪文件只出现在未暂存侧，且没有 diff 时也照样列出来。
 */

/** 一侧的 diff 与增删计数 */
export type GitSide = { diff: string; additions: number; deletions: number }

/** 宿主 /api/worktable/diff 回来的一个文件 */
export type GitFile = {
  path: string
  rel: string
  status: string
  untracked: boolean
  staged?: GitSide
  unstaged?: GitSide
}

/** 列表项：文件 × 侧 */
export type GitEntry = { key: string; file: GitFile; side: 'staged' | 'unstaged'; data: GitSide }

/** 状态语义（界面自己映射文案，避免把中文写进逻辑层） */
export type StatusKind = 'new' | 'modified' | 'added' | 'deleted' | 'renamed' | 'other'

/** porcelain 两位状态（XY）→ 语义；`??` 是未跟踪 */
export function statusKind(xy: string): StatusKind {
  if (xy === '??') return 'new'
  const t = xy.trim()
  if (t.includes('R')) return 'renamed'
  if (t.includes('A')) return 'added'
  if (t.includes('D')) return 'deleted'
  if (t.includes('M')) return 'modified'
  return 'other'
}

/**
 * 按「侧」把文件摊平成列表项：已暂存的一律排在前面，同侧按路径不区分大小写排序。
 * 两侧都没有 diff 的文件（例如二进制、或 diff 被截断）也会列出来，只是选中后没有行可渲染。
 */
export function entriesOf(files: readonly GitFile[]): GitEntry[] {
  const out: GitEntry[] = []
  for (const file of files) {
    if (file.staged !== undefined) out.push({ key: file.rel + ':staged', file, side: 'staged', data: file.staged })
    if (file.unstaged !== undefined) out.push({ key: file.rel + ':unstaged', file, side: 'unstaged', data: file.unstaged })
    if (file.staged === undefined && file.unstaged === undefined) {
      out.push({ key: file.rel + ':none', file, side: 'unstaged', data: { diff: '', additions: 0, deletions: 0 } })
    }
  }
  out.sort((a, b) => (a.side === b.side
    ? a.file.rel.localeCompare(b.file.rel, undefined, { sensitivity: 'base' })
    : a.side === 'staged' ? -1 : 1))
  return out
}

/** 两侧的增删合计（工具栏总计用） */
export function totalsOf(files: readonly GitFile[]): { additions: number; deletions: number } {
  let additions = 0
  let deletions = 0
  for (const f of files) {
    additions += (f.staged?.additions ?? 0) + (f.unstaged?.additions ?? 0)
    deletions += (f.staged?.deletions ?? 0) + (f.unstaged?.deletions ?? 0)
  }
  return { additions, deletions }
}
