/**
 * 把文件 / 文件夹引用插进当前会话的输入框（资源管理器的 `@` 胶囊与右键菜单、预览头的 `@` 按钮共用）。
 *
 * 写法参照 DSH-better-sidebar 的 `conversation-draft.ts` + `reference-in-chat.ts`：
 * - **文件**优先走 DSH 自己的结构化插入事件（`slash/input-insert-reference`）——输入框里出现的是一枚
 *   与原生 `@` 选择器完全一致的胶囊（显示 `@文件名`，发送时序列化成 `@相对路径`，整串引用是一个链接）；
 *   纯文本 `@a/b.ts` 只会被 DSH 的目录语法识别到前半段，所以纯文本是兜底而不是主路。
 * - **目录**走纯文本 `@目录/`（尾斜杠是 DSH 目录语法的一部分，补全要继续往下钻）。
 * - 两条路都要**按输入框里的真实光标切开插入**：会话服务只暴露整串 `getSnapshot().draft` / `setDraft(text)`，
 *   没有光标 API，所以光标从编排器的 `textarea` 现读（带值同步校验，避免把光标用在别的草稿上）；
 *   插完再把光标放回插入内容之后（受控 textarea 提交后会重置光标，不还原的话连续插入会错位）。
 * - 服务缺失 / 宿主没有这个事件 / 读不到光标，逐级退化：结构化胶囊 → 光标处纯文本 → DOM 追加到末尾，
 *   保证「点了 @ 一定插得进去」，且永不抛错打断界面。
 */
// 显式带 .ts 后缀：让 Node 24 的类型剥离能直接 import 本模块做单测（esbuild 同样认这个路径）
import { relativeTo } from './pathutil.ts'

/** 宿主服务引用（apply 时由工作台注入；缺省时全部走 DOM 兜底） */
type ReferenceServices = {
  conversation?: any
  sessions?: any
  /** 当前会话作用域读取器（由工作台注入，避免本模块反向依赖分栏引擎） */
  getScope?: () => { sessionId: string; cwd: string } | null
}
let services: ReferenceServices = {}

export function setReferenceServices(next: ReferenceServices | null): void {
  services = next ?? {}
}

/** 一次引用的落点（供界面给反馈文案） */
export type ReferenceOutcome = 'chip' | 'text' | 'dom' | 'fail'

/** 当前会话作用域（会话 id + 工作目录） */
export function currentScope(): { sessionId: string; cwd: string } | null {
  try {
    const s = services.getScope?.()
    if (!s || !s.sessionId) return null
    return { sessionId: s.sessionId, cwd: s.cwd ?? '' }
  } catch {
    return null
  }
}

/**
 * DSH 的 `@file` 拼写（对齐宿主 `formatFileMention` 的语法）：无空白用裸写、有空白用引号包起来；
 * 路径里出现控制字符或引号时返回 undefined（编辑器语法表达不了，直接放弃结构化插入）。
 */
