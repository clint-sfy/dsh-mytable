/**
 * 浏览器窗：地址栏（后退 / 前进 / 刷新 / 前往 / 在浏览器中打开）+ 沙箱 iframe。
 *
 * 写法与安全模型参照 DSH-better-sidebar 的 client/BrowserView.tsx：
 * - **能嵌就嵌，不能嵌就说清楚**：每次导航先让宿主代取目标响应头（/api/worktable/browser/probe），
 *   命中 X-Frame-Options / frame-ancestors 时不再给用户一个空白 iframe，而是给出原因 +
 *   「在浏览器中打开」/「仍然加载」两个出口。
 * - **沙箱是硬边界**：iframe 一律带 sandbox（不含 allow-same-origin、不含 allow-top-navigation），
 *   只有本机地址额外拿 allow-same-origin（本地开发服务器需要真实源），界面自身的源永远不透明。
 *   想临时放开时给一个「临时解锁」（只影响本窗口，切走即失效）并全程挂红色告警条。
 * - 地址栏只放行 http(s) 并做归一化（裸域名补协议、本机地址补 http），拒绝项给出明确文案。
 * - 地址写回标签内容（切标签 / 重开布局都保持当前页面）；后退前进栈只记地址栏导航
 *   （iframe 内的跨源点击对宿主不可见，这是已知限制，与 better-sidebar 一致）。
 */
import { useEffect, useState } from 'react'
import { splitStore, T, type PaneRow, type SplitContent } from './split'
import { embeddabilityOf, iframeSandboxFor, normalizeBrowserUrl, type BrowserProbeResult } from '../browser-policy'
import { IconChevronLeft, IconChevronRight, IconExternal, IconGo, IconRefresh, IconWarning } from './browser-icons'

type BrowserPaneProps = { row: PaneRow; index: number; tabId: string; content: SplitContent; reloadKey: number }

/** 宿主代取目标站点响应头（探测失败一律按「不可达」处理，客户端保持普通 iframe）。 */
async function probeUrl(url: string): Promise<BrowserProbeResult> {
  try {
    const r = await fetch('/api/worktable/browser/probe?url=' + encodeURIComponent(url))
    const d = await r.json()
    return d && typeof d === 'object' ? (d as BrowserProbeResult) : { reachable: false }
  } catch {
    return { reachable: false }
  }
}

