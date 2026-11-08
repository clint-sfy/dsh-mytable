import { useCallback, useEffect, useState } from 'react'
import { renderMarkdown, T, useHostScheme } from './split'

type SkillEntry = { id: string; name: string; description: string; source: string }
type SkillFile = { id: string; path: string; entry: boolean }
type Props = { sessionId: string }
type LoadedSkill = { files: SkillFile[]; file: SkillFile | null; content: string }
const SIDEBAR_COLLAPSED_KEY = 'dsh.mytable.skills.sidebarCollapsed.v1'
const SKILL_FOLDERS_KEY = 'dsh.mytable.skills.folders.v1'
const UNCATEGORIZED_FOLDER_ID = 'uncategorized'
type SkillFolder = { id: string; name: string }
type SkillFolderState = { folders: SkillFolder[]; assignments: Record<string, string> }
type FolderEditor = { kind: 'create'; name: string } | { kind: 'rename'; folderId: string; name: string }

function loadSkillFolders(): SkillFolderState {
  try {
    const value = JSON.parse(localStorage.getItem(SKILL_FOLDERS_KEY) || '{}') as Partial<SkillFolderState>
    const folders = Array.isArray(value.folders)
      ? value.folders.filter((folder): folder is SkillFolder => !!folder && typeof folder.id === 'string' && folder.id !== UNCATEGORIZED_FOLDER_ID && typeof folder.name === 'string' && !!folder.name.trim())
      : []
    const assignments = value.assignments && typeof value.assignments === 'object' && !Array.isArray(value.assignments)
      ? value.assignments
      : {}
    return { folders, assignments }
  } catch {
    return { folders: [], assignments: {} }
  }
}

async function requestSkills(body: Record<string, unknown>): Promise<any> {
  const response = await fetch('/api/worktable/skills', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data?.ok !== true) throw new Error(data?.error || '请求失败')
  return data
}

async function loadSkillDocument(sessionId: string, skill: SkillEntry, preferredFileId?: string): Promise<LoadedSkill> {
  const fileData = await requestSkills({ sessionId, action: 'files', id: skill.id })
  const files: SkillFile[] = Array.isArray(fileData.files) ? fileData.files : []
  const file = (preferredFileId && files.find((item) => item.id === preferredFileId))
    ?? files.find((item) => item.entry)
    ?? files[0]
    ?? null
  if (!file) return { files, file: null, content: '' }
  const document = await requestSkills({ sessionId, action: 'read', id: file.id })
  return { files, file, content: String(document.content ?? '') }
}

