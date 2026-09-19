/**
 * 工作台对外开放的注册表 + 客户端服务（`ctx.mytable`）。
 *
 * 其它 DSH 插件用它贡献两类东西：
 *   - 窗口类型（registerPaneType）：出现在「新建窗口」选择器里，可挂 iframe 或自定义渲染
 *   - 文件预览器（registerFileViewer）：按扩展名接管文件预览，可自定义渲染
 * 两者都会自动出现在「设置 → 工作台」的两组清单里（带开关，可随时禁用；禁用即从入口消失、
 * 预览回落到内置行为）。
 *
 * 设计与 dsh-better-sidebar 的 `ctx.betterSidebar` 对齐：
 *   - `register*(descriptor)` 返回 **disposer**；cordis 会在插件 fiber 销毁时自动调用（HMR 安全）
 *   - 注册表是「同步快照 + 监听者集合」，React 侧用 useMyTableRegistry() 订阅，不会撕裂
 *   - descriptor 里所有文案字段都接受 `string | () => string`（i18n 友好），渲染时取值
 *
 * 消费方写法（宿主客户端插件）：
 *   export const inject = ['mytable']
 *   export function apply(ctx) {
 *     ctx.effect(() => ctx.mytable.registerPaneType({ id: 'demo.map', title: '地图', icon: '🗺️',
 *       url: (s) => '/my-plugin/map?cwd=' + encodeURIComponent(s.cwd) }))
 *   }
 */
import { useEffect, useState, type ReactNode } from 'react'

/** 挂载/渲染函数的返回值：React 节点，或一个现成的 DOM 节点（不想引 React 的插件可直接建 div）。 */
export type MountResult = ReactNode | HTMLElement | DocumentFragment

/** 挂载上下文：注册类型渲染时可用的会话信息。 */
export type PaneMountContext = { sessionId: string; cwd: string }

/** 窗口类型自定义渲染的 props。 */
export type PaneMountProps = PaneMountContext & {
  /** 窗格里的标签 id（同一类型可开多个标签时用于区分）。 */
  tabId: string
  /** 标签标题（已解析好的字符串）。 */
  title: string
  /** 请求重挂载的计数（标签栏 ↻ 按钮会自增）。 */
  reloadKey: number
}

/** 文件预览自定义渲染的 props。 */
export type ViewerMountProps = {
  /** 文件绝对路径。 */
  path: string
  /** 文件名（路径最后一段）。 */
  fileName: string
  /** 插件自己的读文件路由（`/api/worktable/file?path=…`），直接用即可。 */
  fileUrl: string
}

/** 一个窗口类型的声明。 */
export type PaneDescriptor = {
  /** 唯一 id，建议带插件前缀（如 `travelatlas.map`）；与内置类型重名会被拒绝。 */
  id: string
  /** 名称：出现在选择器按钮与设置卡片上。 */
  title: string | (() => string)
  /** 设置卡片里的一句说明（可选）。 */
  description?: string | (() => string)
  /** 文本图标（emoji/字符，与内置类型一致；可选）。 */
  icon?: string | (() => string)
  /** 排序权重，小的在前（缺省 1000，内置项用 10..60）。 */
  order?: number
  /** true = 不出现在选择器里（仅供其它入口直接打开）。 */
  hidden?: boolean
  /** 简化挂载：给一个 URL，工作台用 iframe 承载它。 */
  url?: (scope: PaneMountContext) => string
  /** 进阶挂载：自己渲染内容（给了 mount 就优先用它，url 作为刷新键的可选来源）。
   *  可返回 React 节点，也可直接返回一个 DOM 节点（HTMLElement / DocumentFragment）。 */
  mount?: (props: PaneMountProps) => MountResult
}

