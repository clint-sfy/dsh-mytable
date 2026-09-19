/**
 * CSV / TSV 解析（纯函数，单测直接打靶）：RFC4180 风格的引号处理
 * （`""` 转义成 `"`、引号内可含分隔符与换行），并做**有界**解析——
 * 超过行/列上限的部分直接丢弃并置 `truncated`，避免几万行 CSV 一次性塞进 DOM。
 */

/** 表格展示上限 */
export const TABLE_MAX_ROWS = 500
export const TABLE_MAX_COLS = 40

export function parseDelimited(text: string, delimiter: string): { rows: string[][]; truncated: boolean } {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let truncated = false
  const pushField = (): void => {
    if (row.length < TABLE_MAX_COLS) row.push(field)
    else truncated = true
    field = ''
  }
  const pushRow = (): void => {
    pushField()
    if (rows.length < TABLE_MAX_ROWS) rows.push(row)
    else truncated = true
    row = []
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else quoted = false
      } else field += ch
      continue
    }
    if (ch === '"' && field === '') { quoted = true; continue }
    if (ch === delimiter) { pushField(); continue }
    if (ch === '\r') continue
    if (ch === '\n') { pushRow(); continue }
    field += ch
  }
  // 末尾没有换行时收最后一格 / 最后一行
  if (field !== '' || row.length > 0) pushRow()
  return { rows, truncated }
}
