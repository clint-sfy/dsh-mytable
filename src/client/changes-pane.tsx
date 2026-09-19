/**
 * 文件变动窗：一个窗口两个镜头（写法与信息结构对齐 DSH-better-sidebar 的 changes tab）。
 *
 * **会话镜头（agent 真相）**：这次对话里模型读 / 写 / 改过的文件。数据来自宿主 `/api/worktable/ops`
 * （读本会话事件日志的 tool/call + tool/result），客户端折成文件操作（session-ops.ts）。
 * 面板**按游标轮询**（afterSeq 增量，3 秒一次），agent 干活时新操作自动冒出来；显示相对时间与体积。
 *
 * **Git 镜头（仓库真相）**：已暂存 / 未暂存分组、每文件暂存·取消暂存·丢弃改动、提交框、
 * 提交历史（分页）与某次提交的 diff（多文件）。未跟踪文件按「整份新增」合成。
 *
 * 两个镜头共用同一套 diff 渲染器：行号 gutter、hunk 头、增删底色、**改动字符级高亮**、
 * **未改动区间可展开**（按侧取对应版本的文件内容：未暂存读工作区文件，已暂存读索引 blob）、
 * 行数上限可展开。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { T, splitScope, splitStore, useHostScheme, type PaneRow } from './split'
import { diffLayout, pairsFromRows, parseUnifiedDiff, type DiffHunk, type DiffRow, type GapInfo, type ParsedFileDiff } from './diff-parse'
import {
  bytesOf, extractFileOps, formatBytes, formatTokens, groupByFile, groupByQa, lineDiff, mergeEvents, opCounts,
  parseReadLines, previewSides, relativeLabel, turnsToMap, type FileOp, type FileOpKind, type TurnStat,
} from './session-ops'
import { entriesOf, statusKind, totalsOf, type GitEntry, type GitFile } from './git-model'
import { highlightCode } from './code-highlight'
import { referenceInChat } from './reference-in-chat'
import { copyText } from './clipboard'
import { basenameOf, isAbs, joinPath, relativeTo } from './pathutil'

/** 一次渲染的行数上限（超出给「展开全部」） */
const MAX_ROWS = 600
/** 会话镜头轮询间隔 */
const POLL_INTERVAL_MS = 3000

/**
 * 提交 diff 里默认展开哪些文件（对齐参考实现的 defaultExpandedFiles）：
 * **只有源码默认摊开**，测试 / 文档 / 生成物（lock、dist…）与认不出的类型默认折叠——
 * 一次提交改十几个文件时，第一眼看到的是「路径 + ±行数」清单，而不是几千行 diff。
 */
const TEST_PATH = /(^|\/)(?:__tests__|tests?|specs?|fixtures?|mocks?|snapshots?)(?:\/|$)|\.(?:test|spec)\.[^/]+$/i
const DOC_PATH = /(^|\/)(?:docs?|documentation)(?:\/|$)|(^|\/)(?:readme|changelog|contributing|license|authors|notice)(\.[^/]*)?$/i
const GENERATED_PATH = /(^|\/)(?:dist|build|coverage|generated|vendor|node_modules)(?:\/|$)|(^|\/)(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|composer\.lock|cargo\.lock|poetry\.lock)$/i
const SOURCE_PATH = /\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts|py|pyw|rb|php|java|kt|kts|scala|go|rs|swift|c|h|cc|cpp|cxx|hpp|hh|hxx|cs|fs|fsx|vb|dart|lua|r|ex|exs|erl|hrl|clj|cljs|cljc|groovy|sh|bash|zsh|fish|ps1|sql|vue|svelte|astro|html|htm|css|scss|sass|less)$/i
function defaultExpandedCommitFiles(files: ParsedFileDiff[]): Set<string> {
  const open = new Set<string>()
  for (const f of files) {
    if (!f.binary && f.hunks.length > 0
      && !TEST_PATH.test(f.rel) && !DOC_PATH.test(f.rel) && !GENERATED_PATH.test(f.rel) && SOURCE_PATH.test(f.rel)) {
      open.add(f.rel)
    }
  }
  return open
}

type Lens = 'session' | 'git'
type GitView = 'changes' | 'history'
type Commit = { hash: string; short: string; author: string; time: number; subject: string; refs?: string[] }
/** 仓库列表项：branch / changes 由服务端随发现结果一起给出（用于面板里直接显示分支与脏文件数） */
type RepoInfo = { path: string; name: string; branch?: string; changes?: number }

/**
 * 视图状态持久化：切标签会把面板卸载重建，镜头 / 子视图 / 仓库 / 筛选 / 选中项都得留住，
 * 否则「切出去看一眼文件再切回来」就回到了默认的会话镜头（参考实现把这些存在 tab meta 里）。
 */
const VIEW_KEY = 'dsh.mytable.changes.v1'
type ViewState = { lens: Lens; gitView: GitView; repo: string; filter: 'all' | FileOpKind | 'io'; selectedKey: string | null; selectedOp: string | null }
function loadView(): ViewState {
  const base: ViewState = { lens: 'session', gitView: 'changes', repo: '', filter: 'all', selectedKey: null, selectedOp: null }
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(VIEW_KEY)
    if (raw !== null) {
      const parsed: any = JSON.parse(raw)
      if (parsed?.lens === 'git' || parsed?.lens === 'session') base.lens = parsed.lens
      if (parsed?.gitView === 'history' || parsed?.gitView === 'changes') base.gitView = parsed.gitView
      if (typeof parsed?.repo === 'string') base.repo = parsed.repo
      if (parsed?.filter === 'all' || parsed?.filter === 'read' || parsed?.filter === 'write' || parsed?.filter === 'edit' || parsed?.filter === 'io') base.filter = parsed.filter
      if (typeof parsed?.selectedKey === 'string') base.selectedKey = parsed.selectedKey
      if (typeof parsed?.selectedOp === 'string') base.selectedOp = parsed.selectedOp
    }
  } catch { /* 坏值 → 默认 */ }
  return base
}

async function postJson(url: string, body: unknown): Promise<any> {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return res.json()
}

/** 状态位 → 界面文案（语义在 git-model.statusKind，文案在这里） */
function statusLabel(xy: string): string {
  const kind = statusKind(xy)
  if (kind === 'new') return T('changes.statusNew')
  if (kind === 'modified') return T('changes.statusModified')
  if (kind === 'added') return T('changes.statusAdded')
  if (kind === 'deleted') return T('changes.statusDeleted')
  if (kind === 'renamed') return T('changes.statusRenamed')
  return '·'
}

function kindLabel(kind: FileOpKind): string {
  return kind === 'read' ? T('changes.kindRead') : kind === 'write' ? T('changes.kindWrite') : T('changes.kindEdit')
}

/** 一段文本的着色渲染；给了 range 就把改动区间单独裹一层（行内高亮） */
function LineText(props: { text: string; path: string; range?: { from: number; to: number } | null }) {
  const { text, path, range } = props
  if (range == null || range.to <= range.from) {
    return <span className="dsh-mt_diffText" dangerouslySetInnerHTML={{ __html: highlightCode(text, path).html }} />
  }
  const before = text.slice(0, range.from)
  const mid = text.slice(range.from, range.to)
  const after = text.slice(range.to)
  return (
    <span className="dsh-mt_diffText">
      {before !== '' && <span dangerouslySetInnerHTML={{ __html: highlightCode(before, path).html }} />}
      <span className="dsh-mt_diffInline" data-diff-inline="1" dangerouslySetInnerHTML={{ __html: highlightCode(mid, path).html }} />
      {after !== '' && <span dangerouslySetInnerHTML={{ __html: highlightCode(after, path).html }} />}
    </span>
  )
}

/**
 * 一份 diff 的行列表（两个镜头共用）：hunk 头、未改动区间（可展开）、增删行 + 行内高亮。
 */
