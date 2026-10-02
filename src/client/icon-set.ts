import { FLUENT_EMOJI_ICONS } from './fluent-emoji-icons.generated.ts'

/** 工作区、布局与快捷方式共用的图标库。存储值使用稳定 builtin:* ID，不依赖 emoji 字体。 */
export type WorkspaceIconId = `builtin:${string}`
export type WorkspaceIconGlyph =
  | 'brick' | 'laptop' | 'monitor' | 'worktable' | 'keyboard' | 'developer' | 'robot'
  | 'tools' | 'settings' | 'wrench' | 'package' | 'folders' | 'folder'
  | 'note' | 'books' | 'pencil' | 'ruler' | 'flask' | 'microscope'
  | 'chart' | 'compass' | 'rocket' | 'globe' | 'lock' | 'sparkles'
  | 'chat' | 'palette' | 'game' | 'home' | 'school' | 'car' | 'plane'
  | 'world' | 'hospital' | 'target' | 'bulb' | 'link'
  | 'atom' | 'dna' | 'brain' | 'scientist' | 'labcoat' | 'telescope'
  | 'satellite' | 'antenna' | 'abacus' | 'disk' | 'mouse' | 'search'

export type WorkspaceIconDefinition = {
  id: WorkspaceIconId
  legacy: string
  label: string
  color: string
  glyph: WorkspaceIconGlyph
}

export const WORKSPACE_ICON_DEFINITIONS = [
  { id: 'builtin:worktable', legacy: '', label: '工作台', color: '#4f7cff', glyph: 'worktable' },
  { id: 'builtin:brick', legacy: '🧱', label: '砖块', color: '#f59e0b', glyph: 'brick' },
  { id: 'builtin:laptop', legacy: '💻', label: '电脑', color: '#38bdf8', glyph: 'laptop' },
  { id: 'builtin:monitor', legacy: '🖥️', label: '显示器', color: '#60a5fa', glyph: 'monitor' },
  { id: 'builtin:keyboard', legacy: '⌨️', label: '键盘', color: '#a78bfa', glyph: 'keyboard' },
  { id: 'builtin:developer', legacy: '🧑‍💻', label: '开发者', color: '#22c55e', glyph: 'developer' },
  { id: 'builtin:robot', legacy: '🤖', label: '机器人', color: '#94a3b8', glyph: 'robot' },
  { id: 'builtin:tools', legacy: '🛠️', label: '工具', color: '#fb923c', glyph: 'tools' },
  { id: 'builtin:settings', legacy: '⚙️', label: '设置', color: '#c084fc', glyph: 'settings' },
  { id: 'builtin:wrench', legacy: '🔧', label: '扳手', color: '#f97316', glyph: 'wrench' },
  { id: 'builtin:package', legacy: '📦', label: '包裹', color: '#fbbf24', glyph: 'package' },
  { id: 'builtin:folders', legacy: '🗂️', label: '文件夹组', color: '#facc15', glyph: 'folders' },
  { id: 'builtin:folder', legacy: '📁', label: '文件夹', color: '#f59e0b', glyph: 'folder' },
  { id: 'builtin:note', legacy: '📝', label: '文档', color: '#38bdf8', glyph: 'note' },
  { id: 'builtin:books', legacy: '📚', label: '书籍', color: '#818cf8', glyph: 'books' },
  { id: 'builtin:pencil', legacy: '✏️', label: '铅笔', color: '#fb7185', glyph: 'pencil' },
  { id: 'builtin:ruler', legacy: '📐', label: '尺子', color: '#2dd4bf', glyph: 'ruler' },
  { id: 'builtin:flask', legacy: '🧪', label: '实验', color: '#a3e635', glyph: 'flask' },
  { id: 'builtin:microscope', legacy: '🔬', label: '显微镜', color: '#34d399', glyph: 'microscope' },
  { id: 'builtin:chart', legacy: '📊', label: '图表', color: '#4ade80', glyph: 'chart' },
  { id: 'builtin:compass', legacy: '🧭', label: '指南针', color: '#2dd4bf', glyph: 'compass' },
  { id: 'builtin:rocket', legacy: '🚀', label: '火箭', color: '#f43f5e', glyph: 'rocket' },
  { id: 'builtin:globe', legacy: '🌐', label: '网络', color: '#38bdf8', glyph: 'globe' },
  { id: 'builtin:lock', legacy: '🔒', label: '锁', color: '#818cf8', glyph: 'lock' },
  { id: 'builtin:sparkles', legacy: '✨', label: '闪光', color: '#facc15', glyph: 'sparkles' },
  { id: 'builtin:chat', legacy: '💬', label: '对话', color: '#60a5fa', glyph: 'chat' },
  { id: 'builtin:palette', legacy: '🎨', label: '调色板', color: '#f472b6', glyph: 'palette' },
  { id: 'builtin:game', legacy: '🎮', label: '游戏', color: '#a78bfa', glyph: 'game' },
  { id: 'builtin:home', legacy: '🏠', label: '首页', color: '#fb923c', glyph: 'home' },
  { id: 'builtin:school', legacy: '🎓', label: '学习', color: '#818cf8', glyph: 'school' },
  { id: 'builtin:car', legacy: '🚗', label: '汽车', color: '#f87171', glyph: 'car' },
  { id: 'builtin:plane', legacy: '✈️', label: '飞机', color: '#93c5fd', glyph: 'plane' },
  { id: 'builtin:world', legacy: '🌍', label: '世界', color: '#4ade80', glyph: 'world' },
  { id: 'builtin:world-alt', legacy: '🌏', label: '世界（东）', color: '#34d399', glyph: 'world' },
  { id: 'builtin:hospital', legacy: '🏥', label: '医疗', color: '#fb7185', glyph: 'hospital' },
  { id: 'builtin:target', legacy: '🎯', label: '目标', color: '#f43f5e', glyph: 'target' },
  { id: 'builtin:bulb', legacy: '💡', label: '灵感', color: '#facc15', glyph: 'bulb' },
  { id: 'builtin:link', legacy: '🔗', label: '链接', color: '#22d3ee', glyph: 'link' },
  { id: 'builtin:atom', legacy: '⚛️', label: '原子', color: '#60a5fa', glyph: 'atom' },
  { id: 'builtin:dna', legacy: '🧬', label: 'DNA', color: '#c084fc', glyph: 'dna' },
  { id: 'builtin:brain', legacy: '🧠', label: '大脑', color: '#fb7185', glyph: 'brain' },
  { id: 'builtin:scientist', legacy: '🧑‍🔬', label: '科研人员', color: '#34d399', glyph: 'scientist' },
  { id: 'builtin:lab-coat', legacy: '🥼', label: '实验服', color: '#e2e8f0', glyph: 'labcoat' },
  { id: 'builtin:telescope', legacy: '🔭', label: '望远镜', color: '#818cf8', glyph: 'telescope' },
  { id: 'builtin:satellite', legacy: '🛰️', label: '卫星', color: '#94a3b8', glyph: 'satellite' },
  { id: 'builtin:antenna', legacy: '📡', label: '天线', color: '#38bdf8', glyph: 'antenna' },
  { id: 'builtin:abacus', legacy: '🧮', label: '计算', color: '#f97316', glyph: 'abacus' },
  { id: 'builtin:disk', legacy: '💽', label: '数据存储', color: '#a78bfa', glyph: 'disk' },
  { id: 'builtin:mouse', legacy: '🖱️', label: '鼠标', color: '#94a3b8', glyph: 'mouse' },
  { id: 'builtin:search', legacy: '🔍', label: '搜索', color: '#60a5fa', glyph: 'search' },
] as const satisfies readonly WorkspaceIconDefinition[]

