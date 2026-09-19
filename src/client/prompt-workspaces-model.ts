export type PromptAccessMode = 'read' | 'editable' | 'confirm' | 'blocked' | 'create' | 'append'
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

function accessMode(value: unknown): PromptAccessMode {
  return value === 'editable' || value === 'confirm' || value === 'blocked' || value === 'create' || value === 'append' ? value : 'read'
}

function normalizeTemplate(value: unknown, index: number): PromptTemplate {
  if (!value || typeof value !== 'object') throw new Error(`模板 ${index + 1} 无效`)
  const entry = value as Record<string, unknown>
  const constraints: PromptConstraint[] = Array.isArray(entry.constraints) ? entry.constraints.map((value2, ci) => {
    if (!value2 || typeof value2 !== 'object') throw new Error(`限制文件 ${ci + 1} 无效`)
    const constraint = value2 as Record<string, unknown>
    return { id: str(constraint.id) || uid(), path: str(constraint.path).trim(), mode: accessMode(constraint.mode), note: str(constraint.note) }
  }) : []
  return {
    id: str(entry.id) || uid(),
    name: str(entry.name).trim() || `模板 ${index + 1}`,
    constraints,
    fixedTexts: Array.isArray(entry.fixedTexts) ? entry.fixedTexts.map(str).filter((item) => item.trim()) : [],
  }
}

/** 单模板导入边界：接受本插件导出的包装格式，并为副本重建所有 id。 */
export function normalizePromptTemplateFile(input: unknown): PromptTemplate {
  if (!input || typeof input !== 'object') throw new Error('文件内容不是模板配置')
  const raw = input as Record<string, unknown>
  if (raw.kind !== 'dsh-mytable-prompt-template' || raw.version !== 1) throw new Error('不支持的模板文件版本')
  const template = normalizeTemplate(raw.template, 0)
  return { ...template, id: uid(), constraints: template.constraints.map((item) => ({ ...item, id: uid() })) }
}

/** 导入边界：只接受 v1，并把缺失 id / 选中项修复到可用状态。 */
export function normalizePromptWorkspaceState(input: unknown): PromptWorkspaceState {
  if (!input || typeof input !== 'object') throw new Error('文件内容不是工作区配置')
  const raw = input as Record<string, unknown>
  if (raw.version !== 1 || !Array.isArray(raw.workspaces)) throw new Error('不支持的工作区文件版本')
  const workspaces: PromptWorkspace[] = raw.workspaces.map((value, wi) => {
    if (!value || typeof value !== 'object') throw new Error(`第 ${wi + 1} 个工作区无效`)
    const item = value as Record<string, unknown>
    if (!Array.isArray(item.templates)) throw new Error(`第 ${wi + 1} 个工作区缺少模板`)
    const templates: PromptTemplate[] = item.templates.map(normalizeTemplate)
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
  const accessLabels: Record<PromptAccessMode, string> = {
    read: '仅允许阅读，不要修改',
    editable: '允许阅读、新建、修改和删除',
    confirm: '允许阅读；任何修改或删除前必须先询问确认',
    blocked: '禁止读取、搜索、引用或修改',
    create: '只允许新建，不要修改或删除已有内容',
    append: '只允许在末尾追加，不要改写或删除已有内容',
  }
  const constraints = template.constraints.filter((c) => c.path.trim())
  if (constraints.length) {
    lines.push('【限制文件】')
    constraints.forEach((c, index) => {
      const permission = accessLabels[c.mode]
      lines.push(`${index + 1}. ${c.path.trim()} （${permission}）${c.note.trim() ? `：${c.note.trim()}` : ''}`)
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
