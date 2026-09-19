/**
 * 「添加窗口插件 / 添加预览插件」面板（形态对齐 dsh-better-sidebar 的「添加 Tab 插件」）：
 *
 *   说明：<这一组清单可以由插件扩展>，插件通过 ctx.mytable 服务注册；
 *        点「复制」拿到安装命令，粘贴到 DSH 所在环境的终端执行。
 *   在 GitHub 上浏览更多插件（topic: dsh-mytable）
 *   [搜索插件名称 / 描述…]
 *   推荐插件 N
 *     <名称>            [跳转][复制]
 *     <说明>
 *     <安装命令>
 *
 * 目录来自 plugin-catalog.ts（人工收录；为空时给空态说明，不编造条目）。
 * 另外提供「装任意插件」输入框：把包名/git 地址拼成 profile 的安装命令复制走，
 * 所以目录为空时这个面板依然能用。
 */
import { useMemo, useState } from 'react'
import { PLUGIN_TOPIC_URL, RECOMMENDED_PLUGINS, type RecommendedPlugin } from './plugin-catalog'

export type AddPluginKind = 'pane' | 'viewer'

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true }
  } catch { /* 落到 execCommand */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch { return false }
}

export function AddPluginModal(props: {
  kind: AddPluginKind
  /** 生成「装任意插件」的安装命令（由调用方给出当前 profile 名）。 */
  installCommandFor: (spec: string) => string
  t: (key: any, params?: Record<string, string>) => string
  onClose: () => void
}) {
  const { kind, t, onClose } = props
  const [query, setQuery] = useState('')
  const [manual, setManual] = useState('')
  const [copied, setCopied] = useState<string>('')
  const [fail, setFail] = useState<string>('')

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    const all = Array.isArray(RECOMMENDED_PLUGINS) ? RECOMMENDED_PLUGINS : []
    if (!q) return all
    return all.filter((p) => (p.name + ' ' + p.desc).toLowerCase().includes(q))
  }, [query])

  const doCopy = async (id: string, text: string) => {
    const ok = await copyText(text)
    setCopied(ok ? id : '')
    setFail(ok ? '' : t('addplugin.copyFail'))
    if (ok) window.setTimeout(() => setCopied((cur) => (cur === id ? '' : cur)), 2200)
  }

  const manualCmd = manual.trim() ? props.installCommandFor(manual.trim()) : ''

  return (
    <div className="dsh-mt_addOverlay" role="dialog" aria-modal="true" aria-label={kind === 'pane' ? t('settings.addPane') : t('settings.addViewer')}>
      <div className="dsh-mt_addPanel">
        <div className="dsh-mt_addHead">
          <span className="dsh-mt_addTitle">{kind === 'pane' ? t('settings.addPane') : t('settings.addViewer')}</span>
          <button type="button" className="dsh-mt_addClose" aria-label={t('addplugin.close')} title={t('addplugin.close')} onClick={onClose}>✕</button>
        </div>

        <p className="dsh-mt_addIntro">{kind === 'pane' ? t('addplugin.introPane') : t('addplugin.introViewer')}</p>
        <a className="dsh-mt_addTopic" href={PLUGIN_TOPIC_URL} target="_blank" rel="noreferrer noopener">{t('addplugin.topic')}</a>

        <input
          className="dsh-mt_addSearch"
          type="text"
          value={query}
          placeholder={t('addplugin.searchPh')}
          aria-label={t('addplugin.searchPh')}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="dsh-mt_addListHead">
          <span>{t('addplugin.recommended')}</span>
          <span className="dsh-mt_addCount">{list.length}</span>
        </div>

        <div className="dsh-mt_addList">
          {list.length === 0
            ? <p className="dsh-mt_addEmpty">{t('addplugin.empty')}</p>
            : list.map((p: RecommendedPlugin, i: number) => (
              <div className="dsh-mt_addItem" key={p.name + i}>
                <div className="dsh-mt_addItemHead">
                  <span className="dsh-mt_addItemName">{p.name}</span>
                  {p.url
                    ? <a className="dsh-mt_addBtn" href={p.url} target="_blank" rel="noreferrer noopener">{t('addplugin.jump')}</a>
                    : null}
                  <button type="button" className="dsh-mt_addBtn" onClick={() => void doCopy('rec' + i, p.install)}>
                    {copied === 'rec' + i ? t('addplugin.copied') : t('addplugin.copy')}
                  </button>
                </div>
                <p className="dsh-mt_addItemDesc">{p.desc}</p>
                <code className="dsh-mt_addCmd">{p.install}</code>
              </div>
            ))}
        </div>

        <div className="dsh-mt_addManual">
          <div className="dsh-mt_addListHead"><span>{t('addplugin.manualTitle')}</span></div>
          <div className="dsh-mt_addManualRow">
            <input
              className="dsh-mt_addSearch"
              type="text"
              value={manual}
              placeholder={t('addplugin.manualPh')}
              aria-label={t('addplugin.manualPh')}
              onChange={(e) => { setManual(e.target.value); setFail('') }}
            />
            <button
              type="button"
              className="dsh-mt_addBtn dsh-mt_addBtnPrimary"
              disabled={!manualCmd}
              onClick={() => void doCopy('manual', manualCmd)}
            >
              {copied === 'manual' ? t('addplugin.copied') : t('addplugin.manualCopy')}
            </button>
          </div>
          {manualCmd ? <code className="dsh-mt_addCmd">{manualCmd}</code> : null}
          <p className="dsh-mt_addHint">{t('addplugin.apiHint')}</p>
          {fail ? <p className="dsh-mt_addFail">{fail}</p> : null}
        </div>
      </div>
    </div>
  )
}