function DiffRows(props: {
  rows: DiffRow[]
  path: string
  pairs?: Map<number, { old: string; next: string }>
  layout?: { hunkRowIndex: number[]; gaps: Map<number, GapInfo> }
  hunks?: DiffHunk[]
  expandedGaps?: Map<number, string[]>
  gapLoading?: Set<number>
  onToggleGap?: (index: number, gap: GapInfo) => void
  expandedAll?: boolean
  onExpandAll?: () => void
}) {
  const { rows, path, pairs, layout, hunks, expandedGaps, gapLoading, onToggleGap, expandedAll, onExpandAll } = props
  const shown = expandedAll ? rows : rows.slice(0, MAX_ROWS)
  const headers = useMemo(() => {
    const map = new Map<number, string>()
    if (layout !== undefined && hunks !== undefined) {
      layout.hunkRowIndex.forEach((idx, k) => { const h = hunks[k]; if (h !== undefined) map.set(idx, h.header) })
    }
    return map
  }, [layout, hunks])
  const inlineFor = (row: DiffRow): { from: number; to: number } | null => {
    if (row.pairId === undefined || pairs === undefined) return null
    const pair = pairs.get(row.pairId)
    if (pair === undefined) return null
    let prefix = 0
    while (prefix < pair.old.length && prefix < pair.next.length && pair.old[prefix] === pair.next[prefix]) prefix++
    let suffix = 0
    while (suffix < pair.old.length - prefix && suffix < pair.next.length - prefix
      && pair.old[pair.old.length - 1 - suffix] === pair.next[pair.next.length - 1 - suffix]) suffix++
    const range = row.kind === 'del'
      ? { from: prefix, to: pair.old.length - suffix }
      : { from: prefix, to: pair.next.length - suffix }
    return range.to > range.from ? range : null
  }
  return (
    <div className="dsh-mt_diffRows" data-diff-rows={rows.length}>
      {shown.map((row, i) => {
        const gap = layout?.gaps.get(i)
        const header = headers.get(i)
        const gapLines = expandedGaps?.get(i)
        const loading = gapLoading?.has(i) === true
        return (
          <div key={i}>
            {gap !== undefined && (gapLines !== undefined
              ? gapLines.map((text, gi) => (
                <div key={'g' + String(gi)} className="dsh-mt_diffRow" data-kind="ctx" data-diff-gap-line="1">
                  <span className="dsh-mt_diffLineNo">{gap.oldStart + gi}</span>
                  <span className="dsh-mt_diffLineNo">{gap.newStart + gi}</span>
                  <span className="dsh-mt_diffSign"> </span>
                  <LineText text={text} path={path} />
                </div>
              ))
              : (
                <div
                  className="dsh-mt_diffGap"
                  data-diff-gap={gap.count}
                  data-diff-gap-loading={loading ? '1' : undefined}
                  onClick={loading || onToggleGap === undefined ? undefined : () => onToggleGap(i, gap)}
                >
                  {loading ? T('changes.gapLoading') : T('changes.gap', { n: String(gap.count) })}
                </div>
              ))}
            {header !== undefined && <div className="dsh-mt_diffHunk" data-diff-hunk="1">{header}</div>}
            {row.kind === 'meta'
              ? <div className="dsh-mt_diffRow" data-kind="meta"><span className="dsh-mt_diffMeta">{row.text}</span></div>
              : (
                <div className="dsh-mt_diffRow" data-kind={row.kind}>
                  <span className="dsh-mt_diffLineNo">{row.oldLine !== undefined ? row.oldLine : ''}</span>
                  <span className="dsh-mt_diffLineNo">{row.newLine !== undefined ? row.newLine : ''}</span>
                  <span className="dsh-mt_diffSign">{row.kind === 'add' ? '+' : row.kind === 'del' ? '-' : ' '}</span>
                  <LineText text={row.text} path={path} range={inlineFor(row)} />
                </div>
              )}
          </div>
        )
      })}
      {expandedAll !== true && rows.length > shown.length && (
        <button type="button" className="dsh-mt_diffGap" data-diff-expand-all="1" onClick={onExpandAll}>
          {T('changes.expandRows', { n: String(rows.length - shown.length) })}
        </button>
      )}
    </div>
  )
}

