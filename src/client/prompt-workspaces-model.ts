export type PromptAccessMode = 'read' | 'editable'
export type PromptConstraint = { id: string; path: string; mode: PromptAccessMode; note: string }
export type PromptTemplate = { id: string; name: string; constraints: PromptConstraint[]; fixedTexts: string[] }
export type PromptWorkspace = { id: string; name: string; icon: string; templates: PromptTemplate[] }
export type PromptWorkspaceState = {
  version: 1
  workspaces: PromptWorkspace[]
  selectedWorkspaceId: string
  selectedTemplateId: string
}

const uid = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`

export function newPromptTemplate(name = 'PRD 编程'): PromptTemplate {
  return { id: uid(), name, constraints: [], fixedTexts: [] }
}

export function newPromptWorkspace(name = '代码编程工作区'): PromptWorkspace {
  const first = newPromptTemplate()
  return { id: uid(), name, icon: '💻', templates: [first, newPromptTemplate('Todo 撰写'), newPromptTemplate('测试撰写')] }
}

export function defaultPromptWorkspaceState(): PromptWorkspaceState {
  const workspace = newPromptWorkspace()
  return { version: 1, workspaces: [workspace], selectedWorkspaceId: workspace.id, selectedTemplateId: workspace.templates[0].id }
}

const str = (value: unknown): string => typeof value === 'string' ? value : ''

/** 导入边界：只接受 v1，并把缺失 id / 选中项修复到可用状态。 */
export function normalizePromptWorkspaceState(input: unknown): PromptWorkspaceState {
  if (!input || typeof input !== 'object') throw new Error('文件内容不是工作区配置')
  const raw = input as Record<string, unknown>
  if (raw.version !== 1 || !Array.isArray(raw.workspaces)) throw new Error('不支持的工作区文件版本')
  const workspaces: PromptWorkspace[] = raw.workspaces.map((value, wi) => {
    if (!value || typeof value !== 'object') throw new Error(`第 ${wi + 1} 个工作区无效`)
    const item = value as Record<string, unknown>
    if (!Array.isArray(item.templates)) throw new Error(`第 ${wi + 1} 个工作区缺少模板`)
    const templates: PromptTemplate[] = item.templates.map((value2, ti) => {
      if (!value2 || typeof value2 !== 'object') throw new Error(`模板 ${ti + 1} 无效`)
      const entry = value2 as Record<string, unknown>
      const constraints: PromptConstraint[] = Array.isArray(entry.constraints) ? entry.constraints.map((value3, ci) => {
        if (!value3 || typeof value3 !== 'object') throw new Error(`限制文件 ${ci + 1} 无效`)
        const c = value3 as Record<string, unknown>
        return { id: str(c.id) || uid(), path: str(c.path).trim(), mode: c.mode === 'editable' ? 'editable' : 'read', note: str(c.note) }
      }) : []
      return {
        id: str(entry.id) || uid(),
        name: str(entry.name).trim() || `模板 ${ti + 1}`,
        constraints,
        fixedTexts: Array.isArray(entry.fixedTexts) ? entry.fixedTexts.map(str).filter((v) => v.trim()) : [],
      }
    })
    if (templates.length === 0) templates.push(newPromptTemplate())
    return { id: str(item.id) || uid(), name: str(item.name).trim() || `工作区 ${wi + 1}`, icon: str(item.icon) || '💻', templates }
  })
  if (workspaces.length === 0) workspaces.push(newPromptWorkspace())
  const selectedWorkspace = workspaces.find((w) => w.id === raw.selectedWorkspaceId) ?? workspaces[0]
  const selectedTemplate = selectedWorkspace.templates.find((t) => t.id === raw.selectedTemplateId) ?? selectedWorkspace.templates[0]
  return { version: 1, workspaces, selectedWorkspaceId: selectedWorkspace.id, selectedTemplateId: selectedTemplate.id }
}

/** 顺序是产品硬约束：限制文件 → 固定话语 → 当前需求；需求始终收尾。 */
export function buildWorkspacePrompt(template: PromptTemplate, requirement: string): string {
  const lines: string[] = []
  const constraints = template.constraints.filter((c) => c.path.trim())
  if (constraints.length) {
    lines.push('【限制文件】')
    constraints.forEach((c, index) => {
      const permission = c.mode === 'editable' ? '允许阅读和修改' : '仅允许阅读，不要修改'
      lines.push(`${index + 1}. ${c.path.trim()}（${permission}）${c.note.trim() ? `：${c.note.trim()}` : ''}`)
    })
  }
  const fixed = template.fixedTexts.map((v) => v.trim()).filter(Boolean)
  if (fixed.length) {
    if (lines.length) lines.push('')
    lines.push('【固定要求】')
    fixed.forEach((value, index) => lines.push(`${index + 1}. ${value}`))
  }
  if (lines.length) lines.push('')
  lines.push('【当前需求】', requirement.trim())
  return lines.join('\n')
}