/** 选择器使用稳定 ID；数组顺序保持原 emoji 选择集顺序，末尾补充快捷方式链接图标。 */
export const WORKSPACE_ICONS = WORKSPACE_ICON_DEFINITIONS.map(({ id }) => id) as readonly WorkspaceIconId[]

export const DEFAULT_LAYOUT_ICON: WorkspaceIconId = 'builtin:brick'
export const DEFAULT_PROMPT_WORKSPACE_ICON: WorkspaceIconId = 'builtin:laptop'
export const DEFAULT_PROJECT_ICON: WorkspaceIconId = 'builtin:package'
export const DEFAULT_SHORTCUT_ICON: WorkspaceIconId = 'builtin:link'
export const DEFAULT_CONSOLE_ICON: WorkspaceIconId = 'builtin:monitor'

const WORKSPACE_ICON_BY_ID = new Map<string, WorkspaceIconDefinition>(
  WORKSPACE_ICON_DEFINITIONS.map((definition) => [definition.id, definition]),
)
const WORKSPACE_ICON_BY_LEGACY = new Map<string, WorkspaceIconId>(
  WORKSPACE_ICON_DEFINITIONS.flatMap((definition) => [
    [definition.legacy, definition.id],
    [definition.legacy.replace(/\uFE0F/g, ''), definition.id],
  ] as const),
)