export function fileMention(relativePath: string): { mention: string; label: string } | undefined {
  const path = relativePath.replace(/[\\/]+$/, '')
  // eslint-disable-next-line no-control-regex -- 拒掉控制字符正是这里的目的
  if (/[\u0000-\u001f\u007f-\u009f"]/u.test(path)) return undefined
  const mention = /\s/u.test(path) ? `@"${path}"` : `@${path}`
  const at = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  const label = at === -1 ? path : path.slice(at + 1)
  return { mention, label }
}

/** 插入结果：新草稿 + 插入内容之后的光标位置（左侧补的那个空格要算进去） */
function spliceInsert(draft: string, text: string, caret: { start: number; end: number } | null): { draft: string; caretAfter: number } {
  if (caret === null || draft === '') {
    const next = draft.trim() === '' ? text : `${draft} ${text}`
    return { draft: next, caretAfter: next.length }
  }
  const prefix = draft.slice(0, caret.start)
  const suffix = draft.slice(caret.end)
  if (prefix === '' && suffix === '') return { draft: text, caretAfter: text.length }
  // 左右各留一个空格，但贴边或已空白时不重复补（跟人在句子中间打字的手感一致）
  const left = prefix === '' || /\s$/.test(prefix) ? '' : ' '
  const right = suffix === '' || /^\s/.test(suffix) ? '' : ' '
  return {
    draft: `${prefix}${left}${text}${right}${suffix}`,
    caretAfter: prefix.length + left.length + text.length,
  }
}

/** 纯字符串版本（单测直接打这个） */
export function insertAtCaret(draft: string, text: string, caret: { start: number; end: number } | null): string {
  return spliceInsert(draft, text, caret).draft
}

/** 编排器输入宿主：优先会话列里带 data-phase 的 textarea；新版宿主是 contenteditable 富文本编排器 */
function findComposerTextarea(): HTMLTextAreaElement | null {
  if (typeof document === 'undefined') return null
  const column = document.querySelector('#root [data-slot="conversation"]')
  const find = (scope: ParentNode): HTMLTextAreaElement | null =>
    scope.querySelector('textarea[data-phase]') ?? scope.querySelector('textarea')
  return column !== null
    ? find(column)
    : document.querySelector<HTMLTextAreaElement>('textarea[data-phase]')
}

/** 编排器的 contenteditable 宿主（0.1.5 的 GUI 用的是富文本编排器，不是裸 textarea） */
function findComposerEditable(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  const column = document.querySelector('#root [data-slot="conversation"]')
  return (column ?? document).querySelector<HTMLElement>('[contenteditable="true"]')
}

/** 读输入框当前光标（值必须与草稿一致，否则认为读到的是旧状态） */
export function probeComposerCaret(draft: string): { start: number; end: number } | null {
  const el = findComposerTextarea()
  if (el === null || el.disabled || el.readOnly) return null
  if (el.value !== draft) return null
  let start = el.selectionStart
  let end = el.selectionEnd
  if (typeof start !== 'number' || typeof end !== 'number') return null
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  start = Math.max(0, Math.min(start, draft.length))
  end = Math.max(start, Math.min(end, draft.length))
  return { start, end }
}

/** 程序化 setDraft 之后把光标放回插入位置（值没落地就下一帧再试，最多两帧） */
export function placeComposerCaretAfterInsert(expectedDraft: string, caretIndex: number): void {
  let remaining = 2
  let scheduled = false
  const schedule = (fn: () => void): void => {
    if (scheduled) return
    scheduled = true
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(fn)
    else setTimeout(fn, 0)
  }
  const place = (): void => {
    scheduled = false
    if (remaining <= 0) return
    remaining -= 1
    const el = findComposerTextarea()
    if (el === null || el.disabled || el.readOnly) return
    if (el.value !== expectedDraft) {
      schedule(place)
      return
    }
    const clamped = Math.max(0, Math.min(caretIndex, el.value.length))
    el.setSelectionRange(clamped, clamped)
  }
  schedule(place)
}

/** 兜底：直接写宿主输入框（React 受控 textarea 用原生 setter + input 事件才认；
 *  富文本编排器（contenteditable）走聚焦 + insertText，两条路都是尽力而为） */
/** 兜底：直接写宿主输入框（React 受控 textarea 用原生 setter + input 事件才认；
 *  富文本编排器（contenteditable）走聚焦 + insertText，两条路都是尽力而为）。
 *  导出给「标注」等同页注入功能复用——它们此前只找 `textarea[data-phase]`，
 *  在这版宿主（编排器是 contenteditable）上会直接失败退化。 */
export function appendComposerTextDom(text: string, separator = ' '): boolean {
  return appendViaDom(text, separator)
}

function appendViaDom(text: string, separator: string): boolean {
  const ta = findComposerTextarea()
  if (ta) {
    try {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
      const existing = ta.value ?? ''
      const next = existing.trim() ? existing + separator + text : text
      if (setter) setter.call(ta, next)
      else ta.value = next
      ta.dispatchEvent(new Event('input', { bubbles: true }))
      try {
        ta.focus()
        ta.dispatchEvent(new Event('change', { bubbles: true }))
        ta.setSelectionRange(ta.value.length, ta.value.length)
      } catch { /* focus/selection 失败不影响文本已写入 */ }
      return true
    } catch { /* 继续试 contenteditable */ }
  }
  const editable = findComposerEditable()
  if (editable) {
    try {
      editable.focus()
      const existing = editable.textContent ?? ''
      const insert = existing.trim() ? separator + text : text
      // insertText 会触发富文本编辑器的 beforeinput/input，编排器才能把它收进草稿
      if (typeof document.execCommand === 'function' && document.execCommand('insertText', false, insert)) return true
      // 有些宿主禁用了 execCommand：退化为直接改 DOM 文本（编排器可能不认，但比什么都没有好）
      editable.textContent = existing + insert
      editable.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: insert }))
      return true
    } catch {
      return false
    }
  }
  return false
}