/** 一个文件预览器的声明。 */
export type ViewerDescriptor = {
  /** 唯一 id，建议带插件前缀；与内置预览家族重名会被拒绝。 */
  id: string
  /** 名称：出现在设置卡片上（缺省用 id）。 */
  title?: string | (() => string)
  /** 设置卡片里的一句说明（可选，缺省由扩展名列表生成）。 */
  description?: string | (() => string)
  /** 文本图标（可选）。 */
  icon?: string | (() => string)
  /** 接管的扩展名（带不带点都行）；空数组 = 兜底接管所有未命中文件。 */
  exts: readonly string[]
  /** 命中优先级，大的先匹配（缺省 0；内置家族相当于 -100）。 */
  priority?: number
  /** 无 mount 时的兜底渲染：iframe（如 PDF）或纯文本。 */
  mode?: 'iframe' | 'text'
  /** 自定义渲染（React 节点或 DOM 节点，同 PaneDescriptor.mount）。 */
  mount?: (props: ViewerMountProps) => MountResult
}

/** 服务对外暴露的方法（`ctx.mytable`）。 */
export type MyTableService = {
  /** 服务版本（与包版本一致）。 */
  version: string
  /** 注册窗口类型；返回 disposer（注销）。 */
  registerPaneType(descriptor: PaneDescriptor): () => void
  /** 注册文件预览器；返回 disposer（注销）。 */
  registerFileViewer(descriptor: ViewerDescriptor): () => void
  /** 当前已注册的窗口类型（按 order 排序）。 */
  paneTypes(): PaneDescriptor[]
  /** 当前已注册的文件预览器（按 priority/order 排序）。 */
  fileViewers(): ViewerDescriptor[]
  /** 订阅注册表变化（新增/注销）；返回退订函数。 */
  subscribe(listener: () => void): () => void
  /** 某注册项当前是否启用（设置页开关）。 */
  isEnabled(kind: 'pane' | 'viewer', id: string): boolean
}

/** 内置窗口类型 id（保留，不允许插件占用）。 */
const RESERVED_PANE_IDS = ['browser', 'anim', 'explorer', 'scm', 'changes', 'tasks', 'prompts', 'terminal', 'custom', 'console']
/** 内置预览家族 id（保留，不允许插件占用）。 */
const RESERVED_VIEWER_IDS = ['html', 'md', 'code', 'text', 'image', 'pdf']

const panes: PaneDescriptor[] = []
const viewers: ViewerDescriptor[] = []
const listeners = new Set<() => void>()

/** 取值助手：descriptor 的文案字段允许 string | () => string。 */
export function textOf(v: string | (() => string) | undefined, fallback = ''): string {
  if (v === undefined) return fallback
  if (typeof v === 'string') return v
  try { return String(v()) } catch { return fallback }
}

function notify(): void {
  for (const fn of [...listeners]) {
    try { fn() } catch {}
  }
}

const byOrder = (a: { order?: number; id: string }, b: { order?: number; id: string }) =>
  (a.order ?? 1000) - (b.order ?? 1000) || a.id.localeCompare(b.id)

/** 已注册的窗口类型（副本，按 order）。 */
export function listPaneTypes(): PaneDescriptor[] {
  return [...panes].sort(byOrder)
}

/** 已注册的文件预览器（副本，按 priority 降序 + order）。 */
export function listFileViewers(): ViewerDescriptor[] {
  return [...viewers].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || byOrder(a as any, b as any))
}

/** 按 id 取窗口类型。 */
export function paneDescriptor(id: string): PaneDescriptor | undefined {
  return panes.find((p) => p.id === id)
}

/** 规范化扩展名（去点、小写）。 */
export const normExt = (e: string): string => String(e).replace(/^\./, '').toLowerCase()

/** 路径扩展名（去点、小写）。 */
export const extOfPath = (path: string): string => {
  const base = String(path).split(/[\\/]/).pop() ?? ''
  const i = base.lastIndexOf('.')
  return i <= 0 ? '' : base.slice(i + 1).toLowerCase()
}

/**
 * 命中某文件的注册预览器（按 priority 降序；同优先级按 order）。
 * 只回注册表结果，不判断启用状态——启用与否由调用方（worktable-prefs）决定，
 * 这样设置页能在「已禁用」时也把卡片画出来。
 */