export function LocalSkillsPane({ sessionId }: Props) {
  const [skills, setSkills] = useState<SkillEntry[]>([])
  const [selected, setSelected] = useState<SkillEntry | null>(null)
  const [files, setFiles] = useState<SkillFile[]>([])
  const [selectedFile, setSelectedFile] = useState<SkillFile | null>(null)
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [mode, setMode] = useState<'preview' | 'edit'>('preview')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1' } catch { return false }
  })
  const [folderState, setFolderState] = useState<SkillFolderState>(loadSkillFolders)
  const [folderEditor, setFolderEditor] = useState<FolderEditor | null>(null)
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({})
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchSelectedIds, setBatchSelectedIds] = useState<string[]>([])
  const [batchTargetFolderId, setBatchTargetFolderId] = useState(UNCATEGORIZED_FOLDER_ID)
  const [batchCreateFolderOpen, setBatchCreateFolderOpen] = useState(false)
  const [batchNewFolderName, setBatchNewFolderName] = useState('')
  const [batchError, setBatchError] = useState('')
  const dirty = content !== savedContent
  const dark = useHostScheme()

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0') } catch {}
  }, [sidebarCollapsed])
  useEffect(() => {
    try { localStorage.setItem(SKILL_FOLDERS_KEY, JSON.stringify(folderState)) } catch {}
  }, [folderState])

  const applyLoaded = (skill: SkillEntry, loaded: LoadedSkill) => {
    setSelected(skill)
    setFiles(loaded.files)
    setSelectedFile(loaded.file)
    setContent(loaded.content)
    setSavedContent(loaded.content)
    setMode('preview')
  }

  const openSkill = useCallback(async (entry: SkillEntry) => {
    if (selected?.id === entry.id) return
    if (dirty && !window.confirm('当前修改还没有保存，确定切换技能吗？')) return
    setError('')
    setNotice('')
    setLoading(true)
    try {
      applyLoaded(entry, await loadSkillDocument(sessionId, entry))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }, [dirty, selected?.id, sessionId])

  const openFile = useCallback(async (file: SkillFile) => {
    if (selectedFile?.id === file.id) return
    if (dirty && !window.confirm('当前修改还没有保存，确定切换文件吗？')) return
    setError('')
    setNotice('')
    setLoading(true)
    try {
      const data = await requestSkills({ sessionId, action: 'read', id: file.id })
      setSelectedFile(file)
      setContent(String(data.content ?? ''))
      setSavedContent(String(data.content ?? ''))
      setMode('preview')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }, [dirty, selectedFile?.id, sessionId])

  const refresh = useCallback(async (keepSelection = true) => {
    if (keepSelection && dirty && !window.confirm('当前修改还没有保存，刷新后会丢失。仍要刷新吗？')) return
    setLoading(true)
    setError('')
    setNotice('')
    try {
      const data = await requestSkills({ sessionId, action: 'list' })
      const nextSkills: SkillEntry[] = Array.isArray(data.skills) ? data.skills : []
      setSkills(nextSkills)
      const next = (keepSelection ? nextSkills.find((item) => item.id === selected?.id) : undefined) ?? nextSkills[0] ?? null
      if (!next) {
        setSelected(null)
        setFiles([])
        setSelectedFile(null)
        setContent('')
        setSavedContent('')
      } else {
        const preferredFileId = next.id === selected?.id ? selectedFile?.id : undefined
        applyLoaded(next, await loadSkillDocument(sessionId, next, preferredFileId))
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }, [dirty, selected?.id, selectedFile?.id, sessionId])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void requestSkills({ sessionId, action: 'list' }).then(async (data) => {
      if (!active) return
      const nextSkills: SkillEntry[] = Array.isArray(data.skills) ? data.skills : []
      setSkills(nextSkills)
      const first = nextSkills[0]
      if (!first) {
        setSelected(null)
        setFiles([])
        setSelectedFile(null)
        setContent('')
        setSavedContent('')
        return
      }
      const loaded = await loadSkillDocument(sessionId, first)
      if (active) applyLoaded(first, loaded)
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : String(cause))
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [sessionId])

  const save = useCallback(async () => {
    if (!selectedFile || !dirty || saving) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await requestSkills({ sessionId, action: 'write', id: selectedFile.id, content })
      setSavedContent(content)
      setNotice('已保存')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setSaving(false)
    }
  }, [content, dirty, saving, selectedFile, sessionId])

  const saveFolder = (): void => {
    if (!folderEditor) return
    const name = folderEditor.name.trim()
    if (!name) return
    if (folderState.folders.some((folder) => folder.id !== (folderEditor.kind === 'rename' ? folderEditor.folderId : '') && folder.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setError('已经有同名文件夹了。')
      return
    }
    setError('')
    if (folderEditor.kind === 'create') {
      setFolderState((current) => ({
        ...current,
        folders: [...current.folders, { id: crypto.randomUUID(), name }],
      }))
      setNotice('已创建文件夹')
    } else {
      setFolderState((current) => ({
        ...current,
        folders: current.folders.map((item) => item.id === folderEditor.folderId ? { ...item, name } : item),
      }))
      setNotice('文件夹名称已更新')
    }
    setFolderEditor(null)
  }

  const deleteFolder = (folder: SkillFolder): void => {
    setFolderState((current) => ({
      folders: current.folders.filter((item) => item.id !== folder.id),
      assignments: Object.fromEntries(Object.entries(current.assignments).filter(([, id]) => id !== folder.id)),
    }))
    if (folderEditor?.kind === 'rename' && folderEditor.folderId === folder.id) setFolderEditor(null)
    setNotice(`已删除“${folder.name}”；其中技能已移到未分类`)
  }

  const openBatch = (): void => {
    setBatchSelectedIds(selected?.source === '个人技能' ? [selected.id] : [])
    setBatchTargetFolderId(UNCATEGORIZED_FOLDER_ID)
    setBatchCreateFolderOpen(false)
    setBatchNewFolderName('')
    setBatchError('')
    setBatchOpen(true)
  }

  const createBatchFolder = (): void => {
    const name = batchNewFolderName.trim()
    if (!name) return
    if (folderState.folders.some((folder) => folder.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setBatchError('已经有同名文件夹了。')
      return
    }
    const folder = { id: crypto.randomUUID(), name }
    setFolderState((current) => ({ ...current, folders: [...current.folders, folder] }))
    setBatchTargetFolderId(folder.id)
    setBatchNewFolderName('')
    setBatchCreateFolderOpen(false)
    setBatchError('')
  }

  const applyBatchFolder = (): void => {
    const personalIds = new Set(skills.filter((skill) => skill.source === '个人技能').map((skill) => skill.id))
    const ids = batchSelectedIds.filter((id) => personalIds.has(id))
    if (!ids.length) {
      setBatchError('先选择要归类的 Skill。')
      return
    }
    setFolderState((current) => {
      const assignments = { ...current.assignments }
      ids.forEach((id) => {
        if (batchTargetFolderId === UNCATEGORIZED_FOLDER_ID) delete assignments[id]
        else assignments[id] = batchTargetFolderId
      })
      return { ...current, assignments }
    })
    setNotice('已将所选 Skill 移入文件夹')
    setBatchOpen(false)
  }

  const filtered = skills.filter((skill) => {
    const query = search.trim().toLowerCase()
    return !query || skill.name.toLowerCase().includes(query) || skill.description.toLowerCase().includes(query)
  })
  const visiblePersonal = filtered.filter((skill) => skill.source === '个人技能')
  const personalFolders = [{ id: UNCATEGORIZED_FOLDER_ID, name: '未分类' }, ...folderState.folders].map((folder) => {
    const options = visiblePersonal.filter((skill) => (folderState.assignments[skill.id] || UNCATEGORIZED_FOLDER_ID) === folder.id)
    const selectedIsHere = selected?.source === '个人技能'
      && (folderState.assignments[selected.id] || UNCATEGORIZED_FOLDER_ID) === folder.id
    if (selected?.source === '个人技能' && selectedIsHere && !options.some((skill) => skill.id === selected.id)) options.unshift(selected)
    return { ...folder, options }
  })
  const projectSkills = filtered.filter((skill) => skill.source === '项目技能')
  const allVisiblePersonalSelected = visiblePersonal.length > 0 && visiblePersonal.every((skill) => batchSelectedIds.includes(skill.id))

  return (
    <div className="dsh-mt_skills" data-side-collapsed={sidebarCollapsed} data-dark={dark}>
      <aside className="dsh-mt_skillsSide" data-collapsed={sidebarCollapsed}>
        <div className="dsh-mt_skillsSideHead">
          <button
            type="button"
            className="dsh-mt_skillsCollapse"
            title={sidebarCollapsed ? '展开技能列表' : '收起技能列表'}
            aria-label={sidebarCollapsed ? '展开技能列表' : '收起技能列表'}
            aria-expanded={!sidebarCollapsed}
            onClick={() => setSidebarCollapsed((value) => !value)}
          >{sidebarCollapsed ? '›' : '‹'}</button>
          {!sidebarCollapsed && <>
            <strong>本地技能</strong>
            <button type="button" title="刷新列表" onClick={() => void refresh(true)} disabled={loading}>↻</button>
          </>}
        </div>
        {!sidebarCollapsed && <>
          <input
            aria-label="搜索技能"
            className="dsh-mt_skillsSearch"
            placeholder="搜索技能…"
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
          <div className="dsh-mt_skillsList">
          <section className="dsh-mt_skillsGroup">
            <div className="dsh-mt_skillsGroupName dsh-mt_skillsGroupHeading">
              <span>个人技能</span>
              <span className="dsh-mt_skillsGroupActions">
                <button type="button" title="批量归类技能" onClick={openBatch}>批量</button>
                <button type="button" title="新建文件夹" aria-label="新建文件夹" onClick={() => { setError(''); setFolderEditor({ kind: 'create', name: '' }) }}>＋</button>
              </span>
            </div>
            <div className="dsh-mt_skillsFolders">
              {personalFolders.map((folder) => (
                <div className="dsh-mt_skillsFolder" key={folder.id}>
                  <div className="dsh-mt_skillsFolderHead">
                    {folderEditor?.kind === 'rename' && folderEditor.folderId === folder.id ? (
                      <div className="dsh-mt_skillsFolderEditor">
                        <input aria-label="文件夹名称" autoFocus value={folderEditor.name} onChange={(event) => setFolderEditor({ ...folderEditor, name: event.currentTarget.value })} onKeyDown={(event) => { if (event.key === 'Enter') saveFolder(); if (event.key === 'Escape') setFolderEditor(null) }} />
                        <button type="button" title="保存名称" aria-label="保存名称" disabled={!folderEditor.name.trim()} onClick={saveFolder}>✓</button>
                        <button type="button" title="取消" aria-label="取消" onClick={() => setFolderEditor(null)}>×</button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="dsh-mt_skillsFolderToggle"
                          title={folder.name}
                          aria-expanded={!collapsedFolders[folder.id]}
                          onClick={() => setCollapsedFolders((current) => ({ ...current, [folder.id]: !current[folder.id] }))}
                        >
                          <span aria-hidden>{collapsedFolders[folder.id] ? '▸' : '▾'}</span>
                          <span className="dsh-mt_skillsFolderName">📁 {folder.name}</span>
                        </button>
                        {folder.id !== UNCATEGORIZED_FOLDER_ID && (
                          <span className="dsh-mt_skillsFolderTools">
                            <button type="button" title="重命名文件夹" aria-label={`重命名文件夹 ${folder.name}`} onClick={() => setFolderEditor({ kind: 'rename', folderId: folder.id, name: folder.name })}>✎</button>
                            <button type="button" title="删除文件夹（技能文件不会删除）" aria-label={`删除文件夹 ${folder.name}`} onClick={() => deleteFolder(folder)}>×</button>
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  {!collapsedFolders[folder.id] && <select
                      className="dsh-mt_skillsSelect"
                      aria-label={`选择“${folder.name}”中的个人技能`}
                      value={selected?.source === '个人技能' && (folderState.assignments[selected.id] || UNCATEGORIZED_FOLDER_ID) === folder.id ? selected.id : ''}
                      disabled={loading || folder.options.length === 0}
                      onChange={(event) => {
                        const entry = skills.find((skill) => skill.id === event.currentTarget.value)
                        if (entry) void openSkill(entry)
                      }}
                    >
                      <option value="">{folder.options.length ? '选择一个技能…' : visiblePersonal.length ? '没有匹配的技能' : '暂无技能'}</option>
                      {folder.options.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}
                    </select>}
                </div>
              ))}
              {folderEditor?.kind === 'create' && (
                <div className="dsh-mt_skillsFolderEditor">
                  <input aria-label="新文件夹名称" placeholder="输入文件夹名称" autoFocus value={folderEditor.name} onChange={(event) => setFolderEditor({ ...folderEditor, name: event.currentTarget.value })} onKeyDown={(event) => { if (event.key === 'Enter') saveFolder(); if (event.key === 'Escape') setFolderEditor(null) }} />
                  <button type="button" title="创建文件夹" aria-label="创建文件夹" disabled={!folderEditor.name.trim()} onClick={saveFolder}>✓</button>
                  <button type="button" title="取消" aria-label="取消" onClick={() => setFolderEditor(null)}>×</button>
                </div>
              )}
            </div>
          </section>
          {projectSkills.length > 0 && (
            <section className="dsh-mt_skillsGroup">
              <div className="dsh-mt_skillsGroupName">项目技能</div>
              {projectSkills.map((skill) => (
                <button
                  type="button"
                  key={skill.id}
                  className="dsh-mt_skillsItem"
                  disabled={loading}
                  data-active={selected?.id === skill.id}
                  title={skill.description || skill.name}
                  onClick={() => void openSkill(skill)}
                >
                  <span className="dsh-mt_skillsItemName">{skill.name}</span>
                  {skill.description && <span className="dsh-mt_skillsItemDesc">{skill.description}</span>}
                </button>
              ))}
            </section>
          )}
          {selected && files.length > 0 && (
            <section className="dsh-mt_skillsGroup dsh-mt_skillsFileGroup">
              <div className="dsh-mt_skillsGroupName">技能文件</div>
              {files.map((file) => (
                <button
                  type="button"
                  key={file.id}
                  className="dsh-mt_skillsFile"
                  disabled={loading}
                  data-active={selectedFile?.id === file.id}
                  title={file.path}
                  onClick={() => void openFile(file)}
                >
                  <span aria-hidden>{file.entry ? '📘' : '📄'}</span>
                  <span>{file.path}</span>
                </button>
              ))}
            </section>
          )}
          {!loading && filtered.length === 0 && (
            <div className="dsh-mt_skillsEmptySmall">{skills.length ? '没有匹配的技能' : '还没有发现本地技能'}</div>
          )}
          </div>
        </>}
      </aside>

      <main className="dsh-mt_skillsMain">
        {selected && selectedFile ? (
          <>
            <header className="dsh-mt_skillsHeader">
              <div className="dsh-mt_skillsTitle">
                <strong>{selected.name}</strong>
              </div>
              <div className="dsh-mt_skillsActions">
                <div className="dsh-mt_skillsModes" role="tablist" aria-label="Markdown 显示方式">
                  <button type="button" role="tab" aria-selected={mode === 'preview'} className={mode === 'preview' ? 'dsh-mt_skillsModeActive' : ''} onClick={() => setMode('preview')}>{T('file.preview')}</button>
                  <button type="button" role="tab" aria-selected={mode === 'edit'} className={mode === 'edit' ? 'dsh-mt_skillsModeActive' : ''} onClick={() => setMode('edit')}>{T('file.edit')}</button>
                </div>
                <span className={dirty ? 'dsh-mt_skillsChanged' : 'dsh-mt_skillsSaved'}>{dirty ? '未保存' : notice || '已保存'}</span>
                <button type="button" className="dsh-mt_skillsSave" onClick={() => void save()} disabled={!dirty || saving || loading}>
                  {saving ? '保存中…' : '保存修改'}
                </button>
              </div>
            </header>
            {selected.description && (
              <div className="dsh-mt_skillsDescriptionMain" title={selected.description}>{selected.description}</div>
            )}
            {mode === 'edit' ? (
              <textarea
                className="dsh-mt_skillsEditor"
                aria-label={'编辑 ' + selected.name + ' / ' + selectedFile.path}
                wrap="soft"
                spellCheck={false}
                value={content}
                onChange={(event) => { setContent(event.currentTarget.value); setNotice('') }}
                disabled={loading}
              />
            ) : (
              <div className="dsh-mt_fileView dsh-mt_skillsPreview">
                <div
                  className={'dsh-mt_md dsh-mt_hl dsh-mt_skillsMarkdown ' + (dark ? 'dsh-mt_hlDark' : 'dsh-mt_hlLight')}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                  onClick={(event: any) => {
                    const anchor = event.target?.closest?.('a') as HTMLAnchorElement | null
                    if (!anchor) return
                    event.preventDefault()
                    const href = anchor.getAttribute('href') || ''
                    if (/^(https?:|mailto:)/i.test(href)) window.open(href, '_blank', 'noopener')
                  }}
                />
              </div>
            )}
          </>
        ) : (
          <div className="dsh-mt_skillsWelcome">
            <span aria-hidden>🧠</span>
            <strong>{loading ? '正在读取技能…' : '管理本地 Skill'}</strong>
            <p>{loading ? '稍等片刻' : '这里会显示个人技能和当前项目中的技能。选中技能后，可查看和编辑它的 Markdown 文件。'}</p>
            {!loading && skills.length === 0 && <button type="button" onClick={() => void refresh(false)}>重新扫描</button>}
          </div>
        )}
        {error && <div className="dsh-mt_skillsMessage" data-error="true">{error}</div>}
      </main>
      {batchOpen && (
        <div
          className="dsh-mt_skillsBatchOverlay"
          style={{ position: 'absolute', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, background: 'rgba(10,15,24,.42)' }}
          onClick={(event) => { if (event.target === event.currentTarget) setBatchOpen(false) }}
        >
          <div
            className="dsh-mt_skillsBatchDialog"
            style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 10, width: 'min(540px, 100%)', maxHeight: 'calc(100% - 24px)', minHeight: 240, padding: 14, border: `1px solid ${dark ? '#414a58' : '#d8dde6'}`, borderRadius: 12, background: dark ? '#1d222a' : '#fff', color: dark ? '#e7eaf0' : '#20242b', boxShadow: '0 16px 48px rgba(0,0,0,.28)' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dsh-mt_skillsBatchTitle"
          >
            <header className="dsh-mt_skillsBatchHeader">
              <div><strong id="dsh-mt_skillsBatchTitle">批量归类个人技能</strong><small>一次勾选多个 Skill，再统一放入文件夹。</small></div>
              <button type="button" aria-label="关闭" title="关闭" onClick={() => setBatchOpen(false)}>×</button>
            </header>
            <div className="dsh-mt_skillsBatchToolbar">
              <span>选择要归类的技能</span>
              <button type="button" onClick={() => setBatchSelectedIds((current) => allVisiblePersonalSelected
                ? current.filter((id) => !visiblePersonal.some((skill) => skill.id === id))
                : [...new Set([...current, ...visiblePersonal.map((skill) => skill.id)])]
              )}>{allVisiblePersonalSelected ? '取消全选' : '全选当前列表'}</button>
            </div>
            <div className="dsh-mt_skillsBatchList">
              {visiblePersonal.map((skill) => {
                const folderName = folderState.folders.find((folder) => folder.id === folderState.assignments[skill.id])?.name || '未分类'
                return <label className="dsh-mt_skillsBatchItem" key={skill.id}>
                  <input type="checkbox" checked={batchSelectedIds.includes(skill.id)} onChange={(event) => {
                    const checked = event.currentTarget.checked
                    setBatchSelectedIds((current) => checked
                      ? [...new Set([...current, skill.id])]
                      : current.filter((id) => id !== skill.id)
                    )
                  }} />
                  <span><strong>{skill.name}</strong><small>{folderName}{skill.description ? ` · ${skill.description}` : ''}</small></span>
                </label>
              })}
              {!visiblePersonal.length && <div className="dsh-mt_skillsBatchEmpty">没有匹配的个人技能</div>}
            </div>
            <div className="dsh-mt_skillsBatchDestination">
              <label>归入文件夹
                <select value={batchTargetFolderId} onChange={(event) => setBatchTargetFolderId(event.currentTarget.value)}>
                  <option value={UNCATEGORIZED_FOLDER_ID}>未分类</option>
                  {folderState.folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => { setBatchCreateFolderOpen((value) => !value); setBatchError('') }}>＋ 新建文件夹</button>
            </div>
            {batchCreateFolderOpen && <div className="dsh-mt_skillsBatchCreate">
              <input aria-label="新文件夹名称" placeholder="输入文件夹名称" autoFocus value={batchNewFolderName} onChange={(event) => setBatchNewFolderName(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === 'Enter') createBatchFolder(); if (event.key === 'Escape') setBatchCreateFolderOpen(false) }} />
              <button type="button" disabled={!batchNewFolderName.trim()} onClick={createBatchFolder}>创建并选为目标</button>
            </div>}
            {batchError && <div className="dsh-mt_skillsBatchError">{batchError}</div>}
            <footer className="dsh-mt_skillsBatchFooter">
              <span>所选技能将统一归类</span>
              <div><button type="button" onClick={() => setBatchOpen(false)}>取消</button><button type="button" className="dsh-mt_skillsBatchApply" disabled={!batchSelectedIds.length} onClick={applyBatchFolder}>移动到文件夹</button></div>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
