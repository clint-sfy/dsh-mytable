/**
 * 任务管理窗·纯派生逻辑（照搬 DSH-better-sidebar 的 `client/subagent-jobs.ts`）：
 * 任务行来自宿主的 `session/jobs` 推送镜像（`jobsBySession`），这里只做过滤 / 排序 / 文案，
 * 不发任何请求；行的排序与状态映射跟官方 ui-jobs 表头一致。
 */
import { T } from './split'

/** 宿主任务视图（字段名按 DSH 的 JobSnapshot） */
export type JobStatus = 'running' | 'stopping' | 'completed' | 'killed' | 'failed'
export interface JobView {
  id: string
  kind: string
  label: string
  status: JobStatus
  detail?: string
  startedAt: number
  finishedAt?: number
}

/** 任务行：任务本体 + 归属会话标题 */
export interface TreeJob {
  ownerSessionId: string
  ownerTitle: string
  job: JobView
}

/** registry 是否还把任务算作活着（时长每秒在跳） */
export function isJobLive(job: JobView): boolean {
  return job.status === 'running' || job.status === 'stopping'
}

/** 会话镜像（宿主 sessions list feed 的 byId 部分） */
export type SessionIndex = Readonly<Record<string, any>>

/**
 * 一棵树里的全部会话 id（根 + 所有通过「不间断 subagent 血链」够到它的会话；
 * 环会软失败）。与参考实现同语义，因此 jobs 段不会显示别人的活。
 */
export function treeSessionIds(byId: SessionIndex, rootId: string | undefined): Set<string> {
  const ids = new Set<string>()
  if (rootId === undefined || byId[rootId] === undefined) return ids
  for (const summary of Object.values(byId) as any[]) {
    if (summary?.id === rootId) { ids.add(rootId); continue }
    let node: any = summary
    const seen = new Set<string>()
    while (node?.origin === 'subagent' && node.parentId !== undefined && !seen.has(node.id)) {
      seen.add(node.id)
      if (node.parentId === rootId) { ids.add(summary.id); break }
      node = byId[node.parentId]
    }
  }
  return ids
}

/** 收集整棵树的后台任务（含子代理的），带归属会话标题 */
export function collectTreeJobs(
  byId: SessionIndex,
  jobsBySession: Readonly<Record<string, readonly JobView[]>> | undefined,
  rootId: string | undefined,
): TreeJob[] {
  const rows: TreeJob[] = []
  if (jobsBySession === undefined) return rows
  for (const sessionId of treeSessionIds(byId, rootId)) {
    const jobs = jobsBySession[sessionId]
    if (jobs === undefined || jobs.length === 0) continue
    const ownerTitle = byId[sessionId]?.displayTitle ?? sessionId
    for (const job of jobs) rows.push({ ownerSessionId: sessionId, ownerTitle, job })
  }
  return rows
}

/** 活着的在前（按开始时间），结束的按结束时间倒序；并列按开始时间（不会依赖宿主 Map 顺序） */
export function orderJobs(rows: readonly TreeJob[]): TreeJob[] {
  return [...rows].sort((left, right) => {
    const liveLeft = isJobLive(left.job)
    if (liveLeft !== isJobLive(right.job)) return liveLeft ? -1 : 1
    if (liveLeft) return left.job.startedAt - right.job.startedAt
    const finished = (right.job.finishedAt ?? right.job.startedAt) - (left.job.finishedAt ?? left.job.startedAt)
    return finished !== 0 ? finished : left.job.startedAt - right.job.startedAt
  })
}

/** 状态点语义（对齐官方：stopping/killed 都是「按要求结束」，共享警示色） */
export type JobDotState = 'ongoing' | 'warning' | 'done' | 'error'
export function jobDotState(status: JobStatus): JobDotState {
  switch (status) {
    case 'running': return 'ongoing'
    case 'stopping': return 'warning'
    case 'completed': return 'done'
    case 'killed': return 'warning'
    case 'failed': return 'error'
  }
}

export function jobStatusLabel(status: JobStatus): string {
  switch (status) {
    case 'running': return T('jobs.statusRunning')
    case 'stopping': return T('jobs.statusStopping')
    case 'completed': return T('jobs.statusCompleted')
    case 'killed': return T('jobs.statusKilled')
    case 'failed': return T('jobs.statusFailed')
  }
}

/** 时长：最多两个相邻单位（对齐官方 ui-jobs 的写法；超过一小时是例外，所以最大到小时） */
export function formatJobDuration(elapsedMs: number): string {
  const total = Math.max(0, Math.floor(elapsedMs / 1000))
  const seconds = total % 60
  const minutes = Math.floor(total / 60) % 60
  const hours = Math.floor(total / 3600)
  if (hours > 0) return T('jobs.durationHours', { hours: String(hours), minutes: String(minutes) })
  if (minutes > 0) return T('jobs.durationMinutes', { minutes: String(minutes), seconds: String(seconds) })
  return T('jobs.durationSeconds', { seconds: String(seconds) })
}
