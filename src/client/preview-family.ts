/**
 * 文件路径 → 预览家族的纯逻辑（不引 React，便于单测直接打靶）。
 *
 * 家族与 FileViewer 的分流一一对应；`previewFamilyOf` 决定的家族名同时是
 * 「设置 → 工作台 → 文件预览」里那张开关卡的 key。
 *
 * 设计原则：**能渲染的给渲染器，不能渲染的给说明面板**——绝不把二进制当文本读成乱码。
 */
// 显式带 .ts 后缀：让 Node 24 的类型剥离能直接 import 本模块做单测（esbuild 同样认这个路径）
import { isCodePath } from './code-highlight.ts'

/** 文件预览家族（与 FileViewer 的扩展名分流一一对应）。 */
export type PreviewFamily =
  | 'html' | 'md' | 'code' | 'text'
  | 'image' | 'pdf' | 'audio' | 'video' | 'table' | 'office' | 'binary'

/** 设置页卡片顺序（与 PREVIEW_FAMILIES 一致；zh 词典之外的唯一来源）。 */
export const PREVIEW_FAMILIES: PreviewFamily[] = [
  'html', 'md', 'code', 'text', 'image', 'pdf', 'audio', 'video', 'table', 'office', 'binary',
]

/** 取扩展名（小写，不含点） */
export function extOfPathLower(path: string): string {
  return (String(path).split('.').pop() || '').toLowerCase()
}

/**
 * 文件路径 → 预览家族。
 * html/htm 走站点托管（关闭则退化为文本）、md 渲染、代码/配置交给语法着色
 * （含 Makefile/Dockerfile 与 .py/.go/.yml/.sh… 等 70 余种扩展名）、图片、pdf、音视频、
 * csv/tsv 表格、Office 文档与压缩包/二进制走「不支持内嵌预览」面板，其余纯文本。
 */
export function previewFamilyOf(path: string): PreviewFamily {
  const ext = extOfPathLower(path)
  if (ext === 'html' || ext === 'htm') return 'html'
  if (ext === 'md' || ext === 'markdown' || ext === 'mdown') return 'md'
  if (/^(png|jpg|jpeg|gif|webp|svg|bmp|ico|avif)$/.test(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (/^(mp3|wav|ogg|oga|m4a|flac|aac|opus|weba)$/.test(ext)) return 'audio'
  if (/^(mp4|webm|ogv|mov|m4v|mkv|avi)$/.test(ext)) return 'video'
  if (ext === 'csv' || ext === 'tsv') return 'table'
  if (/^(docx?|xlsx?|pptx?|odt|ods|odp|rtf|pages|numbers|key)$/.test(ext)) return 'office'
  if (/^(zip|gz|tgz|tar|7z|rar|bz2|xz|jar|war|apk|dmg|iso|img|exe|dll|so|dylib|bin|dat|db|sqlite|sqlite3|class|o|a|lib|pyc|wasm|woff2?|ttf|otf|eot)$/.test(ext)) return 'binary'
  if (isCodePath(path)) return 'code'
  return 'text'
}
