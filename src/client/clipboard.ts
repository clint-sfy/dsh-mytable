/**
 * 复制到剪贴板：`navigator.clipboard` 在非安全上下文 / 无权限时会拒，
 * 退化到隐藏 textarea + `execCommand('copy')`（老办法，但在这类宿主里仍可用）。
 * 资源管理器的「复制路径」与预览头的复制按钮共用。
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch { /* 退化到 execCommand */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.top = '-1000px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