export function viewerForPath(path: string): ViewerDescriptor | undefined {
  const ext = extOfPath(path)
  const hit = viewers.filter((v) => (v.exts.length === 0 ? true : v.exts.some((e) => normExt(e) === ext)))
  const specific = hit.filter((v) => v.exts.length > 0)
  const pool = specific.length > 0 ? specific : hit
  return [...pool].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || byOrder(a as any, b as any))[0]
}

/** 注册一个窗口类型（id 非法/重复/占用内置 id 时忽略并告警，返回空 disposer）。 */
export function registerPaneType(descriptor: PaneDescriptor): () => void {
  if (!descriptor || typeof descriptor.id !== 'string' || !descriptor.id.trim()) {
    try { console.warn('[dsh-mytable] registerPaneType: 缺少 id，已忽略') } catch {}
    return () => {}
  }
  if (RESERVED_PANE_IDS.includes(descriptor.id)) {
    try { console.warn('[dsh-mytable] registerPaneType: id 与内置窗口类型重名（' + descriptor.id + '），已忽略') } catch {}
    return () => {}
  }
  if (panes.some((p) => p.id === descriptor.id)) {
    try { console.warn('[dsh-mytable] registerPaneType: id 已注册（' + descriptor.id + '），已忽略') } catch {}
    return () => {}
  }
  panes.push(descriptor)
  notify()
  return () => {
    const i = panes.indexOf(descriptor)
    if (i >= 0) { panes.splice(i, 1); notify() }
  }
}

/** 注册一个文件预览器（id 非法/重复/占用内置 id 时忽略并告警，返回空 disposer）。 */
export function registerFileViewer(descriptor: ViewerDescriptor): () => void {
  if (!descriptor || typeof descriptor.id !== 'string' || !descriptor.id.trim()) {
    try { console.warn('[dsh-mytable] registerFileViewer: 缺少 id，已忽略') } catch {}
    return () => {}
  }
  if (RESERVED_VIEWER_IDS.includes(descriptor.id)) {
    try { console.warn('[dsh-mytable] registerFileViewer: id 与内置预览家族重名（' + descriptor.id + '），已忽略') } catch {}
    return () => {}
  }
  if (!Array.isArray(descriptor.exts)) {
    try { console.warn('[dsh-mytable] registerFileViewer: exts 必须是数组（' + descriptor.id + '），已忽略') } catch {}
    return () => {}
  }
  if (viewers.some((v) => v.id === descriptor.id)) {
    try { console.warn('[dsh-mytable] registerFileViewer: id 已注册（' + descriptor.id + '），已忽略') } catch {}
    return () => {}
  }
  viewers.push(descriptor)
  notify()
  return () => {
    const i = viewers.indexOf(descriptor)
    if (i >= 0) { viewers.splice(i, 1); notify() }
  }
}

/**
 * 组装服务对象（在客户端 apply 里 `ctx.provide('mytable', createMyTableService(...))`）。
 * @param version 包版本（显示在设置节底部）
 * @param isEnabled 查开关状态的函数（由 worktable-prefs 提供，避免本模块反向依赖偏好存储）
 */
export function createMyTableService(
  version: string,
  isEnabled: (kind: 'pane' | 'viewer', id: string) => boolean,
): MyTableService {
  return {
    version,
    registerPaneType,
    registerFileViewer,
    paneTypes: listPaneTypes,
    fileViewers: listFileViewers,
    subscribe: (fn) => { listeners.add(fn); return () => { listeners.delete(fn) } },
    isEnabled,
  }
}

/** React 侧订阅注册表（设置页 / 选择器 / 预览分发共用）。 */
export function useMyTableRegistry(): { panes: PaneDescriptor[]; viewers: ViewerDescriptor[] } {
  const [snap, setSnap] = useState(() => ({ panes: listPaneTypes(), viewers: listFileViewers() }))
  useEffect(() => {
    const refresh = () => setSnap({ panes: listPaneTypes(), viewers: listFileViewers() })
    refresh()
    listeners.add(refresh)
    return () => { listeners.delete(refresh) }
  }, [])
  return snap
}
