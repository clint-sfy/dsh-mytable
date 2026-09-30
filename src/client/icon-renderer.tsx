import { DEFAULT_PROJECT_ICON, workspaceIconSvgMarkup, type WorkspaceIconId } from './icon-set'

export type WorkspaceIconProps = {
  value: unknown
  fallback?: WorkspaceIconId
  className?: string
}

/** 统一的 React 图标宿主；内置值渲染固定颜色 SVG，未知值由 markup 层提供文本 fallback。 */
export function WorkspaceIcon({ value, fallback = DEFAULT_PROJECT_ICON, className }: WorkspaceIconProps) {
  return (
    <span
      className={'dsh-mt_workspaceIcon' + (className ? ` ${className}` : '')}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: workspaceIconSvgMarkup(value, fallback) }}
    />
  )
}
