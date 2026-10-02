export type AddProjectSessionBinding = {
  sessionId: string
  canSave: boolean
}

export type SessionGroup = {
  title: string
  sessions: { id: string; title: string; isCurrent: boolean }[]
}

/** 项目绑定只展示已归入宿主工作区的对话。 */
export function bindableSessionGroups(groups: readonly SessionGroup[]): SessionGroup[] {
  return groups.filter((group) => group.title !== '未分组')
}

/** Capture the conversation selected by the host at the moment the form opens. */
function desktopSessionId(raw: unknown): string {
  if (typeof raw !== 'string' || !raw) return ''
  try {
    const sessionId = (JSON.parse(raw) as { sessionId?: unknown } | null)?.sessionId
    return typeof sessionId === 'string' && sessionId.trim() ? sessionId : ''
  } catch {
    return ''
  }
}

export function captureCurrentSessionId(snapshot: unknown, desktopCurrent?: unknown): string {
  const desktop = desktopSessionId(desktopCurrent)
  if (desktop) return desktop
  const current = (snapshot as { current?: unknown } | null | undefined)?.current
  return typeof current === 'string' && current.trim() ? current : ''
}

/** No fallback is allowed: an add-project form can only bind its captured session. */
export function addProjectSessionBinding(snapshot: unknown, desktopCurrent?: unknown): AddProjectSessionBinding {
  const sessionId = captureCurrentSessionId(snapshot, desktopCurrent)
  return { sessionId, canSave: sessionId.length > 0 }
}

export function sessionTitleOf(
  groups: { sessions?: { id: string; title: string }[] }[],
  sessionId: string,
): string {
  if (!sessionId) return ''
  for (const group of groups) {
    const session = group.sessions?.find((item) => item.id === sessionId)
    if (session) return session.title
  }
  return sessionId
}
