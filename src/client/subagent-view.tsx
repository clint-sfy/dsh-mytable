/**
 * 任务管理窗的主体：**照搬 DSH-better-sidebar 的 SubagentView**（同一套 markup 与 CSS 类名，
 * CSS 见 subagent-view.css），只把数据来源换成 mytable 这边已有的东西：
 *   - 拓扑：宿主会话推送镜像的 `byId`（`origin: 'subagent'` + `parentId` 血链），不再需要
 *     参考实现那套按父节点懒加载的 catalog RPC；
 *   - 实时行：新增的宿主路由 `/api/worktable/subagent-live`（按根会话批量折叠 running 子会话的
 *     最后一段文本 / 工具调用）；
 *   - 任务输出与终止：走 `/api/worktable/job-output`（重放模型已读内容，不碰读游标）与 `job-kill`；
 *   - 点节点：跳到那个会话（`window.__dshOpenSession`）。
 *
 * 视觉部分（行高 50、7/8/11 内边距、圆角 8、树连接线、状态点、底部输出坞、两击确认的终止键）
 * 与参考实现一致，所以两边看起来是同一个东西。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  T, splitScope, splitSessionList,
} from './split'
import {
  collectTreeJobs, formatJobDuration, isJobLive, jobDotState, jobStatusLabel, orderJobs,
  type JobView, type SessionIndex, type TreeJob,
} from './subagent-jobs'

/** 实时行的刷新节奏（与参考实现一致） */
const POLL_MS = 3000
/** 工具参数预览上限 */
const ARGS_PREVIEW = 60
/** 展开的任务输出坞刷新节奏 */
const JOB_POLL_MS = 2000
/** 终止键保持「已武装」的时长（之后需要重新确认） */
const JOB_KILL_ARM_MS = 3000

/** 侧边对话（Side Chat）借 subagent origin 但属于 tab，不是拓扑——一律排除 */
const SIDE_LABEL_PREFIX = 'Side: '

type LiveActivity = { text?: string; tool?: { name: string; args: string } }
type ById = SessionIndex

/** 一个父会话的直接子代理（按血链 origin/parentId；排除 Side Chat） */
function directChildren(byId: ById, parentSessionId: string): any[] {
  return (Object.values(byId) as any[]).filter((s) =>
    s?.origin === 'subagent' && s.parentId === parentSessionId
    && !String(s.displayTitle ?? '').startsWith(SIDE_LABEL_PREFIX))
}

/** 血链向上走到第一个非 subagent 的会话（= 这棵树的主 Agent） */
function rootAncestor(byId: ById, sessionId: string | undefined): string | undefined {
  if (sessionId === undefined) return undefined
  const start = byId[sessionId]
  if (start === undefined) return sessionId
  let current: any = start
  const seen = new Set<string>()
  let lastParent: string | undefined
  while (current?.origin === 'subagent' && current.parentId !== undefined && !seen.has(current.id)) {
    seen.add(current.id)
    lastParent = current.parentId
    current = byId[current.parentId]
  }
  if (lastParent === undefined) return start.id
  return byId[lastParent]?.id ?? sessionId
}

function preview(text: string, limit: number): string {
  return text.length > limit ? text.slice(0, limit) + '…' : text
}

/**
 * 状态点：**优先用宿主官方的 `StateDot`**（参考实现就是这么画的，红/绿/黄/灰语义与宿主一致），
 * 拿不到时回落到自带颜色的 `<span>`（CSS 里的 `.dsh-mt_saDot-*`）。
 * 之前这里只写了 class 没写颜色，点全是普通文字色——用户一眼就看出「没有红绿黄」。
 */
let primitivesMod: any = null
try { primitivesMod = require('@deepseek-ai/dsh-client-ui-primitives') } catch { primitivesMod = null }

type DotState = 'ongoing' | 'warning' | 'done' | 'error'

function SaDot(props: { state: DotState }) {
  const StateDot = primitivesMod?.StateDot
  if (typeof StateDot === 'function') return <StateDot state={props.state} className="dsh-mt_saDotHost" />
  return <span className={'dsh-mt_saDot dsh-mt_saDot-' + props.state} aria-hidden>●</span>
}

