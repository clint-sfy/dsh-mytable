/**
 * DSH 设置 →「工作台」节：管理工作台的显示内容与默认行为。
 *
 * 版式（参照 dsh-better-sidebar 的「侧边卡片」设置页）：每个分组各自成框、**框内卡片一排两个**，
 * 组末尾是「添加…插件＋」磁贴（点开说明 + 推荐目录 + 复制安装命令）；每张卡 = 图标 + 名称 + 开关，
 * 说明文字折在卡片内第二行。
 *
 * 清单来源：
 *   - 窗口类型：内置 5 种（新建窗口选择器里的）+ 其它插件经 ctx.mytable.registerPaneType 注册的
 *   - 文件预览：内置 6 个家族 + 其它插件经 ctx.mytable.registerFileViewer 注册的
 *   插件注册项实时出现/消失（注册表可订阅），开关状态存 dsh.mytable.settings.v1。
 *
 * 开关语义：
 *   - 窗口类型：关掉后不再出现在「新建窗口」选择器里（已打开的窗口保留，不销毁、不改动）
 *   - 文件预览：内置家族关掉后按族退化（文本类→纯文本，二进制类→提示）；
 *     插件预览器关掉后不参与匹配，自动回落内置分流
 *
 * 宿主契约：settings.section（list 槽），注册项 id/order/label 由本插件给；宿主只传 { close }。
 * 文案通过 props.t → 插件绑定的命名空间 t → zh 词典三级回退。
 */
import { useState } from 'react'
import { zh, type WorktableKey } from './locales'
import {
  PANE_PREF_KEYS,
  PREVIEW_FAMILIES,
  setPanePref,
  setPluginPanePref,
  setPluginViewerPref,
  setPreviewPref,
  useWorktablePrefs,
  type PanePrefKey,
  type PreviewFamily,
} from './worktable-prefs'
import { textOf, useMyTableRegistry } from './mytable-service'
import { AddPluginModal, type AddPluginKind } from './AddPluginModal'

/** 座席 t 解析顺序：宿主给的 props.t → 插件在 apply 时绑定的命名空间 t（ctx.locale.bind(NS)）
 *  → zh 词典兜底。三者都不可用时至少显示键名，绝不抛错（设置页不能因为文案崩掉）。 */
let boundT: ((key: any, params?: Record<string, string>) => string) | null = null

/** 由插件 apply 注入 ctx.locale.bind('worktable') 的稳定翻译函数（重复绑定返回同一引用）。 */
export function setSettingsT(fn: ((key: any, params?: Record<string, string>) => string) | null): void {
  boundT = fn
}

function slotT(props: any): (key: WorktableKey, params?: Record<string, string>) => string {
  return (key, params) => {
    if (typeof props?.t === 'function') {
      try { return props.t(key, params) } catch { /* 落到下一个来源 */ }
    }
    if (boundT) {
      try { return boundT(key, params) } catch { /* 落到 zh */ }
    }
    let s: string = zh[key] ?? key
    if (params) for (const [k, v] of Object.entries(params)) s = s.replace('{' + k + '}', v)
    return s
  }
}

/** 供槽注册项 label 使用的节名（与节内文案同一套解析）。 */
export function settingsSectionLabel(): string {
  if (boundT) {
    try { return boundT('settings.nav') } catch { /* 落到 zh */ }
  }
  return zh['settings.nav']
}

/** 本包版本（构建期注入；设置节底部显示，一眼看出跑的是哪一版）。 */
declare const __WT_VERSION__: string
const LOCAL_VERSION = typeof __WT_VERSION__ === 'undefined' ? 'dev' : __WT_VERSION__

const PANE_ICONS: Record<PanePrefKey, string> = {
  browser: '🌐',
  anim: '🎬',
  explorer: '📁',
  changes: '±',
  tasks: '🗂',
  prompts: '📝',
  terminal: '▸_',
  custom: '✨',
}
const PANE_NAME_KEYS: Record<PanePrefKey, WorktableKey> = {
  browser: 'pane.browser',
  anim: 'pane.anim',
  explorer: 'pane.explorer',
  changes: 'pane.changes',
  tasks: 'pane.tasks',
  prompts: 'pane.prompts',
  terminal: 'pane.terminal',
  custom: 'pane.custom',
}
const PANE_DESC_KEYS: Record<PanePrefKey, WorktableKey> = {
  browser: 'settings.pane.browser',
  anim: 'settings.pane.anim',
  explorer: 'settings.pane.explorer',
  changes: 'settings.pane.changes',
  tasks: 'settings.pane.tasks',
  prompts: 'settings.pane.prompts',
  terminal: 'settings.pane.terminal',
  custom: 'settings.pane.custom',
}

const PREVIEW_ICONS: Record<PreviewFamily, string> = {
  html: '🧩',
  md: '📝',
  code: '⌨️',
  text: '📄',
  image: '🖼️',
  pdf: '📕',
  audio: '🎵',
  video: '🎬',
  table: '📊',
  office: '📚',
  binary: '📦',
}
const PREVIEW_NAME_KEYS: Record<PreviewFamily, WorktableKey> = {
  html: 'settings.previewName.html',
  md: 'settings.previewName.md',
  code: 'settings.previewName.code',
  text: 'settings.previewName.text',
  image: 'settings.previewName.image',
  pdf: 'settings.previewName.pdf',
  audio: 'settings.previewName.audio',
  video: 'settings.previewName.video',
  table: 'settings.previewName.table',
  office: 'settings.previewName.office',
  binary: 'settings.previewName.binary',
}
const PREVIEW_DESC_KEYS: Record<PreviewFamily, WorktableKey> = {
  html: 'settings.preview.html',
  md: 'settings.preview.md',
  code: 'settings.preview.code',
  text: 'settings.preview.text',
  image: 'settings.preview.image',
  pdf: 'settings.preview.pdf',
  audio: 'settings.preview.audio',
  video: 'settings.preview.video',
  table: 'settings.preview.table',
  office: 'settings.preview.office',
  binary: 'settings.preview.binary',
}