/** 读取旧存储/导出数据时迁移 emoji；未知字符串原样保留，供文本 fallback 显示。 */
export function normalizeWorkspaceIcon(value: unknown, fallback: WorkspaceIconId = DEFAULT_PROMPT_WORKSPACE_ICON): string {
  if (typeof value !== 'string' || !value.trim()) return fallback
  const text = value.trim()
  return WORKSPACE_ICON_BY_LEGACY.get(text) ?? WORKSPACE_ICON_BY_LEGACY.get(text.replace(/\uFE0F/g, '')) ?? text
}

/** 解析内置图标；旧 emoji 也能命中，未知值返回 null。 */
export function workspaceIconDefinitionOf(value: unknown): WorkspaceIconDefinition | null {
  const normalized = normalizeWorkspaceIcon(value)
  return WORKSPACE_ICON_BY_ID.get(normalized) ?? null
}

const ICON_GLYPHS: Record<WorkspaceIconGlyph, string> = {
  worktable: '<rect x="5" y="5" width="9" height="9" rx="2.3" fill="#fff" opacity=".98"/><rect x="10" y="10" width="9" height="9" rx="2.3" fill="#2dd4bf"/><path d="M8 8h3M13 13h3" stroke="#4f7cff" stroke-width="1.4" stroke-linecap="round"/>',
  brick: '<path d="M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z" fill="#fff" opacity=".94"/>',
  laptop: '<rect x="4" y="4" width="16" height="11" rx="1.5" fill="#fff"/><path d="M3 18h18l-2 2H5z" fill="#fff" opacity=".9"/>',
  monitor: '<rect x="3.5" y="4" width="17" height="12" rx="1.5" fill="#fff"/><path d="M10 16h4v3h3v1H7v-1h3z" fill="#fff" opacity=".9"/>',
  keyboard: '<rect x="3" y="6" width="18" height="12" rx="2" fill="#fff"/><path d="M6 9h1.5M9 9h1.5M12 9h1.5M15 9h1.5M6 12h1.5M9 12h1.5M12 12h4.5M6 15h12" stroke="#8b5cf6" stroke-width="1.2" stroke-linecap="round"/>',
  developer: '<circle cx="12" cy="8" r="3.2" fill="#fff"/><path d="M5 20c.7-3.3 3.1-5 7-5s6.3 1.7 7 5z" fill="#fff" opacity=".92"/>',
  robot: '<rect x="5" y="7" width="14" height="11" rx="3" fill="#fff"/><path d="M12 4v3M9 12h.1M15 12h.1" stroke="#64748b" stroke-width="2" stroke-linecap="round"/><path d="M8 16h8" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/>',
  tools: '<path d="M5 5l5 5-2 2-5-5zM14 14l5 5-2 2-5-5zM16 5l3 3-7 7-3-3z" fill="#fff" opacity=".94"/>',
  settings: '<circle cx="12" cy="12" r="3.5" fill="none" stroke="#fff" stroke-width="2.5"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>',
  wrench: '<path d="M14.8 5.1a4.2 4.2 0 0 0-5.3 5.3L4.2 15.7a2 2 0 1 0 2.8 2.8l5.3-5.3a4.2 4.2 0 0 0 5.3-5.3l-2.5 2.5-2.8-.8-.8-2.8z" fill="#fff"/>',
  package: '<path d="M4 7.2L12 3l8 4.2v9.6L12 21l-8-4.2z" fill="#fff" opacity=".95"/><path d="M4.5 7.5L12 11.5l7.5-4M12 11.5V20" fill="none" stroke="#d97706" stroke-width="1.3"/>',
  folders: '<path d="M3 7h7l1.7 2H21v10H3z" fill="#fff" opacity=".9"/><path d="M5 5h6l1.5 2H19v2H5z" fill="#fff" opacity=".7"/>',
  folder: '<path d="M3 6h7l2 2h9v10H3z" fill="#fff" opacity=".95"/><path d="M3 9h18" stroke="#d97706" stroke-width="1.2"/>',
  note: '<path d="M6 3h9l4 4v14H6z" fill="#fff"/><path d="M15 3v5h4M9 12h6M9 15h6M9 18h4" stroke="#0284c7" stroke-width="1.3" stroke-linecap="round"/>',
  books: '<path d="M5 5h4v14H5zM10 4h4v15h-4zM15 6h4v13h-4z" fill="#fff" opacity=".94"/><path d="M4 20h16" stroke="#4f46e5" stroke-width="1.6" stroke-linecap="round"/>',
  pencil: '<path d="M6 18l1.1-4.1L16.8 4.2a2 2 0 0 1 2.8 2.8L9.9 17.7z" fill="#fff"/><path d="M14.8 6.2l3 3" stroke="#be123c" stroke-width="1.3"/><path d="M6 18l-1 1 1.4-.3z" fill="#fff"/>',
  ruler: '<path d="M5 4h14v4H9v12H5z" fill="#fff"/><path d="M9 5v2M12 5v2M15 5v2M18 5v2M6 11h2M6 14h2M6 17h2" stroke="#0f766e" stroke-width="1.2"/>',
  flask: '<path d="M9 3h6v5l4.5 8.1A3.2 3.2 0 0 1 16.7 21H7.3a3.2 3.2 0 0 1-2.8-4.9L9 8z" fill="#fff"/><path d="M7.1 15h9.8l1.6 2.7A2 2 0 0 1 16.7 20H7.3a2 2 0 0 1-1.7-3z" fill="#65a30d" opacity=".8"/>',
  microscope: '<path d="M9 4h3v7h-3zM12 5l4 4-2 2-4-4zM7 12h7a4 4 0 0 1 4 4v1H9a4 4 0 0 1-4-4v-1z" fill="#fff"/><path d="M4 20h16M12 17v3" stroke="#047857" stroke-width="1.6" stroke-linecap="round"/>',
  chart: '<path d="M5 18V11h3v7zM10 18V7h3v11zM15 18V4h3v14z" fill="#fff"/><path d="M4 20h16" stroke="#16a34a" stroke-width="1.5" stroke-linecap="round"/>',
  compass: '<circle cx="12" cy="12" r="8" fill="none" stroke="#fff" stroke-width="2"/><path d="M15.8 8.2l-2.2 5.4-5.4 2.2 2.2-5.4z" fill="#fff"/>',
  rocket: '<path d="M13.5 4.1c3.4-.6 5.9.1 6.4.6.5.5 1.2 3-.1 6.4l-5.2 5.2-5.6-.8-.8-5.6z" fill="#fff"/><path d="M8.9 15.1l-3.4 3.4M8.2 17.5l-2.8.1.1-2.8M13 8.8h.1" stroke="#be123c" stroke-width="1.7" stroke-linecap="round"/>',
  globe: '<circle cx="12" cy="12" r="8" fill="none" stroke="#fff" stroke-width="1.8"/><path d="M4.5 12h15M12 4c2.1 2.2 3.1 4.9 3.1 8S14.1 17.8 12 20M12 4C9.9 6.2 8.9 8.9 8.9 12s1 5.8 3.1 8" fill="none" stroke="#fff" stroke-width="1.2"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2" fill="#fff"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="#fff" stroke-width="2"/><circle cx="12" cy="15" r="1.4" fill="#6366f1"/>',
  sparkles: '<path d="M12 3l1.3 5.7L19 10l-5.7 1.3L12 17l-1.3-5.7L5 10l5.7-1.3zM19 16l.6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6z" fill="#fff"/>',
  chat: '<path d="M4 5h16v11H9l-4 4v-4H4z" fill="#fff"/><path d="M8 10h8M8 13h5" stroke="#2563eb" stroke-width="1.4" stroke-linecap="round"/>',
  palette: '<path d="M12 4a8 8 0 0 0 0 16h1.2c1.4 0 2.1-1.8 1.1-2.8-.9-.9-.2-2.5 1.1-2.5H17a3 3 0 0 0 3-3A8 8 0 0 0 12 4z" fill="#fff"/><circle cx="8" cy="10" r="1" fill="#db2777"/><circle cx="11" cy="7.5" r="1" fill="#db2777"/><circle cx="15" cy="8" r="1" fill="#db2777"/>',
  game: '<path d="M5.5 8h13a3 3 0 0 1 2.8 4.1l-2.1 5.4a2 2 0 0 1-3.4.6L14 16H10l-1.8 2.1a2 2 0 0 1-3.4-.6l-2.1-5.4A3 3 0 0 1 5.5 8z" fill="#fff"/><path d="M7 11v4M5 13h4M16.5 12h.1M18.5 14h.1" stroke="#7c3aed" stroke-width="1.6" stroke-linecap="round"/>',
  home: '<path d="M4 11l8-7 8 7v9H4z" fill="#fff"/><path d="M10 20v-5h4v5" fill="#fb923c"/>',
  school: '<path d="M3 9l9-5 9 5-9 5zM6 12v5c2.8 2 9.2 2 12 0v-5" fill="#fff"/><path d="M21 9v6" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>',
  car: '<path d="M5 16l1.5-6h11L19 16v4h-2v-2H7v2H5z" fill="#fff"/><path d="M7.5 10l1.2-3h6.6l1.2 3" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="8" cy="16" r="1.5" fill="#dc2626"/><circle cx="16" cy="16" r="1.5" fill="#dc2626"/>',
  plane: '<path d="M3 13l7.2-1.8L14 4.5l2 .5-1.2 6.2 5.9 1.5c1.7.4 1.7 2.8 0 3.2l-5.9 1.5L16 23l-2-.5-3.8-6.7L3 14z" fill="#fff"/>',
  world: '<circle cx="12" cy="12" r="8" fill="none" stroke="#fff" stroke-width="1.8"/><path d="M5 8.5h14M5 15.5h14M12 4c1.8 2 2.7 4.6 2.7 8S13.8 18 12 20" fill="none" stroke="#fff" stroke-width="1.2"/>',
  hospital: '<rect x="5" y="4" width="14" height="16" rx="1" fill="#fff"/><path d="M10 8h4v3h3v4h-3v3h-4v-3H7v-4h3z" fill="#e11d48"/>',
  target: '<circle cx="12" cy="12" r="8" fill="none" stroke="#fff" stroke-width="2"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="#fff" stroke-width="2"/><circle cx="12" cy="12" r="1.7" fill="#be123c"/>',
  bulb: '<path d="M8 14.5c-1.2-1.1-2-2.6-2-4.5a6 6 0 1 1 12 0c0 1.9-.8 3.4-2 4.5-.6.6-1 1.1-1 2.5H9c0-1.4-.4-1.9-1-2.5z" fill="#fff"/><path d="M9 20h6M10 22h4" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>',
  link: '<path d="M9.5 14.5l-1.3 1.3a3.2 3.2 0 0 1-4.5-4.5l2.4-2.4a3.2 3.2 0 0 1 4.5 0M14.5 9.5l1.3-1.3a3.2 3.2 0 0 1 4.5 4.5l-2.4 2.4a3.2 3.2 0 0 1-4.5 0M8 16l8-8" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>',
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
}

