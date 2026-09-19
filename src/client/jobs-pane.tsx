/**
 * 任务管理窗 = 从 DSH-better-sidebar **直接搬过来**的那套视图
 * （markup 在 subagent-view.tsx、样式在 subagent-view.css，都是原样移植）。
 * 这个文件只负责把它挂成一个窗格内容。
 */
import { SubagentView } from './subagent-view'

export function JobsPane() {
  return <SubagentView active={true} />
}