function flatten(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

async function postJson(url: string, body: unknown): Promise<any> {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error('HTTP ' + String(r.status))
  return r.json()
}

/** 运行中子会话的实时行（批量一次请求；由外层统一轮询） */
function SubagentLiveLines(props: { live: LiveActivity | undefined }) {
  const { live } = props
  if (live?.text === undefined && live?.tool === undefined) {
    return <span className="subagentLive">{T('jobs.thinking')}</span>
  }
  return (
    <>
      {live?.tool !== undefined && (
        <span className="subagentLive">
          <span className="subagentLiveTool">{live.tool.name}</span>
          {live.tool.args !== '' && <span className="subagentLiveArgs">{preview(live.tool.args, ARGS_PREVIEW)}</span>}
        </span>
      )}
      {live?.text !== undefined && <span className="subagentLiveText">{flatten(live.text)}</span>}
    </>
  )
}

/** 底部输出坞：只显示**模型已经读过**的那部分输出（重放，不消费读游标） */
function JobOutputPane(props: { ownerSessionId: string; job: JobView; active: boolean; onClose: () => void }) {
  const { ownerSessionId, job, active, onClose } = props
  const [state, setState] = useState<{ text: string; truncated?: boolean; read?: boolean } | 'loading' | 'error'>('loading')
  const preRef = useRef<HTMLPreElement>(null)

  const load = useCallback(async (): Promise<void> => {
    try {
      const d = await postJson('/api/worktable/job-output', { sessionId: ownerSessionId, jobId: job.id })
      if (d?.error !== undefined) { setState((cur) => (cur === 'loading' ? 'error' : cur)); return }
      setState({ text: String(d?.text ?? ''), truncated: d?.truncated === true, read: d?.read === true })
    } catch {
      setState((cur) => (cur === 'loading' ? 'error' : cur))
    }
  }, [job.id, ownerSessionId])

  useEffect(() => {
    void load()
    if (!active || !isJobLive(job)) return
    const timer = window.setInterval(() => { void load() }, JOB_POLL_MS)
    return () => { window.clearInterval(timer) }
  }, [active, job.status, load])

  // 终端式跟随：任务活着时每次刷新都贴到底；结束了就把滚动权交回读者
  useEffect(() => {
    if (!isJobLive(job) || typeof state !== 'object' || state.text.length === 0) return
    const pre = preRef.current
    if (pre !== null) pre.scrollTop = pre.scrollHeight
  }, [state, job.status])

  return (
    <div className="jobsPane" role="region" aria-label={`${job.label} ${T('jobs.jobsSection')}`} data-mt-job-dock={job.id}>
      <div className="jobsPaneHeader">
        <SaDot state={jobDotState(job.status)} />
        <span className="jobsPaneLabel" title={job.label}>{job.label}</span>
        <span className="jobsPaneStatus">
          {jobStatusLabel(job.status)}{job.detail !== undefined && job.detail !== '' ? ' · ' + job.detail : ''}
        </span>
        <button type="button" className="jobsPaneClose" aria-label={T('jobs.close')} title={T('jobs.close')} onClick={onClose}>✕</button>
      </div>
      {state === 'loading' && <div className="jobsPaneHint">{T('file.loading')}</div>}
      {state === 'error' && <div className="jobsPaneHint jobsPaneError">{T('jobs.outputError')}</div>}
      {typeof state === 'object' && (
        <>
          {state.text.length > 0
            ? <pre ref={preRef} className="jobsPanePre" data-mt-job-dock-text={job.id}>{state.text}</pre>
            : state.read === true
              ? <div className="jobsPaneHint">{T('jobs.outputNoText')}</div>
              : <div className="jobsPaneHint">{T('jobs.outputUnreadHint')}</div>}
          {state.truncated === true && <div className="jobsPaneHint">{T('jobs.outputTruncated')}</div>}
        </>
      )}
    </div>
  )
}

/** 后台任务段：整棵树的任务（主 Agent + 子代理，带归属），点行把「已读输出」喂给底部输出坞 */
function JobsSection(props: {
  byId: ById
  jobsBySession: Record<string, JobView[]> | undefined
  rootId: string | undefined
  active: boolean
}) {
  const { byId, jobsBySession, rootId, active } = props
  const rows = useMemo(() => orderJobs(collectTreeJobs(byId, jobsBySession, rootId)), [byId, jobsBySession, rootId])
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [armedId, setArmedId] = useState<string | undefined>(undefined)
  const [killingId, setKillingId] = useState<string | undefined>(undefined)
  const [killErrorId, setKillErrorId] = useState<string | undefined>(undefined)
  const [now, setNow] = useState<number>(() => Date.now())

  const selectedRow = useMemo(
    () => (selectedId === undefined ? undefined : rows.find((row) => row.job.id === selectedId)),
    [rows, selectedId],
  )
  const liveCount = useMemo(() => rows.reduce((n, row) => n + (isJobLive(row.job) ? 1 : 0), 0), [rows])
  const multiOwner = useMemo(() => new Set(rows.map((row) => row.ownerSessionId)).size > 1, [rows])

  // 终止键只武装一小会儿，误点不会杀任务
  useEffect(() => {
    if (armedId === undefined) return
    const timer = window.setTimeout(() => setArmedId(undefined), JOB_KILL_ARM_MS)
    return () => window.clearTimeout(timer)
  }, [armedId])

  useEffect(() => {
    if (liveCount === 0) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [liveCount])

  // 选中的任务离开镜像（结束被丢掉 / 切了树）→ 关掉输出坞
  useEffect(() => {
    if (selectedId !== undefined && selectedRow === undefined) setSelectedId(undefined)
  }, [selectedId, selectedRow])

  const kill = useCallback(async (row: TreeJob): Promise<void> => {
    setKillingId(row.job.id)
    setKillErrorId(undefined)
    try {
      const d = await postJson('/api/worktable/job-kill', { sessionId: row.ownerSessionId, jobId: row.job.id })
      if (d?.ok !== true) setKillErrorId(row.job.id)
    } catch {
      setKillErrorId(row.job.id)
    } finally {
      setKillingId(undefined)
      setArmedId(undefined)
    }
  }, [])

  if (rows.length === 0) return null

  const countLabel = liveCount > 0
    ? T('jobs.summaryRunning', { count: String(rows.length), running: String(liveCount) })
    : T('jobs.summary', { count: String(rows.length) })

  return (
    <>
      <section className="jobs" aria-label={T('jobs.jobsSection')} data-mt-jobs-section="1">
        <div className="jobsHeader">
          <span className="jobsTitle">{T('jobs.jobsSection')}</span>
          <span className="jobsCount" data-mt-jobs-summary="1">{countLabel}</span>
        </div>
        <ul className="jobsList" aria-label={T('jobs.jobsSection')}>
          {rows.map((row) => {
            const { job } = row
            const live = isJobLive(job)
            const selected = selectedId === job.id
            const armed = armedId === job.id
            const killing = killingId === job.id
            const killFailed = killErrorId === job.id
            const elapsed = live ? now - job.startedAt : (job.finishedAt ?? job.startedAt) - job.startedAt
            const secondary = [
              ...(multiOwner ? [row.ownerTitle] : []),
              jobStatusLabel(job.status),
              ...(job.detail !== undefined && job.detail !== '' ? [job.detail] : []),
              formatJobDuration(elapsed),
            ].filter(Boolean).join(' · ')
            return (
              <li key={job.id} className={'jobsRow' + (live ? '' : ' jobsRowSettled') + (selected ? ' jobsRowSelected' : '')}>
                <button
                  type="button"
                  className="jobsRowMain"
                  data-mt-job={job.id}
                  data-mt-job-status={job.status}
                  aria-pressed={selected}
                  aria-label={`${job.label} ${secondary}`}
                  onClick={() => setSelectedId(selected ? undefined : job.id)}
                >
                  <SaDot state={jobDotState(job.status)} />
                  <span className="jobsContent">
                    <span className="jobsLabelLine">
                      <span className="jobsKind">{job.kind}</span>
                      <span className="jobsLabel" title={job.label}>{job.label}</span>
                    </span>
                    <span className="jobsSecondary">{secondary}</span>
                  </span>
                </button>
                {job.status === 'running' && (
                  <button
                    type="button"
                    className={'jobsKill' + (armed ? ' jobsKillArmed' : '')}
                    data-mt-job-kill={job.id}
                    aria-label={armed ? T('jobs.killConfirm') : T('jobs.kill')}
                    title={armed ? T('jobs.killConfirm') : T('jobs.kill')}
                    disabled={killing}
                    onClick={(event) => {
                      event.stopPropagation()
                      if (armed) void kill(row)
                      else setArmedId(job.id)
                    }}
                  >{armed ? T('jobs.killConfirm') : '⏹'}</button>
                )}
                {killFailed && <span className="jobsKillError">{T('jobs.killError')}</span>}
              </li>
            )
          })}
        </ul>
      </section>
      {selectedRow !== undefined && (
        <JobOutputPane
          ownerSessionId={selectedRow.ownerSessionId}
          job={selectedRow.job}
          active={active}
          onClose={() => setSelectedId(undefined)}
        />
      )}
    </>
  )
}

/** 一层拓扑：节点卡（状态点 + 名称 + 次要行 + running 时的实时行），分支始终展开 */
function TreeLevel(props: {
  byId: ById
  parentSessionId: string
  level: number
  currentSessionId: string
  live: Record<string, LiveActivity>
  openChild: (id: string) => void
}) {
  const { byId, parentSessionId, level, currentSessionId, live, openChild } = props
  const children = directChildren(byId, parentSessionId)
  if (children.length === 0) return null
  return (
    <div className="subagentChildren" role="group">
      {children.map((summary) => {
        const id = String(summary.id)
        const running = summary.running === true
        const current = id === currentSessionId
        const title = String(summary.displayTitle ?? id)
        // 次要行：模式 + **是否在运行**（标题已经在上一行，别重复一遍）
        const secondary = [
          summary.mode === 'one-shot' ? T('jobs.modeOneShot') : (summary.mode !== undefined ? T('jobs.modeContinuable') : ''),
          running ? T('jobs.subRunning') : T('jobs.subInactive'),
        ].filter(Boolean).join(' · ')
        return (
          <div key={id} className="subagentNode">
            <div
              role="treeitem"
              tabIndex={0}
              aria-level={level}
              aria-current={current ? 'true' : undefined}
              aria-expanded={directChildren(byId, id).length > 0 ? true : undefined}
              className={'subagentRow' + (current ? ' subagentRowActive' : '')}
              data-mt-subagent={id}
              onClick={() => openChild(id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  event.stopPropagation()
                  openChild(id)
                }
              }}
            >
              <SaDot state={running ? 'ongoing' : 'done'} />
              <span className="subagentContent">
                <span className="subagentLabel">{String(summary.displayTitle ?? id)}</span>
                <span className="subagentSecondary">{secondary}</span>
                {running && <SubagentLiveLines live={live[id]} />}
              </span>
            </div>
            <TreeLevel
              byId={byId}
              parentSessionId={id}
              level={level + 1}
              currentSessionId={currentSessionId}
              live={live}
              openChild={openChild}
            />
          </div>
        )
      })}
    </div>
  )
}

/** 任务管理页：主 Agent 的完整拓扑 + 整棵树的后台任务 */
export function SubagentView(props: { active: boolean }) {
  const { active } = props
  const scope = splitScope()
  const sessionId = scope?.sessionId ?? ''
  const list = splitSessionList()
  const byId: ById = (list?.byId ?? {}) as ById
  const jobsBySession = list?.jobsBySession as Record<string, JobView[]> | undefined
  const [live, setLive] = useState<Record<string, LiveActivity>>({})
  const [, setTick] = useState(0)

  const rootId = useMemo(() => rootAncestor(byId, sessionId), [byId, sessionId])
  const rootSummary = rootId === undefined ? undefined : byId[rootId]

  // 镜像变了就重绘（会话列表由宿主推送；这里只订阅我们自己注入的快照变更信号）
  useEffect(() => {
    const timer = window.setInterval(() => setTick((t) => t + 1), POLL_MS)
    return () => window.clearInterval(timer)
  }, [])

  // 实时行：一次请求折叠整棵树里 running 子会话的最后活动
  useEffect(() => {
    if (!active || rootId === undefined) return
    let dead = false
    const pull = async (): Promise<void> => {
      try {
        const d = await postJson('/api/worktable/subagent-live', { rootSessionId: rootId })
        if (!dead) setLive((d?.live ?? {}) as Record<string, LiveActivity>)
      } catch { /* 拿不到就保持上一次，不打断界面 */ }
    }
    void pull()
    const timer = window.setInterval(() => { void pull() }, POLL_MS)
    return () => { dead = true; window.clearInterval(timer) }
  }, [active, rootId])

  const totals = useMemo(() => {
    if (rootId === undefined) return { count: 0, runningCount: 0 }
    let count = 0
    let runningCount = 0
    const walk = (parent: string): void => {
      for (const child of directChildren(byId, parent)) {
        count += 1
        if (child.running === true) runningCount += 1
        walk(String(child.id))
      }
    }
    walk(rootId)
    return { count, runningCount }
  }, [byId, rootId])

  const countLabel = totals.count === 0
    ? undefined
    : totals.runningCount > 0
      ? T('jobs.subagentCountRunning', { count: String(totals.count), running: String(totals.runningCount) })
      : T('jobs.subagentCount', { count: String(totals.count) })

  const openChild = useCallback((id: string): void => {
    const open = (window as any).__dshOpenSession
    if (typeof open === 'function') { try { void open(id) } catch { /* 跳不过去就算了 */ } }
  }, [])

  const bodyRef = useRef<HTMLDivElement>(null)
  const onTreeKeyDown = useCallback((event: any): void => {
    const items: HTMLElement[] = bodyRef.current === null
      ? []
      : Array.prototype.slice.call(bodyRef.current.querySelectorAll('[role="treeitem"]'))
    if (items.length === 0) return
    const index = items.indexOf(document.activeElement as HTMLElement)
    const focusAt = (i: number): void => { items[(i + items.length) % items.length]?.focus() }
    if (event.key === 'ArrowDown') { event.preventDefault(); focusAt(index + 1) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); focusAt(index < 0 ? items.length - 1 : index - 1) }
    else if (event.key === 'Home') { event.preventDefault(); focusAt(0) }
    else if (event.key === 'End') { event.preventDefault(); focusAt(items.length - 1) }
  }, [])

  const empty = rootId !== undefined && directChildren(byId, rootId).length === 0

  return (
    <div className="subagent dsh-mt_sav" data-mt-subagent-view="1">
      <div className="subagentHeader">
        <span className="subagentTitle">
          {T('pane.tasks')}
          {rootSummary?.displayTitle !== undefined && rootSummary.displayTitle !== '' ? ' · ' + String(rootSummary.displayTitle) : ''}
        </span>
        {countLabel !== undefined && <span className="subagentCount" data-mt-subagent-count="1">{countLabel}</span>}
        <button
          type="button"
          className="subagentRefresh"
          data-mt-jobs-refresh="1"
          aria-label={T('exp.refresh')}
          title={T('exp.refresh')}
          onClick={() => setTick((t) => t + 1)}
        >⟳</button>
      </div>
      <div ref={bodyRef} className="subagentBody" onKeyDown={onTreeKeyDown}>
        <div role="tree" aria-label={T('pane.tasks')}>
          {rootId !== undefined && rootSummary !== undefined && (
            <div
              role="treeitem"
              tabIndex={0}
              aria-level={0}
              aria-current={rootId === sessionId ? 'true' : undefined}
              className={'subagentRow' + (rootId === sessionId ? ' subagentRowActive' : '')}
              data-mt-subagent-root={rootId}
              onClick={() => openChild(String(rootId))}
            >
              <SaDot state={rootSummary.running === true ? 'ongoing' : 'done'} />
              <span className="subagentContent">
                <span className="subagentLabel">{String(rootSummary.displayTitle ?? '') !== '' ? String(rootSummary.displayTitle) : T('jobs.mainAgent')}</span>
                <span className="subagentSecondary">{`${T('jobs.mainAgent')} · ${rootSummary.running === true ? T('jobs.subRunning') : T('jobs.subInactive')}`}</span>
              </span>
            </div>
          )}
          {rootId !== undefined && (
            <TreeLevel
              byId={byId}
              parentSessionId={rootId}
              level={1}
              currentSessionId={sessionId}
              live={live}
              openChild={openChild}
            />
          )}
          {empty && (
            <div className="subagentEmpty" data-mt-subagents-empty="1">
              <div>{T('jobs.subagentsEmpty')}</div>
              <div className="subagentEmptyHint">{T('jobs.subagentsEmptyDesc')}</div>
            </div>
          )}
        </div>
        <JobsSection byId={byId} jobsBySession={jobsBySession} rootId={rootId} active={active} />
      </div>
    </div>
  )
}
