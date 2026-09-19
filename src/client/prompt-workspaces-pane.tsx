import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { replaceDraft } from './reference-in-chat'
import { splitScope } from './split'
import { WORKSPACE_ICONS } from './icon-set'
import {
  buildWorkspacePrompt,
  defaultPromptWorkspaceState,
  newPromptTemplate,
  newPromptWorkspace,
  normalizePromptWorkspaceState,
  type PromptConstraint,
  type PromptTemplate,
  type PromptWorkspace,
  type PromptWorkspaceState,
} from './prompt-workspaces-model'

const STORAGE_KEY = 'dsh.mytable.promptWorkspaces.v1'
const SIDEBAR_COLLAPSED_KEY = 'dsh.mytable.promptWorkspaces.sidebarCollapsed.v1'
const CONSTRAINTS_COLLAPSED_KEY = 'dsh.mytable.promptWorkspaces.constraintsCollapsed.v1'
const FIXED_COLLAPSED_KEY = 'dsh.mytable.promptWorkspaces.fixedCollapsed.v1'
type Entry = { name: string; path: string; isDir: boolean }
type PickerState = { constraintId: string; path: string; selectedPath: string; entries: Entry[]; loading: boolean; error: string }

function loadState(): PromptWorkspaceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? normalizePromptWorkspaceState(JSON.parse(raw)) : defaultPromptWorkspaceState()
  } catch { return defaultPromptWorkspaceState() }
}

function parentPath(path: string): string {
  const normalized = path.replace(/[\\/]+$/, '')
  const at = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'))
  return at <= 2 ? normalized.slice(0, at + 1) : normalized.slice(0, at)
}