export function ChangesPane(props: { row: PaneRow; index: number }) {
  const dark = useHostScheme()
  const initialView = useMemo(loadView, [])
  const [lens, setLens] = useState<Lens>(initialView.lens)
  const [tick, setTick] = useState(0)
  const [note, setNote] = useState('')
  const [listPercent, setListPercent] = useState(34)
  const listResizeRef = useRef<{ left: number; width: number } | null>(null)
  const scope = splitScope()
  const cwd = scope?.cwd ?? ''

  // ── 会话镜头 ──────────────────────────────────────────────────────────────
  const [ops, setOps] = useState<FileOp[] | null>(null)
  const [opsLive, setOpsLive] = useState(true)
  /** 第几轮 → 该轮的「用户输入 / 最终输出 / token 用量 / 工具数」（服务端随 `/ops` 给） */
  const [turnStats, setTurnStats] = useState<Map<number, TurnStat>>(new Map())
  /** 本次会话的累计统计（顶部一行） */
  const [sessionStats, setSessionStats] = useState<{ input: number; output: number; cacheRead: number; total: number; turns: number; tools: number } | null>(null)
  const [opError, setOpError] = useState('')
  const [filter, setFilter] = useState<'all' | FileOpKind | 'io'>(initialView.filter)
  const [selectedOp, setSelectedOp] = useState<string | null>(initialView.selectedOp)
  const eventsRef = useRef<any[]>([])
  const cursorRef = useRef<number>(-1)
  const [lastPull, setLastPull] = useState(0)

  useEffect(() => {
    if (lens !== 'session') return
    let cancelled = false
    const pull = async (): Promise<void> => {
      try {
        const d = await postJson('/api/worktable/ops', { sessionId: scope?.sessionId ?? '', afterSeq: cursorRef.current })
        if (cancelled) return
        setOpsLive(d?.live !== false)
        if (typeof d?.lastSeq === 'number') cursorRef.current = d.lastSeq
        if (Array.isArray(d?.turns)) setTurnStats(turnsToMap(d.turns))
        if (d?.total !== null && typeof d?.total === 'object') {
          const t = d.total as Record<string, unknown>
          const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0)
          setSessionStats({
            input: num(t.input), output: num(t.output), cacheRead: num(t.cacheRead),
            total: num(t.total), turns: num(t.turns), tools: num(t.tools),
          })
        }
        eventsRef.current = mergeEvents(eventsRef.current, Array.isArray(d?.events) ? d.events : [])
        const folded = extractFileOps(eventsRef.current)
        setOps(folded)
        setLastPull(Date.now())
        setOpError('')
        setSelectedOp((prev) => (prev !== null && folded.some((o) => o.callId === prev) ? prev : (folded[0]?.callId ?? null)))
      } catch (e) {
        if (!cancelled) { setOps((prev) => prev ?? []); setOpError(String(e)) }
      }
    }
    void pull()
    const timer = window.setInterval(() => { void pull() }, POLL_INTERVAL_MS)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [lens, scope?.sessionId, tick])

  // ── Git 镜头 ──────────────────────────────────────────────────────────────
  const [gitView, setGitView] = useState<GitView>(initialView.gitView)
  const [repos, setRepos] = useState<RepoInfo[]>([])
  const [repo, setRepo] = useState(initialView.repo)
  const [repoMenu, setRepoMenu] = useState(false)
  const [repoInput, setRepoInput] = useState('')
  const [searchedRoot, setSearchedRoot] = useState('')
  const [git, setGit] = useState<{ isRepo: boolean; root: string; branch: string; files: GitFile[]; truncated: boolean } | null>(null)
  const [branchInfo, setBranchInfo] = useState<{ isRepo: boolean; branch: string; branches: string[] } | null>(null)
  const [busy, setBusy] = useState(false)
  /**
   * 用户是否**显式**指定过仓库（下拉里选 / 手填路径）。
   * 仓库发现每次刷新都会重跑，早期版本用「不在发现列表里就重置成第一个」的规则——
   * 于是手填的仓库（比如工作区之外、或 `.tmp` 下这种被点目录规则跳过的）每次 tick 都被悄悄换掉，
   * 表现就是「选了没用 / 看不到数据」。显式选择过就不再覆盖。
   */
  const explicitRepo = useRef(initialView.repo !== '')
  const [gitError, setGitError] = useState('')
  const [actionError, setActionError] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(initialView.selectedKey)
  const [confirmDiscard, setConfirmDiscard] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [committing, setCommitting] = useState(false)
  const [commits, setCommits] = useState<Commit[]>([])
  const [commitHasMore, setCommitHasMore] = useState(false)
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null)
  const [commitFiles, setCommitFiles] = useState<ParsedFileDiff[] | null>(null)
  /** 提交 diff 里展开着的文件（按 rel；进新提交时按 defaultExpandedCommitFiles 重算） */
  const [openCommitFiles, setOpenCommitFiles] = useState<Set<string>>(new Set())
  /** 预览区当前显示的是「某个文件的改动」还是「某次提交的改动」（点文件行/提交行各自切换） */
  const [previewMode, setPreviewMode] = useState<'file' | 'commit' | 'msg'>(initialView.gitView === 'history' ? 'commit' : 'file')
  /** 正在预览的那段对话文本（点层里的「用户输入 / 最终输出」块） */
  const [selectedMsg, setSelectedMsg] = useState<{ qa: number; kind: 'input' | 'output' } | null>(null)
  const [expandedGaps, setExpandedGaps] = useState<Map<number, string[]>>(new Map())
  const [gapLoading, setGapLoading] = useState<Set<number>>(new Set())
  const [expandedAll, setExpandedAll] = useState(false)
  const blobCache = useRef<Map<string, string>>(new Map())

  // 视图状态变化就写回（下次切回来/刷新后还在原来的位置）
  useEffect(() => {
    try { localStorage.setItem(VIEW_KEY, JSON.stringify({ lens, gitView, repo, filter, selectedKey, selectedOp })) } catch { /* 写不进就算了 */ }
  }, [filter, gitView, lens, repo, selectedKey, selectedOp])

  const gitBody = useMemo(() => ({ cwd, ...(repo !== '' ? { repo } : {}) }), [cwd, repo])

  // 当前仓库：可能在发现列表里，也可能是「手动填路径」填进来的。手动路径不在列表里时
  // 退回显示路径最后一段——早期版本会退回占位文案「选择仓库」，看着像没选上。
  const curRepo = repos.find((r) => r.path === repo) ?? null
  const curRepoLabel = curRepo?.name ?? (repo !== '' ? basenameOf(repo) : T('changes.pickRepo'))
  /** 仓库下拉项的文案对齐参考实现：`分支 · 仓库名（改动数）`，一眼看出该选哪个 */
  const repoOptionLabel = (r: RepoInfo): string => {
    const head = r.branch !== undefined && r.branch !== '' ? r.branch + ' · ' : ''
    return `${head}${r.name} (${r.changes ?? 0})`
  }
  const isRepo = branchInfo?.isRepo === true || git?.isRepo === true
  const branch = branchInfo?.branch ?? git?.branch ?? ''
  const branchOptions = useMemo(() => {
    const names = branchInfo?.branches ?? []
    if (branch === '') return names
    return [branch, ...names.filter((n) => n !== branch)]
  }, [branch, branchInfo])

  // 分支清单：Git 镜头下和仓库发现同一节奏地取（都很便宜：rev-parse + for-each-ref）
  useEffect(() => {
    if (lens !== 'git') return
    let dead = false
    postJson('/api/worktable/git-branches', gitBody)
      .then((d) => {
        if (dead) return
        setBranchInfo({
          isRepo: d?.isRepo === true,
          branch: typeof d?.branch === 'string' ? d.branch : '',
          branches: Array.isArray(d?.branches) ? d.branches.filter((x: unknown): x is string => typeof x === 'string') : [],
        })
      })
      .catch(() => { if (!dead) setBranchInfo(null) })
    return () => { dead = true }
  }, [gitBody, lens, tick])

  useEffect(() => {
    if (lens !== 'git') return
    let dead = false
    postJson('/api/worktable/repos', { cwd })
      .then((d) => {
        if (dead) return
        const list: RepoInfo[] = Array.isArray(d?.repos) ? d.repos : []
        setRepos(list)
        setSearchedRoot(String(d?.searched ?? d?.root ?? cwd))
        setRepo((prev) => {
          // 选中的仓库还在列表里 → 保持；显式选过的（手填路径 / 下拉选的）→ 也不动它
          if (prev !== '' && (list.some((r) => r.path === prev) || explicitRepo.current)) return prev
          // 否则默认选「有改动的」那个（列表已按改动数倒序，仍然显式挑一遍，别依赖服务端排序）
          return list.find((r) => (r.changes ?? 0) > 0)?.path ?? list[0]?.path ?? ''
        })
      })
      .catch((e) => { if (!dead) setGitError(String(e)) })
    return () => { dead = true }
  }, [cwd, lens, tick])

  // 工作区换了（会话 cwd 变了）：显式选择不再适用，让发现结果重新挑一个
  const lastCwd = useRef(cwd)
  useEffect(() => {
    if (lastCwd.current === cwd) return
    lastCwd.current = cwd
    explicitRepo.current = false
    setRepo('')
  }, [cwd])

  useEffect(() => {
    if (lens !== 'git' || gitView !== 'changes') return
    let dead = false
    postJson('/api/worktable/diff', gitBody)
      .then((d) => {
        if (dead) return
        setGit(d)
        const files: GitFile[] = Array.isArray(d?.files) ? d.files : []
        setSelectedKey((prev) => (prev !== null && entriesOf(files).some((e) => e.key === prev) ? prev : (entriesOf(files)[0]?.key ?? null)))
      })
      .catch((e) => { if (!dead) setGitError(String(e)) })
    return () => { dead = true }
  }, [gitBody, gitView, lens, tick])

  useEffect(() => {
    if (lens !== 'git' || gitView !== 'history') return
    let dead = false
    const limit = 30
    postJson('/api/worktable/git-log', { ...gitBody, limit, skip: 0 })
      .then((d) => {
        if (dead) return
        const page: Commit[] = Array.isArray(d?.commits) ? d.commits : []
        setCommits(page)
        setCommitHasMore(page.length === limit)
        setSelectedCommit((prev) => (prev !== null && page.some((c) => c.hash === prev) ? prev : (page[0]?.hash ?? null)))
      })
      .catch((e) => { if (!dead) setGitError(String(e)) })
    return () => { dead = true }
  }, [gitBody, gitView, lens, tick])

  useEffect(() => {
    if (lens !== 'git' || previewMode !== 'commit' || selectedCommit === null) { setCommitFiles(null); return }
    let dead = false
    postJson('/api/worktable/git-show', { ...gitBody, hash: selectedCommit })
      .then((d) => {
        if (dead) return
        if (d?.ok === true) {
          const parsedFiles = parseUnifiedDiff(String(d.output ?? ''))
          setCommitFiles(parsedFiles)
          setOpenCommitFiles(defaultExpandedCommitFiles(parsedFiles))
          setActionError('')
        } else { setCommitFiles([]); setOpenCommitFiles(new Set()); setActionError(String(d?.output ?? '')) }
      })
      .catch((e) => { if (!dead) setActionError(String(e)) })
    return () => { dead = true }
  }, [gitBody, lens, previewMode, selectedCommit])

  // 选中项变化时复位 diff 的展开状态
  useEffect(() => {
    setExpandedGaps(new Map())
    setGapLoading(new Set())
    setExpandedAll(false)
  }, [selectedCommit, selectedKey])

  const flash = useCallback((text: string) => {
    setNote(text)
    window.setTimeout(() => setNote(''), 2200)
  }, [])

  const openFile = useCallback((path: string) => {
    const resolved = isAbs(path) || cwd === '' ? path : joinPath(cwd, path)
    splitStore.openTab(props.row, props.index, { kind: 'file', path: resolved })
  }, [cwd, props.index, props.row])

  const reference = useCallback((path: string) => {
    const outcome = referenceInChat(path, false, splitScope())
    flash(outcome === 'fail' ? T('exp.refFail') : T('exp.refDone', { path: relativeTo(cwd, path) }))
  }, [cwd, flash])

  const runGitAction = useCallback(async (url: string, body: Record<string, unknown>, done: string) => {
    try {
      const d = await postJson(url, { ...gitBody, ...body })
      if (d?.ok !== true) { setActionError(String(d?.output ?? 'failed')); return }
      setActionError('')
      blobCache.current.clear()
      flash(done)
      setTick((t) => t + 1)
    } catch (e) {
      setActionError(String(e))
    }
  }, [blobCache, flash, gitBody])

  /** 展开一段未改动区间：按侧取对应版本（未暂存=工作区文件，已暂存=索引 blob） */
  const toggleGap = useCallback(async (entry: GitEntry, index: number, gap: GapInfo) => {
    const key = entry.key + '#' + String(index)
    setGapLoading((prev) => new Set(prev).add(index))
    try {
      let text = blobCache.current.get(key)
      if (text === undefined) {
        if (entry.side === 'staged') {
          const d = await postJson('/api/worktable/git-blob', { ...gitBody, rel: entry.file.rel, rev: '' })
          text = d?.ok === true ? String(d.output ?? '') : ''
        } else {
          const r = await fetch('/api/worktable/file?path=' + encodeURIComponent(entry.file.path))
          text = r.ok ? await r.text() : ''
        }
        blobCache.current.set(key, text)
      }
      const lines = text.split('\n').slice(Math.max(0, gap.newStart - 1), Math.max(0, gap.newStart - 1) + gap.count)
      setExpandedGaps((prev) => new Map(prev).set(index, lines))
    } catch {
      flash(T('changes.gapFail'))
    } finally {
      setGapLoading((prev) => { const next = new Set(prev); next.delete(index); return next })
    }
  }, [blobCache, flash, gitBody])

  /** 切分支（分支下拉的 onChange）：失败把 git 原文显示在动作错误条里，并让下拉回到真实分支 */
  const doCheckout = useCallback(async (name: string): Promise<void> => {
    if (name === '' || name === branch || busy) return
    setBusy(true)
    try {
      const d = await postJson('/api/worktable/git-checkout', { ...gitBody, branch: name })
      if (d?.ok !== true) {
        setActionError(T('changes.branchFail', { msg: String(d?.output ?? 'checkout failed') }))
        setTick((t) => t + 1)
        return
      }
      setActionError('')
      blobCache.current.clear()
      flash(T('changes.branchDone', { name }))
      setTick((t) => t + 1)
    } catch (e) {
      setActionError(String(e))
    } finally {
      setBusy(false)
    }
  }, [blobCache, branch, busy, flash, gitBody])

  /** 提交：把已暂存的改动提交掉（Ctrl/Cmd+Enter 也行） */
  const doCommit = useCallback(async (): Promise<void> => {
    if (committing || message.trim() === '') return
    setCommitting(true)
    try {
      const d = await postJson('/api/worktable/git-commit', { ...gitBody, message: message.trim() })
      if (d?.ok !== true) { setActionError(String(d?.output ?? 'commit failed')); return }
      setActionError('')
      setMessage('')
      flash(T('changes.commitDone', { short: String(d.output ?? '').split('\n')[0].slice(0, 48) }))
      setTick((t) => t + 1)
    } catch (e) {
      setActionError(String(e))
    } finally {
      setCommitting(false)
    }
  }, [committing, flash, gitBody, message])

  const counts = useMemo(() => opCounts(ops ?? []), [ops])
  const visibleOps = useMemo(() => (ops ?? []).filter((o) => filter === 'all' || o.kind === filter), [ops, filter])
  const groups = useMemo(() => groupByFile(visibleOps), [visibleOps])
  /** 一层一层地看（一条提问 + 最终答复），层内再按轮；最新的层与轮都排最上面 */
  const qaGroups = useMemo(() => groupByQa(visibleOps, turnStats), [visibleOps, turnStats])
  /** 层/轮展开状态的人工覆盖（没覆盖时：最新一层展开，层内只有一轮时那轮也展开） */
  const [qaOverrides, setQaOverrides] = useState<Map<number, boolean>>(new Map())
  const [turnOverrides, setTurnOverrides] = useState<Map<number, boolean>>(new Map())
  const currentOp = useMemo(() => (ops ?? []).find((o) => o.callId === selectedOp) ?? null, [ops, selectedOp])
  const preview = useMemo(() => {
    if (currentOp === null) return null
    const sides = previewSides(currentOp, ops ?? [])
    if (currentOp.isError) return { kind: 'error' as const, text: currentOp.errorText ?? '' }
    if (currentOp.kind === 'read') return { kind: 'content' as const, lines: parseReadLines(currentOp.read ?? '') }
    return { kind: 'diff' as const, rows: lineDiff(sides.before ?? '', sides.after ?? '') }
  }, [currentOp, ops])

  const entries = useMemo(() => entriesOf(git?.files ?? []), [git])
  const currentEntry = useMemo(() => entries.find((e) => e.key === selectedKey) ?? null, [entries, selectedKey])
  const parsed = useMemo(() => (currentEntry === null ? null : parseUnifiedDiff(currentEntry.data.diff)[0] ?? null), [currentEntry])
  const rows = useMemo(() => (parsed === null ? [] : parsed.hunks.flatMap((h) => h.rows)), [parsed])
  const layout = useMemo(() => (parsed === null ? undefined : diffLayout(parsed)), [parsed])
  const pairMap = useMemo(() => pairsFromRows(rows), [rows])
  const stagedCount = useMemo(() => (git?.files ?? []).filter((f) => f.staged !== undefined).length, [git])
  const unstagedCount = useMemo(() => (git?.files ?? []).filter((f) => f.unstaged !== undefined).length, [git])
  const totals = useMemo(() => totalsOf(git?.files ?? []), [git])

  const relTime = (ms: number): string => {
    const { key, n } = relativeLabel(ms, lastPull || Date.now())
    if (key === 'justNow') return T('changes.justNow')
    if (key === 'minutes') return T('changes.minutesAgo', { n: String(n) })
    if (key === 'hours') return T('changes.hoursAgo', { n: String(n) })
    return T('changes.daysAgo', { n: String(n) })
  }

  /** 列表里的一行：文件（按侧）+ 悬停出的操作键 */
  const renderGitEntry = (entry: GitEntry) => (
    <div
      key={entry.key}
      className={'dsh-mt_chgFile' + (entry.key === selectedKey ? ' dsh-mt_chgRowOn' : '')}
      data-chg-file={entry.file.rel}
      data-chg-side={entry.side}
      onClick={() => { setSelectedKey(entry.key); setPreviewMode('file') }}
      title={entry.file.path}
    >
      <span className={'dsh-mt_chgStatus dsh-mt_chgStatus' + (entry.file.untracked ? 'New' : 'Mod')}>{statusLabel(entry.file.status)}</span>
      <span className="dsh-mt_chgFileName">{entry.file.rel}</span>
      <span className="dsh-mt_chgAdd">+{entry.data.additions}</span>
      <span className="dsh-mt_chgDel">−{entry.data.deletions}</span>
      <span className="dsh-mt_chgFileActions">
        {entry.side === 'unstaged' && (
          <button type="button" className="dsh-mt_chgMiniBtn" data-chg-row-action="stage" title={T('changes.stage')} onClick={(ev) => { ev.stopPropagation(); void runGitAction('/api/worktable/git-stage', { path: entry.file.rel }, T('changes.staged')) }}>＋</button>
        )}
        {entry.side === 'staged' && (
          <button type="button" className="dsh-mt_chgMiniBtn" data-chg-row-action="unstage" title={T('changes.unstage')} onClick={(ev) => { ev.stopPropagation(); void runGitAction('/api/worktable/git-unstage', { path: entry.file.rel }, T('changes.unstaged')) }}>－</button>
        )}
        <button type="button" className="dsh-mt_chgMiniBtn" data-chg-row-action="discard" title={T('changes.discard')} onClick={(ev) => { ev.stopPropagation(); setConfirmDiscard(entry.key) }}>⟲</button>
      </span>
    </div>
  )

  /** 提交行（两个视图共用）：上行 hash + 标题，下行引用装饰 + 作者 · 相对时间——对齐参考实现的两行式 */
  const renderCommitRow = (c: Commit): JSX.Element => (
    <div
      key={c.hash}
      className={'dsh-mt_chgCommitRow' + (c.hash === selectedCommit ? ' dsh-mt_chgRowOn' : '')}
      data-chg-commit-row={c.hash}
      onClick={() => { setSelectedCommit(c.hash); setPreviewMode('commit') }}
      title={`${c.author} · ${c.subject}`}
    >
      <span className="dsh-mt_chgCommitLine1">
        <span className="dsh-mt_chgHash">{c.short}</span>
        <span className="dsh-mt_chgCommitSubject">{c.subject}</span>
      </span>
      <span className="dsh-mt_chgCommitLine2">
        {(c.refs ?? []).map((r) => <span key={r} className="dsh-mt_chgRef">{r}</span>)}
        <span className="dsh-mt_chgCommitMeta">{c.author} · {relTime(c.time)}</span>
      </span>
    </div>
  )

  return (
    <div className={'dsh-mt_chg dsh-mt_hl ' + (dark ? 'dsh-mt_hlDark' : 'dsh-mt_hlLight')}>
      <div className="dsh-mt_chgBar">
        <div className="dsh-mt_chgLens">
          <button
            type="button"
            className={'dsh-mt_chgLensBtn' + (lens === 'session' ? ' dsh-mt_chgLensOn' : '')}
            data-chg-lens="session"
            onClick={() => setLens('session')}
          >{T('changes.lensSession', { n: String((ops ?? []).length) })}</button>
          <button
            type="button"
            className={'dsh-mt_chgLensBtn' + (lens === 'git' ? ' dsh-mt_chgLensOn' : '')}
            data-chg-lens="git"
            onClick={() => setLens('git')}
          >{T('changes.lensGit', { n: String((git?.files ?? []).length) })}</button>
        </div>
        {lens === 'session' && (
          <span className={'dsh-mt_chgLive' + (opsLive ? ' dsh-mt_chgLiveOn' : '')} data-chg-live={opsLive ? 'on' : 'off'}>
            <span className="dsh-mt_chgDot" aria-hidden />{opsLive ? T('changes.liveOn') : T('changes.liveOff')}
          </span>
        )}
        {lens === 'session' && sessionStats !== null && sessionStats.turns > 0 && (
          <span className="dsh-mt_chgSessionStats" data-chg-session-stats="1">
            {T('changes.sessionStats', {
              turns: String(sessionStats.turns),
              input: formatTokens(sessionStats.input),
              output: formatTokens(sessionStats.output),
              cache: formatTokens(sessionStats.cacheRead),
              total: formatTokens(sessionStats.total),
            })}
          </span>
        )}
        {lens === 'git' && (
          <div className="dsh-mt_chgLens dsh-mt_chgView">
            <button type="button" className={'dsh-mt_chgLensBtn' + (gitView === 'changes' ? ' dsh-mt_chgLensOn' : '')} data-chg-view="changes" onClick={() => { setGitView('changes'); setPreviewMode('file') }}>{T('changes.viewChanges')}</button>
            <button type="button" className={'dsh-mt_chgLensBtn' + (gitView === 'history' ? ' dsh-mt_chgLensOn' : '')} data-chg-view="history" onClick={() => { setGitView('history'); setPreviewMode('commit') }}>{T('changes.viewHistory')}</button>
          </div>
        )}
        {lens === 'git' && (
          <div className="dsh-mt_chgRepoWrap">
            {/* 仓库与分支都用**原生 select**（对齐 DSH-better-sidebar 的 gitBranchSelect）：
                自绘下拉要自己处理层级/命中，嵌在分栏与保活池里容易被别的层吃掉点击；
                原生 select 的弹出层由系统画，键鼠、无障碍、点哪儿都稳。 */}
            {repos.length > 1 && (
              <select
                className="dsh-mt_chgSel"
                data-chg-repo-select="1"
                title={repo}
                value={repo}
                disabled={busy}
                onChange={(e) => { explicitRepo.current = true; setRepo(e.target.value); blobCache.current.clear() }}
              >
                {repos.map((r) => (
                  <option key={r.path} value={r.path} data-chg-repo={r.path}>
                    {repoOptionLabel(r)}
                  </option>
                ))}
                {repos.every((r) => r.path !== repo) && repo !== '' && (
                  <option value={repo} data-chg-repo={repo}>{basenameOf(repo)}</option>
                )}
              </select>
            )}
            {/* 只有一个仓库（或没发现仓库）时不给下拉，直接显示当前仓库名；
                手动填的路径会作为一条 option 挂在上面那个下拉里，这里不再重复显示一遍 */}
            {repos.length <= 1 && (
              <span className="dsh-mt_chgRepoName dsh-mt_chgRepoLone" data-chg-repo-cur="1" title={repo}>{curRepoLabel}</span>
            )}
            <button
              type="button"
              className="dsh-mt_chgRepoPick"
              data-chg-repo-btn="1"
              title={T('changes.repoPathPh')}
              onClick={() => setRepoMenu((v) => !v)}
            >⚙</button>
            {repoMenu && (
              <div className="dsh-mt_chgRepoManual">
                <input
                  className="dsh-mt_exSearch"
                  data-chg-repo-input="1"
                  autoFocus
                  value={repoInput}
                  placeholder={T('changes.repoPathPh')}
                  spellCheck={false}
                  onChange={(e) => setRepoInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { setRepoMenu(false); return }
                    if (e.key !== 'Enter') return
                    const typed = repoInput.trim()
                    if (typed === '') return
                    setRepoMenu(false)
                    explicitRepo.current = true
                    setRepo(typed)
                    blobCache.current.clear()
                  }}
                />
              </div>
            )}
          </div>
        )}
        {lens === 'git' && isRepo && branchOptions.length > 0 && (
          <select
            className="dsh-mt_chgSel dsh-mt_chgSelBranch"
            data-chg-branch-select="1"
            title={T('changes.branchPick')}
            value={branch}
            disabled={busy}
            onChange={(e) => { void doCheckout(e.target.value) }}
          >
            {branchOptions.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        )}
        {lens === 'git' && git?.isRepo === true && gitView === 'changes' && (
          <span className="dsh-mt_chgSummary" data-chg-summary="1">
            <span className="dsh-mt_chgAdd">+{totals.additions}</span>
            <span className="dsh-mt_chgDel">−{totals.deletions}</span>
          </span>
        )}
        {note !== '' && <span className="dsh-mt_chgNote" data-chg-note="1">{note}</span>}
        <button type="button" className="dsh-mt_iconBtn dsh-mt_chgRefresh" data-chg-refresh="1" title={T('exp.refresh')} onClick={() => { blobCache.current.clear(); setTick((t) => t + 1) }}>⟳</button>
      </div>

      {lens === 'session' && (
        <div className="dsh-mt_chgFilters">
          {(['all', 'read', 'write', 'edit', 'io'] as const).map((k) => (
            <button
              key={k}
              type="button"
              className={'dsh-mt_chgChip' + (filter === k ? ' dsh-mt_chgChipOn' : '')}
              data-chg-filter={k}
              onClick={() => setFilter(k)}
            >
              {k === 'all'
                ? T('changes.filterAll', { n: String((ops ?? []).length) })
                : k === 'io'
                  ? T('changes.filterIo', { n: String(qaGroups.length) })
                  : `${kindLabel(k)} ${counts[k]}`}
            </button>
          ))}
        </div>
      )}

      {lens === 'git' && gitView === 'changes' && (
        <div className="dsh-mt_chgCommit" data-chg-commit-box="1">
          <textarea
            className="dsh-mt_chgCommitInput"
            data-chg-commit-message="1"
            value={message}
            placeholder={T('changes.commitPh')}
            spellCheck={false}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { void doCommit() } }}
          />
          <button
            type="button"
            className="dsh-mt_chgCommitBtn"
            data-chg-commit="1"
            disabled={committing || message.trim() === '' || stagedCount === 0}
            onClick={() => { void doCommit() }}
          >{committing ? '…' : T('changes.commit')}</button>
          {stagedCount === 0 && <span className="dsh-mt_chgCommitHint" data-chg-commit-hint="1">{T('changes.commitNothing')}</span>}
          {actionError !== '' && <span className="dsh-mt_chgActionErr" data-chg-action-error="1">{actionError}</span>}
        </div>
      )}

      <div className="dsh-mt_chgBody">
        <div className="dsh-mt_chgList" data-chg-list={lens === 'session' ? 'session' : gitView} style={{ width: `${listPercent}%`, maxWidth: 'none' }}>
          {lens === 'session' && ops !== null && ops.length === 0 && (
            <div className="dsh-mt_exEmpty" data-chg-empty="session">
              {opsLive ? T('changes.noOps') : T('changes.notLive')}
            </div>
          )}
          {lens === 'session' && opError !== '' && <div className="dsh-mt_exEmpty">{opError}</div>}
          {/* 两层结构：一层 = 一条用户提问 + 它的最终答复（层内可以有好几轮），
              每层最上面就是「用户输入 → 最终输出 → 统计（含 token 用量）」，
              层里再按轮展开看这一轮改了什么文件。最新的一层与最新的一轮都在最上面。 */}
          {lens === 'session' && qaGroups.map((layer, li) => {
            const selectedTurn = selectedOp === null ? -1 : (ops ?? []).find((o) => o.callId === selectedOp)?.turn ?? -1
            const withSelected = layer.turns.some((t) => t.turn === selectedTurn)
            // 显式点过的一律听用户的（`withSelected` 只是「默认展开」的理由，不能压过手动收起，
            // 否则最新一层永远收不起来——因为最新那条操作默认是选中项）。
            // 「输入输出」筛选本来就是拿来读问答的，所以那一档默认全部展开。
            const layerOpen = qaOverrides.get(layer.qa) ?? (filter === 'io' || withSelected || li === 0)
            const head = layer.input.replace(/\s+/g, ' ').trim()
            const outHead = layer.output.replace(/\s+/g, ' ').trim()
            const changedFiles = [...new Set(layer.turns
              .flatMap((turn) => turn.list)
              .filter((op) => op.kind === 'write' || op.kind === 'edit')
              .map((op) => op.path))]
            return (
              <div key={layer.qa} className="dsh-mt_chgQa" data-chg-qa={String(layer.qa)} data-chg-qa-open={layerOpen ? '1' : '0'}>
                <button
                  type="button"
                  className="dsh-mt_chgQaHead"
                  data-chg-qa-head={String(layer.qa)}
                  data-chg-qa-open={layerOpen ? '1' : '0'}
                  aria-expanded={layerOpen ? 'true' : 'false'}
                  title={layer.input || undefined}
                  onClick={() => setQaOverrides((prev) => new Map(prev).set(layer.qa, !layerOpen))}
                >
                  <span aria-hidden className={'dsh-mt_chgChev' + (layerOpen ? ' dsh-mt_chgChevOn' : '')}>›</span>
                  <span className="dsh-mt_chgQaName">{T('changes.qaLabel', { n: String(layer.qa) })}</span>
                  <span className="dsh-mt_chgQaAsk" data-chg-qa-ask={String(layer.qa)}>{head !== '' ? head : T('changes.qaNoAsk')}</span>
                  <span className="dsh-mt_chgTurnTime">{relTime(layer.time)}</span>
                  {(layer.usage.input > 0 || layer.usage.output > 0) && (
                    <span className="dsh-mt_chgTurnTokens" data-chg-qa-tokens={String(layer.qa)}>
                      ↑{formatTokens(layer.usage.input)} ↓{formatTokens(layer.usage.output)}
                    </span>
                  )}
                </button>
                {layerOpen && (
                  <div className="dsh-mt_chgQaBody" data-chg-qa-body={String(layer.qa)}>
                    {/* 每层最上面：用户输入 → 最终输出 → 统计。两块文本**可点**，
                        点了在右侧预览区按行看（和点「读/改」那些行一个待遇） */}
                    <button
                      type="button"
                      className={'dsh-mt_chgTurnMsg dsh-mt_chgTurnMsgBtn' + (selectedMsg !== null && selectedMsg.qa === layer.qa && selectedMsg.kind === 'input' ? ' dsh-mt_chgTurnMsgOn' : '')}
                      data-chg-qa-input={String(layer.qa)}
                      onClick={() => { setSelectedMsg({ qa: layer.qa, kind: 'input' }); setPreviewMode('msg') }}
                    >
                      <span className="dsh-mt_chgTurnMsgTag">{T('changes.turnInput')}</span>
                      <span className="dsh-mt_chgTurnMsgText">{layer.input !== '' ? layer.input : T('changes.qaNoAsk')}</span>
                    </button>
                    <button
                      type="button"
                      className={'dsh-mt_chgTurnMsg dsh-mt_chgTurnMsgOut dsh-mt_chgTurnMsgBtn' + (selectedMsg !== null && selectedMsg.qa === layer.qa && selectedMsg.kind === 'output' ? ' dsh-mt_chgTurnMsgOn' : '')}
                      data-chg-qa-output={String(layer.qa)}
                      onClick={() => { setSelectedMsg({ qa: layer.qa, kind: 'output' }); setPreviewMode('msg') }}
                    >
                      <span className="dsh-mt_chgTurnMsgTag">{T('changes.turnOutput')}</span>
                      <span className="dsh-mt_chgTurnMsgText">{layer.output !== '' ? layer.output : T('changes.qaNoAnswer')}</span>
                    </button>
                    <div className="dsh-mt_chgQaFiles" data-chg-qa-files={String(layer.qa)}>
                      <span className="dsh-mt_chgQaFilesLabel">{T('changes.changedFiles')}</span>
                      {changedFiles.length === 0
                        ? <span className="dsh-mt_chgQaFilesEmpty">{T('changes.noChangedFiles')}</span>
                        : changedFiles.map((path) => (
                          <button
                            key={path}
                            type="button"
                            className="dsh-mt_chgQaFile"
                            data-chg-file-open={path}
                            title={path}
                            onClick={() => openFile(path)}
                          >
                            <span className="dsh-mt_chgQaFileName">{basenameOf(path)}</span>
                            <span className="dsh-mt_chgQaFilePath">{relativeTo(cwd, path)}</span>
                          </button>
                        ))}
                    </div>
                    <div className="dsh-mt_chgTurnStats" data-chg-qa-stats={String(layer.qa)}>
                      <span>{T('changes.usageIn')} <b>{formatTokens(layer.usage.input)}</b></span>
                      <span>{T('changes.usageOut')} <b>{formatTokens(layer.usage.output)}</b></span>
                      {layer.usage.cacheRead > 0 && <span>{T('changes.usageCache')} <b>{formatTokens(layer.usage.cacheRead)}</b></span>}
                      {layer.usage.reasoning > 0 && <span>{T('changes.usageReason')} <b>{formatTokens(layer.usage.reasoning)}</b></span>}
                      <span>{T('changes.usageTotal')} <b>{formatTokens(layer.usage.total)}</b></span>
                      {layer.usage.calls > 0 && <span>{T('changes.usageCalls', { n: String(layer.usage.calls) })}</span>}
                      {layer.tools > 0 && <span>{T('changes.turnTools', { n: String(layer.tools) })}</span>}
                    </div>
                    {/* 层里包含的每一轮：默认只有一轮时展开，多轮时逐轮展开。
                        「输入输出」筛选下只看问答，不再铺文件行 */}
                    {filter !== 'io' && layer.turns.map((g) => {
                      // 同上：手动折叠优先；默认「只有一轮就展开、多轮则逐轮展开」，选中项所在轮默认展开
                      const selectedHere = g.turn === selectedTurn
                      const roundOpen = turnOverrides.get(g.turn) ?? (selectedHere || layer.turns.length === 1)
                      const inner = groupByFile(g.list)
                      const used = turnStats.get(g.turn)?.usage
                      return (
                        <div key={g.turn} className="dsh-mt_chgTurn">
                          <button
                            type="button"
                            className="dsh-mt_chgTurnHead"
                            data-chg-turn={String(g.turn)}
                            data-chg-turn-open={roundOpen ? '1' : '0'}
                            aria-expanded={roundOpen ? 'true' : 'false'}
                            onClick={() => setTurnOverrides((prev) => new Map(prev).set(g.turn, !roundOpen))}
                          >
                            <span aria-hidden className={'dsh-mt_chgChev' + (roundOpen ? ' dsh-mt_chgChevOn' : '')}>›</span>
                            <span className="dsh-mt_chgTurnName">{T('changes.turn', { n: String(g.turn) })}</span>
                            <span className="dsh-mt_chgTurnTime">{relTime(g.time)}</span>
                            {used !== undefined && (used.input > 0 || used.output > 0) && (
                              <span className="dsh-mt_chgTurnTokens">↑{formatTokens(used.input)} ↓{formatTokens(used.output)}</span>
                            )}
                            <span className="dsh-mt_chgTurnMeta">{T('changes.turnMeta', { files: String(g.files), ops: String(g.ops) })}</span>
                          </button>
                          {roundOpen && (
                            <div className="dsh-mt_chgTurnBody" data-chg-turn-body={String(g.turn)}>
                              {g.ops === 0 && <div className="dsh-mt_chgTurnNoFiles">{T('changes.turnNoFiles')}</div>}
                              {[...inner.entries()].map(([path, list]) => (
                                <div key={path} className="dsh-mt_chgGroup">
                                  <div className="dsh-mt_chgGroupHead" title={path}>
                                    <span className="dsh-mt_chgGroupName">{basenameOf(path)}</span>
                                    <span className="dsh-mt_chgGroupPath">{relativeTo(cwd, path)}</span>
                                    <span className="dsh-mt_chgGroupCount">{list.length}</span>
                                  </div>
                                  {list.map((op) => (
                                    <div
                                      key={op.callId}
                                      className={'dsh-mt_chgRow' + (op.callId === selectedOp ? ' dsh-mt_chgRowOn' : '')}
                                      data-chg-op={op.callId}
                                      data-chg-kind={op.kind}
                                      onClick={() => { setSelectedOp(op.callId); setPreviewMode('file'); setSelectedMsg(null) }}
                                      title={op.path}
                                    >
                                      <span className={'dsh-mt_chgKind dsh-mt_chgKind_' + op.kind}>{kindLabel(op.kind)}</span>
                                      <span className="dsh-mt_chgTime">{relTime(op.time)}</span>
                                      {bytesOf(op) > 0 && <span className="dsh-mt_chgBytes">{formatBytes(bytesOf(op))}</span>}
                                      {op.running && <span className="dsh-mt_chgRunning">{T('changes.running')}</span>}
                                      {op.isError && <span className="dsh-mt_chgErr">{T('changes.failed')}</span>}
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {lens === 'git' && gitView === 'changes' && (
            <>
              {gitError !== '' && <div className="dsh-mt_exEmpty">{gitError}</div>}
              {git?.isRepo === false && (
                <div className="dsh-mt_exEmpty" data-chg-empty="git">
                  <div>{T('pane.gitNotRepo')}</div>
                  <div className="dsh-mt_chgRepoHint">{T('changes.searchedIn', { path: searchedRoot || cwd })}</div>
                  <button type="button" className="dsh-mt_chgMore" data-chg-repo-open="1" onClick={() => setRepoMenu(true)}>{T('changes.enterRepo')}</button>
                </div>
              )}
              {git?.isRepo === true && git.files.length === 0 && <div className="dsh-mt_exEmpty" data-chg-empty="clean">{T('pane.gitClean')}</div>}
              <div className="dsh-mt_chgSection" data-chg-section="staged">{T('changes.stagedSection', { n: String(stagedCount) })}</div>
              {entries.filter((e) => e.side === 'staged').map(renderGitEntry)}
              <div className="dsh-mt_chgSection" data-chg-section="unstaged">{T('changes.unstagedSection', { n: String(unstagedCount) })}</div>
              {entries.filter((e) => e.side === 'unstaged').map(renderGitEntry)}
              {git?.truncated === true && <div className="dsh-mt_chgTrunc">{T('changes.truncated')}</div>}
            </>
          )}

          {lens === 'git' && gitView === 'history' && (
            <>
              {commits.length === 0 && <div className="dsh-mt_exEmpty" data-chg-empty="history">{T('changes.noCommits')}</div>}
              {commits.map(renderCommitRow)}
              {commitHasMore && (
                <button
                  type="button"
                  className="dsh-mt_chgMore"
                  data-chg-more="1"
                  onClick={() => {
                    void postJson('/api/worktable/git-log', { ...gitBody, limit: 30, skip: commits.length })
                      .then((d) => {
                        const page: Commit[] = Array.isArray(d?.commits) ? d.commits : []
                        setCommits((prev) => [...prev, ...page])
                        setCommitHasMore(page.length === 30)
                      })
                      .catch((e) => setActionError(String(e)))
                  }}
                >{T('changes.loadMore')}</button>
              )}
            </>
          )}

        </div>

        <div
          className="dsh-mt_chgDivider"
          data-chg-divider="1"
          role="separator"
          aria-orientation="vertical"
          onPointerDown={(e: any) => {
            const body = e.currentTarget.parentElement as HTMLElement | null
            if (!body) return
            const rect = body.getBoundingClientRect()
            listResizeRef.current = { left: rect.left, width: rect.width }
            try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
            e.preventDefault()
          }}
          onPointerMove={(e: any) => {
            const drag = listResizeRef.current
            if (!drag || drag.width <= 0) return
            const next = ((e.clientX - drag.left) / drag.width) * 100
            setListPercent(Math.min(75, Math.max(18, next)))
          }}
          onPointerUp={(e: any) => {
            listResizeRef.current = null
            try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
          }}
          onPointerCancel={() => { listResizeRef.current = null }}
        />

        <div className="dsh-mt_chgPreview" data-chg-preview={lens === 'session' ? (previewMode === 'msg' ? 'msg' : 'session') : (previewMode === 'commit' ? 'commit' : gitView)}>
          {/* 点层里的「用户输入 / 最终输出」→ 右侧按行看这段对话原文 */}
          {lens === 'session' && previewMode === 'msg' && selectedMsg !== null && (() => {
            const layer = qaGroups.find((g) => g.qa === selectedMsg.qa) ?? null
            const isInput = selectedMsg.kind === 'input'
            const text = isInput ? (layer?.input ?? '') : (layer?.output ?? '')
            const lines = text === '' ? [] : text.split('\n')
            return (
              <>
                <div className="dsh-mt_chgPreviewBar">
                  <span className={'dsh-mt_chgKind dsh-mt_chgKind_' + (isInput ? 'read' : 'write')}>{isInput ? T('changes.turnInput') : T('changes.turnOutput')}</span>
                  <span className="dsh-mt_chgPreviewPath" data-chg-msg-preview={selectedMsg.kind}>{T('changes.qaLabel', { n: String(selectedMsg.qa) })}</span>
                  {layer !== null && <span className="dsh-mt_chgTime">{relTime(layer.time)}</span>}
                  {layer !== null && (layer.usage.input > 0 || layer.usage.output > 0) && (
                    <span className="dsh-mt_chgTurnTokens">↑{formatTokens(layer.usage.input)} ↓{formatTokens(layer.usage.output)}</span>
                  )}
                  <button type="button" className="dsh-mt_viewBtn" data-chg-action="copy" title={T('exp.copy')} onClick={() => { void copyText(text).then((ok) => flash(ok ? T('exp.copied') : T('exp.copyFail'))) }}>⧉</button>
                </div>
                <div className="dsh-mt_diffRows" data-chg-msg-body={selectedMsg.kind}>
                  {lines.length === 0 && <div className="dsh-mt_exEmpty">{T('changes.msgEmpty')}</div>}
                  {lines.slice(0, expandedAll ? lines.length : MAX_ROWS).map((line, i) => (
                    <div key={i} className="dsh-mt_diffRow" data-kind="ctx">
                      <span className="dsh-mt_diffLineNo">{i + 1}</span>
                      <span className="dsh-mt_diffSign"> </span>
                      <span className="dsh-mt_diffText">{line === '' ? ' ' : line}</span>
                    </div>
                  ))}
                  {lines.length > MAX_ROWS && !expandedAll && (
                    <div className="dsh-mt_diffMore"><button type="button" className="dsh-mt_chgMiniBtn" onClick={() => setExpandedAll(true)}>{T('changes.expandAll')}</button></div>
                  )}
                </div>
              </>
            )
          })()}
          {lens === 'session' && previewMode !== 'msg' && currentOp !== null && (
            <>
              <div className="dsh-mt_chgPreviewBar">
                <span className={'dsh-mt_chgKind dsh-mt_chgKind_' + currentOp.kind}>{kindLabel(currentOp.kind)}</span>
                <span className="dsh-mt_chgPreviewPath" title={currentOp.path}>{relativeTo(cwd, currentOp.path)}</span>
                {bytesOf(currentOp) > 0 && <span className="dsh-mt_chgBytes">{formatBytes(bytesOf(currentOp))}</span>}
                {currentOp.note !== undefined && <span className="dsh-mt_chgPreviewNote">{currentOp.note}</span>}
                <button type="button" className="dsh-mt_viewBtn" data-chg-action="open" title={T('exp.open')} onClick={() => openFile(currentOp.path)}>↗</button>
                <button type="button" className="dsh-mt_viewBtn" data-chg-action="reference" title={T('exp.reference')} onClick={() => reference(currentOp.path)}>@</button>
                <button type="button" className="dsh-mt_viewBtn" data-chg-action="copy" title={T('exp.copyAbs')} onClick={() => { void copyText(currentOp.path).then((ok) => flash(ok ? T('exp.copied') : T('exp.copyFail'))) }}>⧉</button>
              </div>
              {preview?.kind === 'diff' && <DiffRows rows={preview.rows} path={currentOp.path} pairs={pairsFromRows(preview.rows)} expandedAll={expandedAll} onExpandAll={() => setExpandedAll(true)} />}
              {preview?.kind === 'content' && (
                <div className="dsh-mt_diffRows" data-diff-read="1">
                  {preview.lines.slice(0, expandedAll ? preview.lines.length : MAX_ROWS).map((l) => (
                    <div key={l.line} className="dsh-mt_diffRow" data-kind="ctx">
                      <span className="dsh-mt_diffLineNo">{l.line}</span>
                      <span className="dsh-mt_diffSign"> </span>
                      <LineText text={l.text} path={currentOp.path} />
                    </div>
                  ))}
                </div>
              )}
              {preview?.kind === 'error' && <pre className="dsh-mt_chgErrText" data-chg-error="1">{preview.text}</pre>}
            </>
          )}
          {lens === 'session' && previewMode !== 'msg' && currentOp === null && <div className="dsh-mt_exEmpty">{T('changes.pickOp')}</div>}

          {lens === 'git' && gitView === 'changes' && previewMode === 'file' && currentEntry !== null && (
            <>
              <div className="dsh-mt_chgPreviewBar">
                <span className={'dsh-mt_chgStatus dsh-mt_chgStatus' + (currentEntry.file.untracked ? 'New' : 'Mod')}>{statusLabel(currentEntry.file.status)}</span>
                <span className="dsh-mt_chgPreviewPath" title={currentEntry.file.path}>{currentEntry.file.rel}</span>
                <span className="dsh-mt_chgTag" data-chg-tag={currentEntry.side}>{currentEntry.side === 'staged' ? T('changes.tagStaged') : T('changes.tagUnstaged')}</span>
                <span className="dsh-mt_chgAdd">+{currentEntry.data.additions}</span>
                <span className="dsh-mt_chgDel">−{currentEntry.data.deletions}</span>
                <button type="button" className="dsh-mt_viewBtn" data-chg-action="open" title={T('exp.open')} onClick={() => openFile(currentEntry.file.path)}>↗</button>
                <button type="button" className="dsh-mt_viewBtn" data-chg-action="reference" title={T('exp.reference')} onClick={() => reference(currentEntry.file.path)}>@</button>
                {currentEntry.side === 'unstaged' && (
                  <button type="button" className="dsh-mt_viewBtn" data-chg-action="stage" title={T('changes.stage')} onClick={() => { void runGitAction('/api/worktable/git-stage', { path: currentEntry.file.rel }, T('changes.staged')) }}>＋</button>
                )}
                {currentEntry.side === 'staged' && (
                  <button type="button" className="dsh-mt_viewBtn" data-chg-action="unstage" title={T('changes.unstage')} onClick={() => { void runGitAction('/api/worktable/git-unstage', { path: currentEntry.file.rel }, T('changes.unstaged')) }}>－</button>
                )}
                <button type="button" className="dsh-mt_viewBtn" data-chg-action="discard" title={T('changes.discard')} onClick={() => setConfirmDiscard(currentEntry.key)}>⟲</button>
              </div>
              {confirmDiscard === currentEntry.key && (
                <div className="dsh-mt_chgConfirm" data-chg-confirm="1">
                  <span>{currentEntry.file.untracked ? T('changes.discardUntracked') : T('changes.discardConfirm')}</span>
                  <button
                    type="button"
                    className="dsh-mt_noPrevBtn"
                    data-chg-confirm-yes="1"
                    onClick={() => {
                      const entry = currentEntry
                      setConfirmDiscard(null)
                      void runGitAction('/api/worktable/git-discard', { path: entry.file.rel, untracked: entry.file.untracked }, T('changes.discarded'))
                    }}
                  >{T('changes.confirmYes')}</button>
                  <button type="button" className="dsh-mt_noPrevBtn" data-chg-confirm-no="1" onClick={() => setConfirmDiscard(null)}>{T('changes.confirmNo')}</button>
                </div>
              )}
              {parsed?.binary === true
                ? <div className="dsh-mt_exEmpty">{T('changes.binaryDiff')}</div>
                : (
                  <DiffRows
                    rows={rows}
                    path={currentEntry.file.path}
                    pairs={pairMap}
                    layout={layout}
                    hunks={parsed?.hunks}
                    expandedGaps={expandedGaps}
                    gapLoading={gapLoading}
                    onToggleGap={(index, gap) => { void toggleGap(currentEntry, index, gap) }}
                    expandedAll={expandedAll}
                    onExpandAll={() => setExpandedAll(true)}
                  />
                )}
            </>
          )}
          {lens === 'git' && gitView === 'changes' && previewMode === 'file' && currentEntry === null && <div className="dsh-mt_exEmpty">{T('changes.pickFile')}</div>}

          {lens === 'git' && previewMode === 'commit' && (commitFiles === null
            ? <div className="dsh-mt_exEmpty">{selectedCommit === null ? T('changes.pickCommit') : T('file.loading')}</div>
            : (
              <div className="dsh-mt_diffRows" data-chg-commit-diff="1">
                {commitFiles.length === 0 && <div className="dsh-mt_exEmpty">{T('changes.commitEmpty')}</div>}
                {commitFiles.length > 1 && (
                  <div className="dsh-mt_commitFilesBar">
                    <span className="dsh-mt_commitFilesCount">{T('changes.commitFileCount', { n: String(commitFiles.length) })}</span>
                    <button
                      type="button"
                      className="dsh-mt_commitFilesBtn"
                      data-chg-commit-expand-all="1"
                      onClick={() => setOpenCommitFiles(new Set(commitFiles.filter((f) => !f.binary && f.hunks.length > 0).map((f) => f.rel)))}
                    >{T('changes.expandAllFiles')}</button>
                    <button
                      type="button"
                      className="dsh-mt_commitFilesBtn"
                      data-chg-commit-collapse-all="1"
                      onClick={() => setOpenCommitFiles(new Set())}
                    >{T('changes.collapseAllFiles')}</button>
                  </div>
                )}
                {commitFiles.map((f) => {
                  const fileRows = f.hunks.flatMap((h) => h.rows)
                  const expandable = !f.binary && f.hunks.length > 0
                  const open = expandable && openCommitFiles.has(f.rel)
                  return (
                    <div key={f.rel} className="dsh-mt_chgFileBlock">
                      {/* 文件头就是折叠开关（对齐参考实现：chevron + 路径 + ±行数，aria-expanded 供无障碍/探针读） */}
                      <button
                        type="button"
                        className={'dsh-mt_chgFileHead' + (open ? ' dsh-mt_chgFileHeadOn' : '')}
                        data-chg-commit-file={f.rel}
                        data-chg-commit-toggle="1"
                        aria-expanded={expandable ? open : undefined}
                        disabled={!expandable}
                        title={f.rel}
                        onClick={() => {
                          setOpenCommitFiles((prev) => {
                            const next = new Set(prev)
                            if (next.has(f.rel)) next.delete(f.rel)
                            else next.add(f.rel)
                            return next
                          })
                        }}
                      >
                        {expandable && <span aria-hidden className={'dsh-mt_chgChev' + (open ? ' dsh-mt_chgChevOn' : '')}>›</span>}
                        <span className="dsh-mt_chgFileHeadPath">{f.rel}</span>
                        {f.oldPath !== undefined && f.oldPath !== f.rel && <span className="dsh-mt_chgFileOld">← {f.oldPath}</span>}
                        {f.binary && <span className="dsh-mt_chgFileTag">{T('changes.binaryDiff')}</span>}
                        <span className="dsh-mt_chgAdd">+{f.additions}</span>
                        <span className="dsh-mt_chgDel">−{f.deletions}</span>
                      </button>
                      {open && (
                        <DiffRows
                          rows={fileRows}
                          path={f.rel}
                          pairs={pairsFromRows(fileRows)}
                          hunks={f.hunks}
                          layout={diffLayout(f)}
                          expandedAll={expandedAll}
                          onExpandAll={() => setExpandedAll(true)}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