export function BrowserPane(props: BrowserPaneProps) {
  const initial = props.content?.kind === 'builtin' ? props.content.url : undefined
  const [url, setUrl] = useState<string | undefined>(initial)
  const [input, setInput] = useState<string>(initial ?? '')
  const [message, setMessage] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>(initial !== undefined ? [initial] : [])
  const [cursor, setCursor] = useState<number>(initial !== undefined ? 0 : -1)
  /** 本窗刷新（标签栏的 ↻ 走 props.reloadKey，两条都通过 key 重挂 iframe） */
  const [localKey, setLocalKey] = useState(0)
  /** 本窗临时解锁沙箱（只影响这个窗口，切走/重挂即恢复；绝不写全局设置） */
  const [localUnlock, setLocalUnlock] = useState(false)
  /** 目标站点拒绝被嵌入（X-Frame-Options / frame-ancestors）→ 用说明面板替代空白 iframe */
  const [embedBlocked, setEmbedBlocked] = useState<string | null>(null)
  /** 用户选择「仍然加载」：保留普通 iframe，不再劝 */
  const [forceEmbed, setForceEmbed] = useState(false)

  const frameKey = `${props.reloadKey}:${localKey}:${localUnlock ? 'ns' : 'sb'}`

  // 每次地址变化都探一次：被拒绝嵌入时给原因和出口，探不到就保持普通 iframe
  useEffect(() => {
    if (url === undefined) return
    let cancelled = false
    setEmbedBlocked(null)
    setForceEmbed(false)
    void probeUrl(url).then((probe) => {
      if (!cancelled && embeddabilityOf(probe) === 'blocked') setEmbedBlocked(url)
    })
    return () => { cancelled = true }
  }, [url])

  const persist = (nextUrl: string) => {
    splitStore.setTabContent(props.row, props.index, props.tabId, { kind: 'builtin', type: 'browser', url: nextUrl })
  }

  const navigateTo = (raw: string) => {
    const result = normalizeBrowserUrl(raw, window.location.origin)
    if (result.kind === 'ok') {
      setUrl(result.url)
      setInput(result.url)
      setMessage(null)
      setHistory((prev) => [...prev.slice(0, cursor + 1), result.url])
      setCursor((prev) => prev + 1)
      setLocalKey((k) => k + 1)
      persist(result.url)
      return
    }
    setMessage(result.kind === 'invalid' ? T('browser.invalid') : T('browser.blockedScheme'))
  }

  const jumpTo = (index: number) => {
    const next = history[index]
    if (next === undefined) return
    setCursor(index)
    setUrl(next)
    setInput(next)
    setLocalKey((k) => k + 1)
    persist(next)
  }

  const sandbox = url === undefined || localUnlock
    ? undefined
    : iframeSandboxFor(url, window.location.origin)

  // 折叠态：只留整页——地址栏 / 提示行 / 沙箱状态条一律不渲染。
  // 唯一例外：沙箱被本窗临时解锁时保留一条红色告警（危险状态不该因为折叠就看不见）。
  const collapsed = props.collapsed === true
  const body = url === undefined ? (
    <div className="dsh-mt_browserStart" data-browser-state="start" />
  ) : embedBlocked !== null && !forceEmbed ? (
    <BrowserEmbedBlocked
      url={embedBlocked}
      onOpenInBrowser={() => window.open(embedBlocked, '_blank', 'noopener')}
      onLoadAnyway={() => setForceEmbed(true)}
    />
  ) : (
    <iframe
      key={frameKey}
      className="dsh-mt_browserFrame"
      data-browser-frame="1"
      src={url}
      sandbox={sandbox}
      referrerPolicy="no-referrer"
      allow=""
      title={url}
    />
  )
  if (collapsed) {
    return (
      <div className="dsh-mt_browser" data-browser-mode="collapsed">
        {url !== undefined && sandbox === undefined && (
          <div className="dsh-mt_sandboxBar dsh-mt_sandboxBarOff" data-browser-sandbox="off">
            <span className="dsh-mt_sandboxDot" aria-hidden />
            <span className="dsh-mt_sandboxText">{T('browser.sandboxOff')}</span>
            <button type="button" className="dsh-mt_sandboxBtn" data-browser-action="restore" onClick={() => setLocalUnlock(false)}>
              {T('browser.sandboxRestore')}
            </button>
          </div>
        )}
        {body}
      </div>
    )
  }
  return (
    <div className="dsh-mt_browser" data-browser-mode="full">
      <div className="dsh-mt_browserBar">
        <button
          type="button"
          className="dsh-mt_iconBtn"
          data-browser-action="back"
          title={T('browser.back')}
          aria-label={T('browser.back')}
          disabled={cursor <= 0}
          onClick={() => jumpTo(cursor - 1)}
        ><IconChevronLeft /></button>
        <button
          type="button"
          className="dsh-mt_iconBtn"
          data-browser-action="forward"
          title={T('browser.forward')}
          aria-label={T('browser.forward')}
          disabled={cursor >= history.length - 1}
          onClick={() => jumpTo(cursor + 1)}
        ><IconChevronRight /></button>
        <button
          type="button"
          className="dsh-mt_iconBtn"
          data-browser-action="reload"
          title={T('pane.refresh')}
          aria-label={T('pane.refresh')}
          disabled={url === undefined}
          onClick={() => setLocalKey((k) => k + 1)}
        ><IconRefresh /></button>
        <input
          className="dsh-mt_browserInput"
          data-browser-input="url"
          value={input}
          placeholder={T('browser.placeholder')}
          spellCheck={false}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') navigateTo(input) }}
        />
        <button
          type="button"
          className="dsh-mt_iconBtn"
          data-browser-action="go"
          title={T('browser.go')}
          aria-label={T('browser.go')}
          onClick={() => navigateTo(input)}
        ><IconGo /></button>
        <button
          type="button"
          className="dsh-mt_iconBtn"
          data-browser-action="external"
          title={T('browser.openExternal')}
          aria-label={T('browser.openExternal')}
          disabled={url === undefined}
          onClick={() => { if (url !== undefined) window.open(url, '_blank', 'noopener') }}
        ><IconExternal /></button>
      </div>
      {message !== null && <div className="dsh-mt_browserMessage" data-browser-message="1">{message}</div>}
      <div
        className={'dsh-mt_sandboxBar' + (sandbox === undefined && url !== undefined ? ' dsh-mt_sandboxBarOff' : '')}
        data-browser-sandbox={url === undefined ? 'idle' : (sandbox === undefined ? 'off' : 'on')}
      >
        <span className="dsh-mt_sandboxDot" aria-hidden />
        <span className="dsh-mt_sandboxText">
          {url === undefined
            ? T('browser.start')
            : (sandbox === undefined ? T('browser.sandboxOff') : T('browser.sandboxOn'))}
        </span>
        {url !== undefined && sandbox !== undefined && (
          <button type="button" className="dsh-mt_sandboxBtn" data-browser-action="unlock" onClick={() => setLocalUnlock(true)}>
            {T('browser.sandboxUnlock')}
          </button>
        )}
        {url !== undefined && sandbox === undefined && (
          <button type="button" className="dsh-mt_sandboxBtn" data-browser-action="restore" onClick={() => setLocalUnlock(false)}>
            {T('browser.sandboxRestore')}
          </button>
        )}
      </div>
      {body}
    </div>
  )
}

/**
 * 拒绝嵌入的说明面板：探到站点用 X-Frame-Options / frame-ancestors 禁止被其它页面显示时，
 * 用它替代浏览器那句语焉不详的「拒绝连接」。导出以便文案与动作可单独测。
 */
export function BrowserEmbedBlocked(props: { url: string; onOpenInBrowser: () => void; onLoadAnyway: () => void }) {
  const { url, onOpenInBrowser, onLoadAnyway } = props
  let host = url
  try { host = new URL(url).hostname } catch { /* 解析不了就用原串 */ }
  return (
    <div className="dsh-mt_browserBlocked" data-browser-state="blocked">
      <IconWarning />
      <div className="dsh-mt_browserBlockedTitle">{T('browser.embedBlocked', { host })}</div>
      <div className="dsh-mt_browserBlockedDesc">{T('browser.embedBlockedDesc')}</div>
      <div className="dsh-mt_browserBlockedActions">
        <button type="button" className="dsh-mt_browserBlockedBtn" data-browser-action="open-external" onClick={onOpenInBrowser}>
          {T('browser.openExternal')}
        </button>
        <button type="button" className="dsh-mt_browserBlockedBtn" data-browser-action="load-anyway" onClick={onLoadAnyway}>
          {T('browser.embedAnyway')}
        </button>
      </div>
    </div>
  )
}