function downloadState(state: PromptWorkspaceState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'dsh-mytable-prompt-workspaces.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function PromptWorkspacesPane() {
  const [state, setState] = useState<PromptWorkspaceState>(loadState)
  const [requirement, setRequirement] = useState('')
  const [status, setStatus] = useState('')
  const [picker, setPicker] = useState<PickerState | null>(null)
  const [constraintsCollapsed, setConstraintsCollapsed] = useState(() => {
    try { return localStorage.getItem(CONSTRAINTS_COLLAPSED_KEY) === '1' } catch { return false }
  })
  const [fixedCollapsed, setFixedCollapsed] = useState(() => {
    try { return localStorage.getItem(FIXED_COLLAPSED_KEY) === '1' } catch { return false }
  })
  const [iconWorkspaceId, setIconWorkspaceId] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1' } catch { return false }
  })
  const importRef = useRef<HTMLInputElement | null>(null)
  const templateDragIdRef = useRef<string | null>(null)

  const workspace = state.workspaces.find((w) => w.id === state.selectedWorkspaceId) ?? state.workspaces[0]
  const template = workspace.templates.find((t) => t.id === state.selectedTemplateId) ?? workspace.templates[0]
  const preview = useMemo(() => buildWorkspacePrompt(template, requirement), [template, requirement])

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch {} }, [state])
  useEffect(() => { try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0') } catch {} }, [sidebarCollapsed])
  useEffect(() => { try { localStorage.setItem(CONSTRAINTS_COLLAPSED_KEY, constraintsCollapsed ? '1' : '0') } catch {} }, [constraintsCollapsed])
  useEffect(() => { try { localStorage.setItem(FIXED_COLLAPSED_KEY, fixedCollapsed ? '1' : '0') } catch {} }, [fixedCollapsed])
  useEffect(() => { setRequirement(''); setStatus('') }, [state.selectedWorkspaceId, state.selectedTemplateId])

  const update = (mutator: (draft: PromptWorkspaceState) => void): void => {
    setState((previous) => {
      const next = structuredClone(previous)
      mutator(next)
      return next
    })
  }
  const editWorkspace = (draft: PromptWorkspaceState): PromptWorkspace =>
    draft.workspaces.find((w) => w.id === workspace.id) ?? draft.workspaces[0]
  const editTemplate = (draft: PromptWorkspaceState): PromptTemplate => {
    const ws = editWorkspace(draft)
    return ws.templates.find((t) => t.id === template.id) ?? ws.templates[0]
  }

  const loadDirectory = async (constraintId: string, path: string, selectedPath = ''): Promise<void> => {
    setPicker({ constraintId, path, selectedPath, entries: [], loading: true, error: '' })
    const scope = splitScope()
    try {
      const response = await fetch('/api/worktable/fs', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path, sessionId: scope?.sessionId ?? '', cwd: scope?.cwd ?? '' }),
      })
      const data = await response.json()
      if (!response.ok || data.error) throw new Error(data.error || `HTTP ${response.status}`)
      const entries: Entry[] = Array.isArray(data.entries) ? data.entries : []
      entries.sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name))
      setPicker({ constraintId, path: String(data.path ?? path), selectedPath, entries, loading: false, error: '' })
    } catch (error) {
      setPicker({ constraintId, path, selectedPath, entries: [], loading: false, error: String(error instanceof Error ? error.message : error) })
    }
  }

  const chooseEntry = (entry: Entry): void => {
    if (!picker) return
    update((draft) => {
      const constraint = editTemplate(draft).constraints.find((c) => c.id === picker.constraintId)
      if (constraint) constraint.path = entry.path
    })
    if (entry.isDir) setPicker((current) => current ? { ...current, selectedPath: entry.path } : current)
    else setPicker(null)
  }

  const reorderTemplate = (targetId: string): void => {
    const sourceId = templateDragIdRef.current
    if (!sourceId || sourceId === targetId) return
    update((draft) => {
      const ws = editWorkspace(draft)
      const from = ws.templates.findIndex((item) => item.id === sourceId)
      const to = ws.templates.findIndex((item) => item.id === targetId)
      if (from < 0 || to < 0) return
      const [moved] = ws.templates.splice(from, 1)
      ws.templates.splice(to, 0, moved)
    })
  }

  const importFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const next = normalizePromptWorkspaceState(JSON.parse(await file.text()))
      setState(next)
      setRequirement('')
      setStatus(`已导入 ${file.name}`)
    } catch (error) {
      setStatus('导入失败：' + String(error instanceof Error ? error.message : error))
    }
  }

  const fillCurrentDraft = (): void => {
    if (!requirement.trim()) return
    if (replaceDraft(preview, splitScope())) {
      setRequirement('')
      setStatus('已填入聊天框，尚未发送；检查后请在聊天框点击发送。')
    } else setStatus('没有找到当前工作区的聊天输入框。')
  }

  return (
    <div className="dsh-mt_pw" data-side-collapsed={sidebarCollapsed}>
      <aside className="dsh-mt_pwSide">
        <div className="dsh-mt_pwBrand">
          <strong>文案工作区</strong>
          <span className="dsh-mt_pwBrandActions">
            <button type="button" title="新建工作区" aria-label="新建工作区" onClick={() => update((draft) => {
              const item = newPromptWorkspace(`新工作区 ${draft.workspaces.length + 1}`)
              draft.workspaces.push(item); draft.selectedWorkspaceId = item.id; draft.selectedTemplateId = item.templates[0].id
            })}>＋</button>
            <button type="button" className="dsh-mt_pwCollapse" title={sidebarCollapsed ? '展开左侧栏' : '向左收起侧边栏'} aria-label={sidebarCollapsed ? '展开左侧栏' : '向左收起侧边栏'} aria-expanded={!sidebarCollapsed} onClick={() => setSidebarCollapsed((value) => !value)}>{sidebarCollapsed ? '›' : '‹'}</button>
          </span>
        </div>
        <div className="dsh-mt_pwWsList">
          {state.workspaces.map((item) => <div className="dsh-mt_pwWsItem" key={item.id} data-active={item.id === workspace.id}>
            <button className="dsh-mt_pwWsIcon" type="button" title="更换工作区图标" aria-label={`更换 ${item.name} 的图标`} onClick={() => setIconWorkspaceId((value) => value === item.id ? null : item.id)}>{item.icon}</button>
            <button className="dsh-mt_pwWsName" type="button" onClick={() => update((draft) => {
              const next = draft.workspaces.find((w) => w.id === item.id)!
              draft.selectedWorkspaceId = next.id; draft.selectedTemplateId = next.templates[0].id
            })}>{item.name}</button>
          </div>)}
        </div>
        <div className="dsh-mt_pwSideActions">
          <button type="button" title="导入工作区文件" aria-label="导入工作区文件" onClick={() => importRef.current?.click()}><span aria-hidden>📥</span><span className="dsh-mt_pwActionText">导入工作区文件</span></button>
          <button type="button" title="导出到本地文件" aria-label="导出到本地文件" onClick={() => downloadState(state)}><span aria-hidden>📤</span><span className="dsh-mt_pwActionText">导出到本地文件</span></button>
          <input ref={importRef} hidden type="file" accept=".json,application/json" onChange={(event) => void importFile(event)} />
        </div>
      </aside>

      <main className="dsh-mt_pwMain">
        <header className="dsh-mt_pwHeader">
          <input aria-label="工作区名称" value={workspace.name} onChange={(event) => update((draft) => { editWorkspace(draft).name = event.target.value })} />
          <button type="button" className="dsh-mt_pwDanger" disabled={state.workspaces.length <= 1} onClick={() => {
            if (state.workspaces.length <= 1 || !confirm(`删除工作区“${workspace.name}”？`)) return
            update((draft) => {
              draft.workspaces = draft.workspaces.filter((w) => w.id !== workspace.id)
              draft.selectedWorkspaceId = draft.workspaces[0].id; draft.selectedTemplateId = draft.workspaces[0].templates[0].id
            })
          }}>删除工作区</button>
        </header>

        <nav className="dsh-mt_pwTabs">
          {workspace.templates.map((item) => <button key={item.id} type="button" draggable title="拖动可调整模板顺序" data-active={item.id === template.id} onDragStart={() => { templateDragIdRef.current = item.id }} onDragOver={(event) => { event.preventDefault() }} onDrop={(event) => { event.preventDefault(); reorderTemplate(item.id); templateDragIdRef.current = null }} onDragEnd={() => { templateDragIdRef.current = null }} onClick={() => update((draft) => { draft.selectedTemplateId = item.id })}>{item.name}</button>)}
          <button type="button" onClick={() => update((draft) => {
            const ws = editWorkspace(draft); const item = newPromptTemplate(`新模板 ${ws.templates.length + 1}`)
            ws.templates.push(item); draft.selectedTemplateId = item.id
          })}>＋ 新建</button>
        </nav>

        <section className="dsh-mt_pwCard dsh-mt_pwTemplate">
          <input aria-label="模板名称" value={template.name} onChange={(event) => update((draft) => { editTemplate(draft).name = event.target.value })} />
          <button type="button" className="dsh-mt_pwDanger" disabled={workspace.templates.length <= 1} onClick={() => {
            if (workspace.templates.length <= 1 || !confirm(`删除模板“${template.name}”？`)) return
            update((draft) => {
              const ws = editWorkspace(draft); ws.templates = ws.templates.filter((t) => t.id !== template.id); draft.selectedTemplateId = ws.templates[0].id
            })
          }}>删除模板</button>
        </section>

        <section className="dsh-mt_pwCard">
          <div className="dsh-mt_pwCardHead"><span className="dsh-mt_pwCardTitle"><strong>1. 限制文件</strong><small>文件或文件夹；选择仅阅读或允许编辑</small></span><button type="button" className="dsh-mt_pwFold" aria-expanded={!constraintsCollapsed} onClick={() => setConstraintsCollapsed((value) => !value)}>{constraintsCollapsed ? '展开' : '收起'}</button></div>
          {!constraintsCollapsed && <div className="dsh-mt_pwCardBody">{template.constraints.map((constraint) => <div className="dsh-mt_pwConstraint" key={constraint.id}>
            <input value={constraint.path} placeholder="文件路径（可直接填写）" onChange={(event) => update((draft) => {
              const item = editTemplate(draft).constraints.find((c) => c.id === constraint.id); if (item) item.path = event.target.value
            })} />
            <select value={constraint.mode} onChange={(event) => update((draft) => {
              const item = editTemplate(draft).constraints.find((c) => c.id === constraint.id); if (item) item.mode = event.target.value === 'editable' ? 'editable' : 'read'
            })}><option value="read">仅阅读</option><option value="editable">可编辑</option></select>
            <button type="button" onClick={() => void loadDirectory(constraint.id, splitScope()?.cwd ?? '', constraint.path)}>选择文件或文件夹</button>
            <input className="dsh-mt_pwNote" value={constraint.note} placeholder="针对这个文件的一句话限制（可选）" onChange={(event) => update((draft) => {
              const item = editTemplate(draft).constraints.find((c) => c.id === constraint.id); if (item) item.note = event.target.value
            })} />
            <button type="button" className="dsh-mt_pwDanger" onClick={() => update((draft) => {
              const t = editTemplate(draft); t.constraints = t.constraints.filter((c) => c.id !== constraint.id)
            })}>删除</button>
          </div>)}
          {!template.constraints.length && <p className="dsh-mt_pwEmpty">还没有限制文件。</p>}
          <button type="button" onClick={() => update((draft) => editTemplate(draft).constraints.push({ id: crypto.randomUUID(), path: '', mode: 'read', note: '' }))}>＋ 添加限制文件</button>
          </div>}
        </section>

        <section className="dsh-mt_pwCard">
          <div className="dsh-mt_pwCardHead"><span className="dsh-mt_pwCardTitle"><strong>2. 固定话语</strong><small>每次都会写入聊天框</small></span><button type="button" className="dsh-mt_pwFold" aria-expanded={!fixedCollapsed} onClick={() => setFixedCollapsed((value) => !value)}>{fixedCollapsed ? '展开' : '收起'}</button></div>
          {!fixedCollapsed && <div className="dsh-mt_pwCardBody">{template.fixedTexts.map((value, index) => <div className="dsh-mt_pwFixed" key={index}>
            <textarea value={value} placeholder="例如：先阅读 PRD，再按最小改动原则实现" onChange={(event) => update((draft) => { editTemplate(draft).fixedTexts[index] = event.target.value })} />
            <button type="button" className="dsh-mt_pwDanger" onClick={() => update((draft) => { editTemplate(draft).fixedTexts.splice(index, 1) })}>删除</button>
          </div>)}
          {!template.fixedTexts.length && <p className="dsh-mt_pwEmpty">还没有固定话语。</p>}
          <button type="button" onClick={() => update((draft) => editTemplate(draft).fixedTexts.push(''))}>＋ 添加固定话语</button>
          </div>}
        </section>

        <section className="dsh-mt_pwCard">
          <div className="dsh-mt_pwCardHead"><strong>3. 当前需求</strong><span>始终位于最下面；填入成功后清空</span></div>
          <textarea className="dsh-mt_pwNeed" value={requirement} placeholder="输入这一次要 AI 完成的具体需求…" onChange={(event) => setRequirement(event.target.value)} />
          <details><summary>预览最终文案</summary><pre>{preview}</pre></details>
          <div className="dsh-mt_pwSubmit"><span data-error={status.startsWith('导入失败')}>{status}</span><button type="button" disabled={!requirement.trim()} onClick={fillCurrentDraft}>填入当前聊天框</button></div>
        </section>
      </main>

      {iconWorkspaceId && <div className="dsh-mt_pwIconPicker" role="dialog" aria-label="选择工作区图标">
        <div className="dsh-mt_pwIconPickerHead"><strong>选择图标</strong><button type="button" onClick={() => setIconWorkspaceId(null)}>✕</button></div>
        <div className="dsh-mt_pwIconGrid">{WORKSPACE_ICONS.map((icon) => <button type="button" key={icon} onClick={() => {
          update((draft) => { const item = draft.workspaces.find((value) => value.id === iconWorkspaceId); if (item) item.icon = icon })
          setIconWorkspaceId(null)
        }}>{icon}</button>)}</div>
      </div>}

      {picker && <div className="dsh-mt_pwPicker">
        <div className="dsh-mt_pwPickerHead"><button type="button" onClick={() => void loadDirectory(picker.constraintId, parentPath(picker.path), picker.selectedPath)}>↑ 上一级</button><span>{picker.path || '当前工作区'}</span><button type="button" onClick={() => setPicker(null)}>✕</button></div>
        <p className="dsh-mt_pwPickerHint">单击文件夹即可选中；文件夹获得焦点后按 Tab 可继续进入。</p>
        <div className="dsh-mt_pwFiles">
          {picker.loading ? <p>读取中…</p> : picker.error ? <p className="dsh-mt_pwError">无法读取：{picker.error}</p> : picker.entries.length ? picker.entries.map((entry) => <button type="button" key={entry.path} data-selected={picker.selectedPath === entry.path} onClick={() => chooseEntry(entry)} onKeyDown={(event) => {
            if (entry.isDir && event.key === 'Tab') { event.preventDefault(); void loadDirectory(picker.constraintId, entry.path) }
          }}>{entry.isDir ? '📁' : '📄'} {entry.name}</button>) : <p>这个目录是空的</p>}
        </div>
      </div>}
    </div>
  )
}