/** 一行卡片：图标 + 名称 + 开关（首行），说明折在第二行。 */
function PrefCard(props: {
  icon: string
  name: string
  desc: string
  on: boolean
  /** 插件注册项：卡上带 data-plugin-id，便于区分来源与自动化验收 */
  pluginId?: string
  onToggle: (next: boolean) => void
}) {
  return (
    <div className="dsh-mt_setCard" data-off={!props.on} data-plugin-id={props.pluginId}>
      <span className="dsh-mt_setIcon" aria-hidden>{props.icon}</span>
      <span className="dsh-mt_setName">{props.name}</span>
      <button
        type="button"
        role="switch"
        aria-checked={props.on}
        aria-label={props.name}
        className="dsh-mt_setSwitch"
        data-off={!props.on}
        onClick={() => props.onToggle(!props.on)}
      />
      {props.desc ? <span className="dsh-mt_setDesc">{props.desc}</span> : null}
    </div>
  )
}

/** 「工作台」设置节（注册进 settings.section 槽）。
 *  版式：每个分组各自成框、框内卡片**一排两个**，组末尾是「添加…插件＋」磁贴（点开说明与安装命令）。 */
export function WorktableSettingsSection(props: any) {
  const t = slotT(props)
  const prefs = useWorktablePrefs()
  const registry = useMyTableRegistry()
  const [adding, setAdding] = useState<AddPluginKind | null>(null)

  /** 安装命令用哪个 profile：默认 mytable（本包的独立 profile 名）。 */
  const installCommandFor = (spec: string) => 'cd ~/.dsh && dsh plugin --profile mytable add "' + spec + '"'

  return (
    <div className="dsh-mt_set">
      <p className="dsh-mt_setIntro">{t('settings.intro')}</p>

      <section className="dsh-mt_setGroup">
        <div className="dsh-mt_setGroupHead">
          <span className="dsh-mt_setGroupTitle">{t('settings.panesTitle')}</span>
          <span className="dsh-mt_setGroupHint">{t('settings.panesHint')}</span>
        </div>
        <div className="dsh-mt_setGrid">
          {PANE_PREF_KEYS.map((k) => (
            <PrefCard
              key={k}
              icon={PANE_ICONS[k]}
              name={t(PANE_NAME_KEYS[k])}
              desc={t(PANE_DESC_KEYS[k])}
              on={prefs.panes[k] !== false}
              onToggle={(next) => setPanePref(k, next)}
            />
          ))}
          {registry.panes.map((d) => (
            <PrefCard
              key={d.id}
              icon={textOf(d.icon, '🧩')}
              name={textOf(d.title, d.id)}
              desc={textOf(d.description, t('settings.pluginSource'))}
              on={prefs.pluginPanes[d.id] !== false}
              pluginId={d.id}
              onToggle={(next) => setPluginPanePref(d.id, next)}
            />
          ))}
          <button type="button" className="dsh-mt_setAdd" data-add-kind="pane" onClick={() => setAdding('pane')}>
            <span aria-hidden>＋</span>{t('settings.addPane')}
          </button>
        </div>
      </section>

      <section className="dsh-mt_setGroup">
        <div className="dsh-mt_setGroupHead">
          <span className="dsh-mt_setGroupTitle">{t('settings.previewsTitle')}</span>
          <span className="dsh-mt_setGroupHint">{t('settings.previewsHint')}</span>
        </div>
        <div className="dsh-mt_setGrid">
          {PREVIEW_FAMILIES.map((k) => (
            <PrefCard
              key={k}
              icon={PREVIEW_ICONS[k]}
              name={t(PREVIEW_NAME_KEYS[k])}
              desc={t(PREVIEW_DESC_KEYS[k])}
              on={prefs.previews[k] !== false}
              onToggle={(next) => setPreviewPref(k, next)}
            />
          ))}
          {registry.viewers.map((d) => (
            <PrefCard
              key={d.id}
              icon={textOf(d.icon, '🧩')}
              name={textOf(d.title, d.id)}
              desc={textOf(d.description, d.exts.length > 0
                ? d.exts.map((e) => '.' + String(e).replace(/^\./, '')).join(' · ')
                : t('settings.viewerAny'))}
              on={prefs.pluginViewers[d.id] !== false}
              pluginId={d.id}
              onToggle={(next) => setPluginViewerPref(d.id, next)}
            />
          ))}
          <button type="button" className="dsh-mt_setAdd" data-add-kind="viewer" onClick={() => setAdding('viewer')}>
            <span aria-hidden>＋</span>{t('settings.addViewer')}
          </button>
        </div>
      </section>

      <p className="dsh-mt_setFoot">
        {t('settings.foot', {
          version: LOCAL_VERSION,
          panes: String(registry.panes.length),
          viewers: String(registry.viewers.length),
        })}
      </p>

      {adding ? (
        <AddPluginModal
          kind={adding}
          t={t}
          installCommandFor={installCommandFor}
          onClose={() => setAdding(null)}
        />
      ) : null}
    </div>
  )
}
