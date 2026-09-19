/**
 * 文件 / 文件夹图标。
 *
 * 首选**宿主官方**的 `FileTypeIcon`（`@deepseek-ai/dsh-client-ui-primitives`）——与 DSH 自己的
 * 文件树是同一套图：48 类代码/配置彩色图形 + 分类着色的文档/图片/PDF/文件夹图形，由宿主自己的调色板
 * 绘制，所以本模块**不带任何扩展名表、不带任何颜色字面量**，也不需要额外的 lazy chunk。
 *
 * 用**惰性 require + try/catch** 而不是顶层 import：宿主模块表里万一没有这个包（老版本 / 定制宿主），
 * 顶层 import 会让整个客户端 bundle 求值失败、工作台整块白屏；惰性 require 只会让图标退化成自绘的一套，
 * 树、预览、@ 引用照常可用。`dsh.client.inject` 已声明该包，正常宿主下走的就是官方图标。
 */
import type { ReactNode } from 'react'

/** 官方 primitives 模块（探不到就是 null，只探一次） */
let primitives: any | null | undefined
function loadPrimitives(): any | null {
  if (primitives !== undefined) return primitives
  try {
    // 字面量 require：打包时保持 external，运行时由宿主模块表解析（门禁白名单 = inject 清单）
    primitives = require('@deepseek-ai/dsh-client-ui-primitives')
  } catch {
    primitives = null
  }
  return primitives
}

/** 一个文件行的图标：宿主分类器按路径给图；探不到官方图标时用通用文档图形 */
export function FileGlyph(props: { path: string; size?: number }): ReactNode {
  const size = props.size ?? 14
  const primitivesMod = loadPrimitives()
  const FileTypeIcon = primitivesMod?.FileTypeIcon
  if (typeof FileTypeIcon === 'function') return <FileTypeIcon path={props.path} size={size} />
  return <OwnGlyph kind={glyphKindOf(props.path)} size={size} />
}

/** 一个目录行的图标 */
export function FolderGlyph(props: { open?: boolean; size?: number }): ReactNode {
  const size = props.size ?? 14
  const primitivesMod = loadPrimitives()
  const FileTypeIcon = primitivesMod?.FileTypeIcon
  if (typeof FileTypeIcon === 'function') return <FileTypeIcon kind="folder" size={size} />
  return <OwnGlyph kind={props.open === true ? 'folder-open' : 'folder'} size={size} />
}

/** 自绘退化图标按扩展名分档（只在没有官方图标时用） */
type GlyphKind = 'folder' | 'folder-open' | 'code' | 'markdown' | 'image' | 'pdf' | 'archive' | 'file'

function glyphKindOf(path: string): GlyphKind {
  const name = path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? ''
  const ext = (name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '').toLowerCase()
  if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'css', 'scss', 'less', 'html', 'htm', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'sh', 'ps1', 'yml', 'yaml', 'toml', 'json'].includes(ext)) return 'code'
  if (['md', 'markdown', 'mdown'].includes(ext)) return 'markdown'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (['zip', 'gz', 'tgz', 'tar', '7z', 'rar'].includes(ext)) return 'archive'
  return 'file'
}

/** 自绘图标：16 视框、1.3 描边、颜色跟随 currentColor（与工作台其它图标同一套画法） */
function OwnGlyph(props: { kind: GlyphKind; size: number }): ReactNode {
  const { kind, size } = props
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.3,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  if (kind === 'folder' || kind === 'folder-open') {
    return (
      <svg {...common}>
        <path d="M1.8 12.6V3.9h4.3l1.4 1.6h6.7v7.1z" />
        {kind === 'folder-open' && <path d="M1.8 8.2h12.4" />}
      </svg>
    )
  }
  if (kind === 'code') {
    return (
      <svg {...common}>
        <path d="M5.6 4.6 2.4 8l3.2 3.4M10.4 4.6 13.6 8l-3.2 3.4" />
      </svg>
    )
  }
  if (kind === 'markdown') {
    return (
      <svg {...common}>
        <rect x="1.6" y="3.4" width="12.8" height="9.2" rx="1.4" />
        <path d="M4 10.4V6l2 2.2L8 6v4.4M10.8 6v4.4M9.6 9l1.2 1.4L12 9" />
      </svg>
    )
  }
  if (kind === 'image') {
    return (
      <svg {...common}>
        <rect x="1.8" y="3.2" width="12.4" height="9.6" rx="1.4" />
        <circle cx="5.6" cy="6.6" r="1.1" />
        <path d="M2.6 11.6 6.4 8.4l2.2 2 2-1.6 2.8 2.8" />
      </svg>
    )
  }
  if (kind === 'pdf' || kind === 'archive') {
    return (
      <svg {...common}>
        <path d="M3.4 1.9h6l3.2 3.2v9H3.4z" />
        <path d="M9.4 1.9v3.2h3.2" />
        {kind === 'archive' ? <path d="M6.6 8.4h2.8M6.6 10.6h2.8" /> : <path d="M5.8 11.6V8.2h1.7a1.2 1.2 0 0 1 0 2.4H5.8" />}
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M3.4 1.9h6l3.2 3.2v9H3.4z" />
      <path d="M9.4 1.9v3.2h3.2" />
    </svg>
  )
}
