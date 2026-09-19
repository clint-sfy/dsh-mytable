/**
 * 资源管理器：better-sidebar 风格的文件树。
 *
 * 写法与样式对齐 DSH-better-sidebar 的 `FileTree.tsx` / `TreePanel.tsx`：
 * - 行是**扁平兄弟**（缩进用内联 `paddingLeft = depth*22+6`，不做嵌套缩进容器），行高 34、圆角 8；
 * - 目录行加粗、隐藏项 `opacity:.45`、悬停/选中态、行尾**悬停才出现**的 `@` 胶囊；
 * - 图标用宿主官方的 `FileTypeIcon`（见 `file-icons.tsx`），本地不带扩展名表；
 * - 右键菜单：打开预览 / 在右侧新窗口打开 / 复制相对路径 / 复制绝对路径 / 引用到对话（@）；
 * - 键盘：↑↓ 移动、→ 展开、← 折叠（已折叠则跳到上一级）、Enter 打开、Esc 关菜单；
 * - 顶部搜索框走宿主 `POST /api/worktable/search`，结果是扁平列表（点结果直接开预览）；
 * - 窗口重新获得焦点时自动刷新（对齐 better-sidebar 的 refresh-on-focus）。
 *
 * 与 better-sidebar 的差异（工作台的分栏模型决定）：文件不在「原生 Tab」里打开，而是
 * `splitStore.openTab(row, index, …)` 开进**当前窗格**；「在右侧新窗口打开」= 先 `splitPaneRight` 再开。
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { splitStore, splitScope, T, type PaneRow, type SplitContent } from './split'
import { FileGlyph, FolderGlyph } from './file-icons'
import { relativeTo, parentPathOf, basenameOf } from './pathutil'
import { extOfPath } from './mytable-service'
import { previewEnabled } from './worktable-prefs'
import { referenceInChat, type ReferenceOutcome } from './reference-in-chat'
import { copyText } from './clipboard'

type Entry = { name: string; path: string; isDir: boolean; hidden?: boolean }
type Level = { entries?: Entry[]; error?: string; loading?: boolean }

/** 二进制/不可预览的扩展名（按文本打开只会是乱码，直接给提示） */
const BINARY_EXT = /^(exe|dll|so|dylib|bin|dat|db|sqlite|zip|gz|tgz|tar|7z|rar|jar|class|o|a|lib|pyc|woff2?|ttf|otf|eot|mp3|mp4|mov|avi|mkv|wav|flac|iso|img|dmg|msi|cab)$/i

async function postJson(url: string, body: unknown): Promise<any> {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return res.json()
}

/** 复制到剪贴板：navigator.clipboard 不可用（非安全上下文 / 无权限）时退化为隐藏 textarea + execCommand */

