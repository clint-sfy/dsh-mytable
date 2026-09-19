/**
 * 浏览器窗的图标：内联 SVG（14px 描边风格，颜色跟随 currentColor）。
 *
 * 不引 DSH 的 ui-primitives 图标组件——mytable 的客户端 bundle 至今零
 * `@deepseek-ai/*` 运行时依赖，图标自绘可保持这条边界，也避免不同宿主版本下
 * 图标组件名变动导致整窗挂掉。视觉规格对齐 DSH 图标：16 视框、1.4 描边、圆头。
 */
type IconProps = { size?: number }

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
})

export function IconChevronLeft({ size = 14 }: IconProps) {
  return <svg {...base(size)}><path d="M10 3.5 5.5 8l4.5 4.5" /></svg>
}

export function IconChevronRight({ size = 14 }: IconProps) {
  return <svg {...base(size)}><path d="M6 3.5 10.5 8 6 12.5" /></svg>
}

export function IconRefresh({ size = 14 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M13 8a5 5 0 1 1-1.6-3.7" />
      <path d="M13 2.5V5.2h-2.7" />
    </svg>
  )
}

export function IconGo({ size = 14 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M6.2 9.8 12 4" />
      <path d="M7.4 4H12v4.6" />
      <path d="M12 12H4V4" />
    </svg>
  )
}

export function IconExternal({ size = 14 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M9.5 2.5H13.5V6.5" />
      <path d="M13.5 2.5 8 8" />
      <path d="M12 9.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3" />
    </svg>
  )
}

export function IconWarning({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M8 2.2 14.5 13.4H1.5L8 2.2Z" />
      <path d="M8 6.4v3" />
      <path d="M8 11.4h.01" />
    </svg>
  )
}