/** 输出可直接插入 DOM 的 inline SVG；未知字符串走转义后的文本 fallback。 */
export function workspaceIconSvgMarkup(value: unknown, fallback: WorkspaceIconId = DEFAULT_PROMPT_WORKSPACE_ICON): string {
  const normalized = normalizeWorkspaceIcon(value, fallback)
  const definition = WORKSPACE_ICON_BY_ID.get(normalized)
  if (!definition) return `<span data-workspace-icon-fallback="true">${escapeHtml(normalized)}</span>`
  const icon = FLUENT_EMOJI_ICONS[definition.glyph]
  return `<svg data-workspace-icon="${definition.id}" data-workspace-icon-style="fluent-emoji-flat" width="1em" height="1em" viewBox="0 0 ${icon.width} ${icon.height}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${icon.body}</svg>`
}

type WorkspaceIconElement = {
  innerHTML: string
  getAttribute?: (name: string) => string | null
  setAttribute: (name: string, value: string) => void
  removeAttribute: (name: string) => void
}

type BridgedIconState = {
  originalHtml: string
  normalized: string
  markup: string
  attributeApplied: boolean
}

const BRIDGED_ICON_STATE = new WeakMap<object, BridgedIconState>()

/** DOM 桥使用同一份 markup 覆盖宿主图标，并在覆盖移除时恢复宿主内容。 */
export function applyWorkspaceIconToElement(
  element: WorkspaceIconElement,
  value: unknown,
  fallback: WorkspaceIconId = DEFAULT_PROJECT_ICON,
): void {
  const normalized = normalizeWorkspaceIcon(value, fallback)
  const markup = workspaceIconSvgMarkup(normalized, fallback)
  let state = BRIDGED_ICON_STATE.get(element)
  if (!state) {
    state = { originalHtml: element.innerHTML, normalized, markup, attributeApplied: false }
    BRIDGED_ICON_STATE.set(element, state)
  } else {
    state.normalized = normalized
    state.markup = markup
  }

  if (element.innerHTML !== markup) element.innerHTML = markup
  const currentId = typeof element.getAttribute === 'function'
    ? element.getAttribute('data-workspace-icon-id')
    : state.attributeApplied ? normalized : null
  if (currentId !== normalized) element.setAttribute('data-workspace-icon-id', normalized)
  state.attributeApplied = true
}

export function clearWorkspaceIconOverride(element: WorkspaceIconElement): void {
  const state = BRIDGED_ICON_STATE.get(element)
  if (state) {
    element.innerHTML = state.originalHtml
    BRIDGED_ICON_STATE.delete(element)
  }
  element.removeAttribute('data-workspace-icon-id')
  // 清理旧版本桥接留下的标记，但不再使用它参与渲染。
  element.removeAttribute('data-mt-icon')
}