/** 用完整文本替换当前会话草稿，不触发发送；文案工作区使用。 */
export function replaceDraft(text: string, scope: { sessionId: string; cwd: string } | null): boolean {
  try {
    const conversation = services.conversation
    const sessions = services.sessions
    const actx = scope !== null && sessions?.scope ? sessions.scope(scope.sessionId) : undefined
    if (conversation?.input && actx !== undefined) {
      conversation.input.for(actx).setDraft(text)
      placeComposerCaretAfterInsert(text, text.length)
      return true
    }
  } catch { /* 落到 DOM 兜底 */ }

  const ta = findComposerTextarea()
  if (ta) {
    try {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
      if (setter) setter.call(ta, text)
      else ta.value = text
      ta.dispatchEvent(new Event('input', { bubbles: true }))
      ta.focus()
      ta.setSelectionRange(text.length, text.length)
      return true
    } catch { /* 继续试富文本 */ }
  }
  const editable = findComposerEditable()
  if (editable) {
    try {
      editable.focus()
      editable.textContent = text
      editable.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }))
      return true
    } catch { return false }
  }
  return false
}

/** 把一段文本插到草稿的光标处（服务可用时走服务，否则 DOM 追加） */
export function appendToDraft(text: string, scope: { sessionId: string; cwd: string } | null): boolean {
  try {
    const conversation = services.conversation
    const sessions = services.sessions
    const actx = scope !== null && sessions?.scope ? sessions.scope(scope.sessionId) : undefined
    if (conversation?.input && actx !== undefined) {
      const input = conversation.input.for(actx)
      const draft: string = input.state.getSnapshot().draft ?? ''
      const caret = probeComposerCaret(draft)
      const { draft: next, caretAfter } = spliceInsert(draft, text, caret)
      input.setDraft(next)
      placeComposerCaretAfterInsert(next, caretAfter)
      return true
    }
  } catch { /* 落到 DOM 兜底 */ }
  return appendViaDom(text, ' ')
}

/** 文件引用：优先结构化胶囊事件，失败返回 false（调用方再退纯文本） */
export function insertFileReference(relativePath: string, scope: { sessionId: string; cwd: string } | null): boolean {
  const reference = fileMention(relativePath)
  if (reference === undefined || scope === null) return false
  try {
    const conversation = services.conversation
    const sessions = services.sessions
    const actx: any = sessions?.scope ? sessions.scope(scope.sessionId) : undefined
    if (conversation?.input && actx !== undefined && typeof actx.emit === 'function') {
      const input = conversation.input.for(actx)
      const before = input.state.getSnapshot()
      if (before.draftRev === undefined) return false
      actx.emit('slash/input-insert-reference', {
        reference: {
          source: 'reference',
          ref: reference.mention,
          label: reference.label,
          appearance: 'file',
          clipboardText: reference.mention,
        },
        span: { draftRev: before.draftRev, start: before.draft.length, end: before.draft.length },
      })
      return input.state.getSnapshot().draftRev !== before.draftRev
    }
  } catch { /* 事件不可用：退纯文本 */ }
  return false
}

/**
 * 引用一个路径进对话输入框（不发送）：目录给 `@目录/`，文件优先结构化胶囊。
 * `path` 可以是绝对路径（会按 cwd 折成相对写法）。
 */
export function referenceInChat(path: string, isDir: boolean, scope: { sessionId: string; cwd: string } | null): ReferenceOutcome {
  const rel = relativeTo(scope?.cwd ?? '', path)
  if (isDir) {
    const text = `@${rel === '.' ? './' : `${rel}/`}`
    if (appendToDraft(text, scope)) return 'text'
    return appendViaDom(text, ' ') ? 'dom' : 'fail'
  }
  if (insertFileReference(rel, scope)) return 'chip'
  if (appendToDraft(`@${rel}`, scope)) return 'text'
  return appendViaDom(`@${rel}`, ' ') ? 'dom' : 'fail'
}
