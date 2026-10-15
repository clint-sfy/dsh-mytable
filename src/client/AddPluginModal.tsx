import { useEffect, useMemo, useState } from 'react'
import { PLUGIN_TOPIC_URL, RECOMMENDED_PLUGINS, type RecommendedPlugin } from './plugin-catalog'

export type AddPluginKind = 'pane' | 'viewer'
type InstalledPlugin = { name: string; spec: string }
type InstallStatus = '' | 'installing' | 'installed' | 'removing' | 'removed' | 'error'

function recommendedSource(plugin: RecommendedPlugin): string {
  if (plugin.source) return plugin.source
  return plugin.install.match(/\badd\s+["']([^"']+)["']/)?.[1] || plugin.install
}

async function managePlugins(body: Record<string, string>): Promise<any> {
  const response = await fetch('/api/worktable/plugins/manage', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data?.ok === false) throw new Error(String(data?.error || `HTTP ${response.status}`))
  return data
}

export function AddPluginModal(props: {
  kind: AddPluginKind
  t: (key: any, params?: Record<string, string>) => string
  onClose: () => void
}) {
  const { kind, t, onClose } = props
  const [query, setQuery] = useState('')
  const [manual, setManual] = useState('')
  const [installed, setInstalled] = useState<InstalledPlugin[]>([])
  const [installStatus, setInstallStatus] = useState<InstallStatus>('')
  const [message, setMessage] = useState('')
  const [busyName, setBusyName] = useState('')

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    const all = Array.isArray(RECOMMENDED_PLUGINS) ? RECOMMENDED_PLUGINS : []
    return q ? all.filter((p) => (p.name + ' ' + p.desc).toLowerCase().includes(q)) : all
  }, [query])

  const refresh = async () => {
    try {
      const data = await managePlugins({ action: 'list' })
      setInstalled(Array.isArray(data?.plugins) ? data.plugins : [])
    } catch (error) {
      setInstallStatus('error')
      setMessage(error instanceof Error ? error.message : String(error))
    }
  }
  useEffect(() => { void refresh() }, [])

  const install = async (source: string) => {
    const value = source.trim()
    if (!value || installStatus === 'installing') return
    setInstallStatus('installing')
    setMessage(t('addplugin.installing'))
    try {
      const data = await managePlugins({ action: 'install', source: value })
      setInstalled(Array.isArray(data?.plugins) ? data.plugins : [])
      setInstallStatus('installed')
      setMessage(t('addplugin.installed'))
    } catch (error) {
      setInstallStatus('error')
      setMessage(error instanceof Error ? error.message : String(error))
    }
  }

  const remove = async (packageName: string) => {
    if (!packageName || busyName) return
    setBusyName(packageName)
    setInstallStatus('removing')
    setMessage(t('addplugin.removing'))
    try {
      const data = await managePlugins({ action: 'remove', packageName })
      setInstalled(Array.isArray(data?.plugins) ? data.plugins : [])
      setInstallStatus('removed')
      setMessage(t('addplugin.removed'))
    } catch (error) {
      setInstallStatus('error')
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusyName('')
    }
  }

  return (
    <div className="dsh-mt_addOverlay" role="dialog" aria-modal="true" aria-label={kind === 'pane' ? t('settings.addPane') : t('settings.addViewer')}>
      <div className="dsh-mt_addPanel">
        <div className="dsh-mt_addHead">
          <span className="dsh-mt_addTitle">{kind === 'pane' ? t('settings.addPane') : t('settings.addViewer')}</span>
          <button type="button" className="dsh-mt_addClose" aria-label={t('addplugin.close')} title={t('addplugin.close')} onClick={onClose}>✕</button>
        </div>
        <p className="dsh-mt_addIntro">{t('addplugin.installIntro')}</p>
        <a className="dsh-mt_addTopic" href={PLUGIN_TOPIC_URL} target="_blank" rel="noreferrer noopener">{t('addplugin.topic')}</a>

        <input className="dsh-mt_addSearch" type="text" value={query} placeholder={t('addplugin.searchPh')} aria-label={t('addplugin.searchPh')} onChange={(e) => setQuery(e.target.value)} />
        <div className="dsh-mt_addListHead"><span>{t('addplugin.recommended')}</span><span className="dsh-mt_addCount">{list.length}</span></div>
        <div className="dsh-mt_addList">
          {list.length === 0 ? <p className="dsh-mt_addEmpty">{t('addplugin.empty')}</p> : list.map((p: RecommendedPlugin, i: number) => (
            <div className="dsh-mt_addItem" key={p.name + i}>
              <div className="dsh-mt_addItemHead">
                <span className="dsh-mt_addItemName">{p.name}</span>
                {p.url ? <a className="dsh-mt_addBtn" href={p.url} target="_blank" rel="noreferrer noopener">{t('addplugin.jump')}</a> : null}
                <button type="button" className="dsh-mt_addBtn" disabled={installStatus === 'installing'} onClick={() => void install(recommendedSource(p))}>{t('addplugin.install')}</button>
              </div>
              <p className="dsh-mt_addItemDesc">{p.desc}</p>
            </div>
          ))}
        </div>

        <div className="dsh-mt_addManual">
          <div className="dsh-mt_addListHead"><span>{t('addplugin.manualTitle')}</span></div>
          <div className="dsh-mt_addManualRow">
            <input className="dsh-mt_addSearch" type="text" value={manual} placeholder={t('addplugin.manualPh')} aria-label={t('addplugin.manualPh')} onChange={(e) => setManual(e.target.value)} />
            <button type="button" className="dsh-mt_addBtn dsh-mt_addBtnPrimary" disabled={!manual.trim() || installStatus === 'installing'} onClick={() => void install(manual)}>{installStatus === 'installing' ? t('addplugin.installingShort') : t('addplugin.install')}</button>
          </div>
        </div>

        <div className="dsh-mt_addInstalled">
          <div className="dsh-mt_addListHead"><span>{t('addplugin.installedTitle')}</span><span className="dsh-mt_addCount">{installed.length}</span></div>
          {installed.length === 0 ? <p className="dsh-mt_addEmpty">{t('addplugin.noneInstalled')}</p> : installed.map((item) => (
            <div className="dsh-mt_addInstalledRow" key={item.name}>
              <span><strong>{item.name}</strong><small>{item.spec}</small></span>
              <button type="button" className="dsh-mt_addBtn dsh-mt_addRemove" disabled={!!busyName} onClick={() => void remove(item.name)}>{busyName === item.name ? t('addplugin.removingShort') : t('addplugin.remove')}</button>
            </div>
          ))}
        </div>

        {message ? <p className="dsh-mt_addInstallStatus" data-status={installStatus} aria-live="polite">{message}</p> : null}
        <p className="dsh-mt_addHint">{t('addplugin.apiHint')}</p>
      </div>
    </div>
  )
}
