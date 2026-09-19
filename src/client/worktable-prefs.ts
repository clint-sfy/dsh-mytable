/**
 * 工作台偏好（DSH 设置 →「工作台」节读写；工作台各处消费）：
 *   - panes     新建窗口选择器里提供哪些内置类型（browser/anim/explorer/terminal/custom）
 *   - previews  文件预览家族开关（html/md/code/text/image/pdf/audio/video/table/office/binary）
 *
 * 家族判定与家族清单在 `preview-family.ts`（纯逻辑、可单测），这里只负责读写与订阅。
 *
 * 存储：localStorage `dsh.mytable.settings.v1`。缺省全开；字段缺失 / 解析失败按缺省
 * （不因坏值把界面锁死）。模块级订阅让设置页、选择器、已打开的窗口即时同步——不需要重载页面。
 */
import { useEffect, useState } from 'react'
// 注意：`export { X } from './y'` 只做转发，**不会**把 X 带进本模块作用域——
// 本文件自己要用（defaultPrefs/loadPrefs）的符号必须另外 import 一次。
import { PREVIEW_FAMILIES, type PreviewFamily } from './preview-family'

export { PREVIEW_FAMILIES, previewFamilyOf, type PreviewFamily } from './preview-family'

/** localStorage 键（与 dsh.mytable.* 家族一致）。 */
export const PREFS_KEY = 'dsh.mytable.settings.v1'

/** 可选窗口类型（等于「新建窗口」选择器里的项；scm/console 不经选择器，不在此列）。 */
export type PanePrefKey = 'browser' | 'anim' | 'explorer' | 'changes' | 'tasks' | 'prompts' | 'terminal' | 'custom'

export type WorktablePrefs = {
  panes: Record<PanePrefKey, boolean>
  previews: Record<PreviewFamily, boolean>
  /** 插件注册的窗口类型开关（key = descriptor id；缺省视为开启）。 */
  pluginPanes: Record<string, boolean>
  /** 插件注册的文件预览器开关（key = descriptor id；缺省视为开启）。 */
  pluginViewers: Record<string, boolean>
}

/** 卡片渲染 / 遍历顺序（zh 词典之外的唯一来源）。 */
export const PANE_PREF_KEYS: PanePrefKey[] = ['browser', 'anim', 'explorer', 'changes', 'tasks', 'prompts', 'terminal', 'custom']

function allOn<K extends string>(keys: readonly K[]): Record<K, boolean> {
  const out = {} as Record<K, boolean>
  for (const k of keys) out[k] = true
  return out
}

/** 缺省偏好：全部开启（与引入开关前的行为一致）。 */
export function defaultPrefs(): WorktablePrefs {
  return {
    panes: allOn(PANE_PREF_KEYS),
    previews: allOn(PREVIEW_FAMILIES),
    pluginPanes: {},
    pluginViewers: {},
  }
}

/** 只保留布尔值，丢弃坏值（插件 id 是动态的，不能按固定键集校验）。 */
function boolMap(v: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  if (v && typeof v === 'object') {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === 'boolean') out[k] = val
    }
  }
  return out
}

let cache: WorktablePrefs | null = null
const listeners = new Set<() => void>()

/** 读偏好（带缓存；无 localStorage 或值损坏时回退缺省）。 */
export function loadPrefs(): WorktablePrefs {
  if (cache) return cache
  const base = defaultPrefs()
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(PREFS_KEY)
    if (raw) {
      const parsed: any = JSON.parse(raw)
      for (const k of PANE_PREF_KEYS) {
        if (typeof parsed?.panes?.[k] === 'boolean') base.panes[k] = parsed.panes[k]
      }
      for (const k of PREVIEW_FAMILIES) {
        if (typeof parsed?.previews?.[k] === 'boolean') base.previews[k] = parsed.previews[k]
      }
      base.pluginPanes = boolMap(parsed?.pluginPanes)
      base.pluginViewers = boolMap(parsed?.pluginViewers)
    }
  } catch {
    /* 坏值 → 缺省 */
  }
  cache = base
  return base
}

/** 落盘 + 通知（乐观更新：先把新值放进缓存，订阅者读到的一定是新值）。 */
function commit(next: WorktablePrefs): void {
  cache = next
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)) } catch {}
  for (const fn of [...listeners]) {
    try { fn() } catch {}
  }
}

export function setPanePref(key: PanePrefKey, on: boolean): void {
  const cur = loadPrefs()
  commit({ ...cur, panes: { ...cur.panes, [key]: on } })
}

export function setPreviewPref(key: PreviewFamily, on: boolean): void {
  const cur = loadPrefs()
  commit({ ...cur, previews: { ...cur.previews, [key]: on } })
}

/** 插件注册的窗口类型开关（key = descriptor id）。 */
export function setPluginPanePref(id: string, on: boolean): void {
  const cur = loadPrefs()
  commit({ ...cur, pluginPanes: { ...cur.pluginPanes, [id]: on } })
}

/** 插件注册的文件预览器开关（key = descriptor id）。 */
export function setPluginViewerPref(id: string, on: boolean): void {
  const cur = loadPrefs()
  commit({ ...cur, pluginViewers: { ...cur.pluginViewers, [id]: on } })
}

/** 某内置类型是否允许新建（选择器消费）。 */
export function paneEnabled(key: PanePrefKey): boolean {
  return loadPrefs().panes[key] !== false
}

/** 某预览家族是否启用（FileViewer / 资源管理器 / 自动挂载消费）。 */
export function previewEnabled(key: PreviewFamily): boolean {
  return loadPrefs().previews[key] !== false
}

/** 某插件注册的窗口类型是否启用（选择器消费）。 */
export function pluginPaneEnabled(id: string): boolean {
  return loadPrefs().pluginPanes[id] !== false
}

/** 某插件注册的文件预览器是否启用（预览分发消费）。 */
export function pluginViewerEnabled(id: string): boolean {
  return loadPrefs().pluginViewers[id] !== false
}

export function subscribePrefs(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/** React 侧订阅：设置页改一下，所有消费点立即重渲染。 */
export function useWorktablePrefs(): WorktablePrefs {
  const [prefs, setPrefs] = useState<WorktablePrefs>(loadPrefs)
  useEffect(() => subscribePrefs(() => setPrefs(loadPrefs())), [])
  return prefs
}