export function ExplorerPane(props: { row: PaneRow; index: number }) {
  const [levels, setLevels] = useState<Record<string, Level>>({})
  const [expanded, setExpanded] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [focused, setFocused] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; entry: Entry; root?: boolean } | null>(null)
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ entries: Entry[]; truncated?: boolean } | null>(null)
  const [searching, setSearching] = useState(false)
  const [tick, setTick] = useState(0)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const rowRefs = useRef<Map<string, HTMLElement>>(new Map())
  const noticeTimer = useRef<number | null>(null)
  const copiedTimer = useRef<number | null>(null)

  const scope = splitScope()
  const rootCwd = scope?.cwd ?? ''
  const [rootPath, setRootPath] = useState('')
  const root = rootPath || rootCwd

  /** 一次性提示（如「已插入 @x」），2.4 秒后自动消失 */
  const flash = useCallback((text: string) => {
    setNotice(text)
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(''), 2400)
  }, [])

  const loadLevel = useCallback(async (path: string, force = false): Promise<void> => {
    setLevels((prev) => {
      if (!force && prev[path]?.entries) return prev
      return { ...prev, [path]: { ...(prev[path] ?? {}), loading: true } }
    })
    try {
      const d = await postJson('/api/worktable/fs', {
        path,
        sessionId: scope?.sessionId ?? '',
        cwd: scope?.cwd ?? '',
      })
      const entries: Entry[] = Array.isArray(d.entries) ? d.entries : []
      if (path === '' || path === rootCwd) setRootPath(String(d.path ?? ''))
      setLevels((prev) => ({ ...prev, [String(d.path ?? path)]: { entries, error: d.error ? String(d.error) : undefined } }))
    } catch (e) {
      setLevels((prev) => ({ ...prev, [path]: { entries: [], error: String(e) } }))
    }
  }, [rootCwd, scope?.cwd, scope?.sessionId])

  // 首次挂载 / 会话工作目录变化 / 手动刷新 → 回到根目录
  useEffect(() => {
    setLevels({})
    setExpanded([])
    setSelected(null)
    void loadLevel('')
  }, [loadLevel, tick])

  // 窗口重新获得焦点自动刷新（与 better-sidebar 一致；用户切出去改完文件回来能立刻看到）
  useEffect(() => {
    const onFocus = (): void => { setTick((t) => t + 1) }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  useEffect(() => () => {
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current)
    if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current)
  }, [])

  // 搜索：250ms 防抖，输入清空即回到树
  useEffect(() => {
    const q = query.trim()
    if (!q) { setResults(null); setSearching(false); return }
    setSearching(true)
    let cancelled = false
    const timer = window.setTimeout(() => {
      void postJson('/api/worktable/search', { query: q, sessionId: scope?.sessionId ?? '', cwd: scope?.cwd ?? '' })
        .then((d) => { if (!cancelled) setResults({ entries: Array.isArray(d.entries) ? d.entries : [], truncated: d.truncated === true }) })
        .catch(() => { if (!cancelled) setResults({ entries: [] }) })
        .finally(() => { if (!cancelled) setSearching(false) })
    }, 250)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [query, scope?.cwd, scope?.sessionId])

  /** 可见行（扁平）：树展开后的顺序，键盘上下移动就走这个数组 */
  const rows = useMemo(() => {
    const out: Array<{ entry: Entry; depth: number }> = []
    const walk = (dir: string, depth: number): void => {
      const lv = levels[dir]
      if (!lv?.entries) return
      for (const e of lv.entries) {
        out.push({ entry: e, depth })
        if (e.isDir && expanded.includes(e.path)) walk(e.path, depth + 1)
      }
    }
    if (root) walk(root, 0)
    return out
  }, [levels, expanded, root])

  const toggle = useCallback((entry: Entry) => {
    setSelected(entry.path)
    setFocused(entry.path)
    setExpanded((prev) => {
      if (prev.includes(entry.path)) return prev.filter((p) => p !== entry.path)
      void loadLevel(entry.path)
      return [...prev, entry.path]
    })
  }, [loadLevel])

  const openContent = useCallback((content: SplitContent) => {
    splitStore.openTab(props.row, props.index, content)
  }, [props.index, props.row])

  const openEntry = useCallback((entry: Entry) => {
    setSelected(entry.path)
    setFocused(entry.path)
    if (entry.isDir) { toggle(entry); return }
    const ext = extOfPath(entry.path)
    if (BINARY_EXT.test(ext)) { flash(T('exp.binary')); return }
    if (ext === 'html' || ext === 'htm') {
      if (!previewEnabled('html')) {
        // 「设置 → 工作台 → 网页预览」关闭：不走站点托管，退化成本地文件（源码文本）
        openContent({ kind: 'file', path: entry.path })
        return
      }
      // 目录级静态托管：相对引用（./assets/…）在所在目录下解析，页面能完整渲染
      const dir = parentPathOf(entry.path)
      openContent({
        kind: 'iframe',
        url: '/api/worktable/site/' + encodeURIComponent(dir) + '/' + encodeURIComponent(entry.name),
        title: entry.name,
      })
      return
    }
    openContent({ kind: 'file', path: entry.path })
  }, [flash, openContent, toggle])

  /** 在右侧新窗口打开：先分栏，再开进新窗格（新窗格总是被插在当前窗格右边） */
  const openRight = useCallback((entry: Entry) => {
    const countBefore = splitStore.spec?.main?.length ?? 0
    splitStore.splitPaneRight(props.row, props.index)
    const countAfter = splitStore.spec?.main?.length ?? 0
    const targetIndex = countAfter > countBefore ? props.index + 1 : props.index
    splitStore.openTab(props.row, targetIndex, { kind: 'file', path: entry.path })
  }, [props.index, props.row])

  const doReference = useCallback(async (entry: Entry) => {
    const outcome: ReferenceOutcome = referenceInChat(entry.path, entry.isDir, splitScope())
    if (outcome === 'fail') flash(T('exp.refFail'))
    else flash(T(outcome === 'dom' ? 'exp.refDoneCompat' : 'exp.refDone', { path: relativeTo(scope?.cwd ?? '', entry.path) }))
  }, [flash, scope?.cwd])

  const doCopy = useCallback(async (entry: Entry, absolute: boolean) => {
    const text = absolute ? entry.path : relativeTo(scope?.cwd ?? '', entry.path)
    const ok = await copyText(text)
    if (!ok) { flash(T('exp.copyFail')); return }
    setCopied(entry.path)
    if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current)
    copiedTimer.current = window.setTimeout(() => setCopied(null), 1200)
  }, [flash, scope?.cwd])

  /** 键盘导航（↑↓ / →← / Enter / Esc），焦点用 focused 路径跟踪 */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { setMenu(null); return }
    const idx = rows.findIndex((r) => r.entry.path === focused)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (rows.length === 0) return
      const next = e.key === 'ArrowDown'
        ? (idx < 0 ? 0 : Math.min(rows.length - 1, idx + 1))
        : (idx < 0 ? rows.length - 1 : Math.max(0, idx - 1))
      const path = rows[next]!.entry.path
      setFocused(path)
      setSelected(path)
      rowRefs.current.get(path)?.scrollIntoView({ block: 'nearest' })
      return
    }
    if (idx < 0) return
    const row = rows[idx]!
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      if (row.entry.isDir && !expanded.includes(row.entry.path)) toggle(row.entry)
      return
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      if (row.entry.isDir && expanded.includes(row.entry.path)) toggle(row.entry)
      else {
        const parent = parentPathOf(row.entry.path)
        if (parent !== row.entry.path && rows.some((r) => r.entry.path === parent)) {
          setFocused(parent)
          setSelected(parent)
          rowRefs.current.get(parent)?.scrollIntoView({ block: 'nearest' })
        }
      }
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      openEntry(row.entry)
    }
  }

  const menuItems = (): Array<{ key: string; label: string; danger?: boolean; run: () => void } | 'sep'> => {
    if (!menu) return []
    const e = menu.entry
    if (menu.root) {
      return [
        { key: 'copyRel', label: T('exp.copyRel'), run: () => { void doCopy(e, false) } },
        { key: 'copyAbs', label: T('exp.copyAbs'), run: () => { void doCopy(e, true) } },
        'sep',
        { key: 'refDir', label: T('exp.referenceDir'), run: () => { void doReference(e) } },
      ]
    }
    const items: Array<{ key: string; label: string; danger?: boolean; run: () => void } | 'sep'> = []
    if (e.isDir) {
      items.push({ key: 'toggle', label: expanded.includes(e.path) ? T('exp.collapse') : T('exp.expand'), run: () => toggle(e) })
    } else {
      items.push({ key: 'open', label: T('exp.open'), run: () => openEntry(e) })
      items.push({ key: 'openRight', label: T('exp.openRight'), run: () => openRight(e) })
    }
    items.push('sep')
    items.push({ key: 'copyRel', label: T('exp.copyRel'), run: () => { void doCopy(e, false) } })
    items.push({ key: 'copyAbs', label: T('exp.copyAbs'), run: () => { void doCopy(e, true) } })
    items.push('sep')
    items.push({ key: 'reference', label: e.isDir ? T('exp.referenceDir') : T('exp.reference'), run: () => { void doReference(e) } })
    return items
  }

  const rootEntry: Entry = { name: basenameOf(root) || root, path: root, isDir: true }
  const relOf = (p: string): string => relativeTo(scope?.cwd ?? '', p)

  /** 一行的渲染（树与搜索结果共用） */
  const renderRow = (entry: Entry, depth: number, opts: { showPath?: boolean } = {}) => {
    const isOpen = entry.isDir && expanded.includes(entry.path)
    const isFocused = focused === entry.path
    const isSelected = selected === entry.path
    const cls = 'dsh-mt_exRow'
      + (entry.isDir ? ' dsh-mt_exDir' : '')
      + (entry.hidden ? ' dsh-mt_exHidden' : '')
      + (isSelected ? ' dsh-mt_exOn' : '')
      + (isFocused ? ' dsh-mt_exFocus' : '')
      + (copied === entry.path ? ' dsh-mt_exCopied' : '')
    return (
      <div
        key={entry.path}
        ref={(el) => { if (el) rowRefs.current.set(entry.path, el); else rowRefs.current.delete(entry.path) }}
        role="button"
        tabIndex={-1}
        className={cls}
        style={{ paddingLeft: depth * 22 + 6 }}
        data-ex-path={entry.path}
        data-ex-dir={entry.isDir ? '1' : '0'}
        title={entry.path}
        onClick={() => { setSelected(entry.path); setFocused(entry.path); if (entry.isDir) toggle(entry); else openEntry(entry) }}
        onDoubleClick={() => { if (!entry.isDir) openEntry(entry) }}
        onContextMenu={(ev) => { ev.preventDefault(); setSelected(entry.path); setMenu({ x: ev.clientX, y: ev.clientY, entry }) }}
      >
        <span className="dsh-mt_exIcon" aria-hidden>
          {entry.isDir ? <FolderGlyph open={isOpen} /> : <FileGlyph path={entry.path} />}
        </span>
        <span className="dsh-mt_exName">{entry.name}</span>
        {opts.showPath === true && <span className="dsh-mt_exPath">{relOf(parentPathOf(entry.path))}</span>}
        {copied === entry.path && <span className="dsh-mt_exCopiedTag">{T('exp.copied')}</span>}
        <button
          type="button"
          className="dsh-mt_exRef"
          data-ex-ref="1"
          title={T('exp.reference')}
          aria-label={T('exp.reference')}
          onClick={(ev) => { ev.stopPropagation(); setSelected(entry.path); void doReference(entry) }}
        >@</button>
      </div>
    )
  }

  return (
    <div className="dsh-mt_exp">
      <div className="dsh-mt_exBar">
        <button
          type="button"
          className="dsh-mt_iconBtn dsh-mt_exBtn"
          data-ex-action="up"
          title={T('exp.up')}
          aria-label={T('exp.up')}
          disabled={!root || parentPathOf(root) === root}
          onClick={() => {
            const parent = parentPathOf(root)
            if (!root || parent === root) return
            setLevels({}); setExpanded([]); setSelected(null)
            void postJson('/api/worktable/fs', { path: parent, sessionId: scope?.sessionId ?? '', cwd: scope?.cwd ?? '' })
              .then((d) => { setRootPath(String(d.path ?? parent)); setLevels({ [String(d.path ?? parent)]: { entries: Array.isArray(d.entries) ? d.entries : [] } }) })
              .catch((err) => setLevels((prev) => ({ ...prev, [parent]: { entries: [], error: String(err) } })))
          }}
        >↑</button>
        <button
          type="button"
          className="dsh-mt_iconBtn dsh-mt_exBtn"
          data-ex-action="refresh"
          title={T('exp.refresh')}
          aria-label={T('exp.refresh')}
          onClick={() => setTick((t) => t + 1)}
        >⟳</button>
        <span className="dsh-mt_exRoot" title={root}>{root ? relOf(root) : '…'}</span>
        <button
          type="button"
          className="dsh-mt_exRootRef"
          data-ex-root-ref="1"
          title={T('exp.referenceDir')}
          onClick={() => { void doReference(rootEntry) }}
        >@</button>
      </div>
      <div className="dsh-mt_exSearchWrap">
        <input
          className="dsh-mt_exSearch"
          data-ex-search="1"
          value={query}
          placeholder={T('exp.searchPh')}
          spellCheck={false}
          onChange={(ev) => setQuery(ev.target.value)}
          onKeyDown={(ev) => { if (ev.key === 'Escape') setQuery('') }}
        />
        {query.trim() !== '' && (
          <span className="dsh-mt_exSearchHint" data-ex-search-hint="1">
            {searching ? T('exp.searching') : T('exp.hits', { n: String(results?.entries.length ?? 0) })}
            {results?.truncated === true ? ' · ' + T('exp.truncated') : ''}
          </span>
        )}
      </div>
      {notice !== '' && <div className="dsh-mt_exNotice" data-ex-notice="1">{notice}</div>}
      {results !== null ? (
        <div className="dsh-mt_exBody" data-ex-results="1" ref={bodyRef}>
          {results.entries.length === 0 && !searching && <div className="dsh-mt_exEmpty">{T('exp.searchNone')}</div>}
          {results.entries.map((e) => renderRow(e, 0, { showPath: true }))}
        </div>
      ) : (
        <div className="dsh-mt_exBody" data-ex-tree="1" tabIndex={0} ref={bodyRef} onKeyDown={onKeyDown}>
          {levels[root]?.loading === true && <div className="dsh-mt_exEmpty">{T('file.loading')}</div>}
          {levels[root]?.error !== undefined && levels[root]?.error !== '' && (
            <div className="dsh-mt_exEmpty">
              {levels[root]!.error}
              <button type="button" className="dsh-mt_exRetry" onClick={() => setTick((t) => t + 1)}>{T('exp.retry')}</button>
            </div>
          )}
          {levels[root]?.entries !== undefined && levels[root]!.entries!.length === 0 && <div className="dsh-mt_exEmpty">—</div>}
          <div
            role="button"
            tabIndex={-1}
            className={'dsh-mt_exRow dsh-mt_exDir dsh-mt_exRootRow' + (selected === root ? ' dsh-mt_exOn' : '')}
            style={{ paddingLeft: 6 }}
            data-ex-path={root}
            data-ex-root-row="1"
            title={root}
            onClick={() => { setSelected(root); setFocused(root); setExpanded([]) }}
            onContextMenu={(ev) => { ev.preventDefault(); setSelected(root); setMenu({ x: ev.clientX, y: ev.clientY, entry: rootEntry, root: true }) }}
          >
            <span className="dsh-mt_exIcon" aria-hidden><FolderGlyph open={expanded.length > 0} /></span>
            <span className="dsh-mt_exName">{rootEntry.name}</span>
            <button
              type="button"
              className="dsh-mt_exRef"
              data-ex-ref="1"
              title={T('exp.referenceDir')}
              aria-label={T('exp.referenceDir')}
              onClick={(ev) => { ev.stopPropagation(); void doReference(rootEntry) }}
            >@</button>
          </div>
          {rows.map((r) => renderRow(r.entry, r.depth + 1))}
        </div>
      )}
      {menu !== null && (
        <>
          <div className="dsh-mt_exMenuBackdrop" onClick={() => setMenu(null)} onContextMenu={(ev) => { ev.preventDefault(); setMenu(null) }} />
          <div className="dsh-mt_menu dsh-mt_exMenu" data-ex-menu="1" style={{ left: menu.x, top: menu.y }}>
            <div className="dsh-mt_menuLabel">{menu.entry.name}</div>
            {menuItems().map((item, i) => item === 'sep'
              ? <div className="dsh-mt_menuSep" key={'sep' + i} />
              : (
                <button
                  key={item.key}
                  type="button"
                  className="dsh-mt_menuItem"
                  data-ex-menu-item={item.key}
                  onClick={() => { setMenu(null); item.run() }}
                >{item.label}</button>
              ))}
          </div>
        </>
      )}
    </div>
  )
}
