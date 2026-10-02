export type ProjectScope = { sessionId: string; cwd: string }

/** 项目文件夹是工作台窗格的数据根；对话 cwd 只在项目没有文件夹时兜底。 */
export function resolveProjectScope(
  session: ProjectScope | null,
  activeProjectId: string | null,
  folders: Record<string, string>,
  bindings: Record<string, string> = {},
): ProjectScope | null {
  const projectSessionId = activeProjectId ? String(bindings[activeProjectId] ?? '').trim() : ''
  const projectCwd = activeProjectId ? String(folders[activeProjectId] ?? '').trim() : ''
  const sessionId = projectSessionId || session?.sessionId || ''
  if (!sessionId) return null
  return { sessionId, cwd: projectCwd || session?.cwd || '' }
}
