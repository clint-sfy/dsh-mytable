/**
 * 文件预览的「其它类型」渲染器：音频 / 视频 / CSV·TSV 表格 / 无法内嵌预览的文件。
 *
 * 补的是以前的空白：这些类型此前都落到「纯文本」分支——音视频变成一行行乱码、csv 是一大坨、
 * Office 文档与压缩包直接是二进制乱码。现在各自给合适的承载面，并把「打不开」的情况说清楚
 * （文件名 / 类型 / 大小 + 在浏览器中打开 + 复制路径 + @ 引用），而不是甩一屏乱码给用户。
 *
 * 表格解析是纯函数（`parseDelimited`），单测直接打靶；渲染只做有界展示（行/列上限 + 截断提示）。
 */
import { useEffect, useState } from 'react'
import { T } from './split'
import { basenameOf } from './pathutil'
import { copyText } from './clipboard'
import { FileGlyph } from './file-icons'
import { parseDelimited, TABLE_MAX_COLS, TABLE_MAX_ROWS } from './csv'

export { parseDelimited, TABLE_MAX_COLS, TABLE_MAX_ROWS } from './csv'

/** 人类可读的文件大小 */
function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

/** 音频：原生 <audio controls>（浏览器自带播放器）；附带下载/新标签打开 */
export function AudioView(props: { path: string; fileUrl: string }) {
  return (
    <div className="dsh-mt_mediaWrap" data-media-kind="audio">
      <div className="dsh-mt_mediaCard">
        <span className="dsh-mt_mediaIcon" aria-hidden><FileGlyph path={props.path} size={22} /></span>
        <span className="dsh-mt_mediaName" title={props.path}>{basenameOf(props.path)}</span>
        <audio className="dsh-mt_mediaAudio" data-media-player="audio" controls preload="metadata" src={props.fileUrl} />
      </div>
    </div>
  )
}

/** 视频：原生 <video controls>（浏览器自带控制条） */
export function VideoView(props: { path: string; fileUrl: string }) {
  return (
    <div className="dsh-mt_mediaWrap" data-media-kind="video">
      <video className="dsh-mt_mediaVideo" data-media-player="video" controls preload="metadata" src={props.fileUrl} />
    </div>
  )
}

/** CSV / TSV：解析成表格（首行当表头），有界展示 + 截断提示 */
export function TableView(props: { path: string; fileUrl: string }) {
  const [state, setState] = useState<{ rows: string[][]; truncated: boolean } | null>(null)
  const [error, setError] = useState('')
  const delimiter = /\.tsv$/i.test(props.path) ? '\t' : ','
  useEffect(() => {
    let dead = false
    setState(null)
    setError('')
    fetch(props.fileUrl)
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status)
        return r.text()
      })
      .then((text) => { if (!dead) setState(parseDelimited(text, delimiter)) })
      .catch((e) => { if (!dead) setError(String(e)) })
    return () => { dead = true }
  }, [props.fileUrl, delimiter])
  if (error !== '') return <div className="dsh-mt_paneWip"><span className="dsh-mt_paneWipText">{T('file.fail')}：{error}</span></div>
  if (state === null) return <div className="dsh-mt_paneWip"><span className="dsh-mt_paneWipText">{T('file.loading')}</span></div>
  const [head, ...body] = state.rows
  return (
    <div className="dsh-mt_tableWrap" data-table-rows={state.rows.length}>
      {state.rows.length === 0 && <div className="dsh-mt_exEmpty">{T('file.tableEmpty')}</div>}
      {state.rows.length > 0 && (
        <table className="dsh-mt_table">
          {head && (
            <thead>
              <tr>{head.map((cell, i) => <th key={i}>{cell}</th>)}</tr>
            </thead>
          )}
          <tbody>
            {body.map((row, r) => (
              <tr key={r}>{row.map((cell, c) => <td key={c}>{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      )}
      {state.truncated && (
        <div className="dsh-mt_tableNote">{T('file.tableTruncated', { rows: String(TABLE_MAX_ROWS), cols: String(TABLE_MAX_COLS) })}</div>
      )}
    </div>
  )
}

/**
 * 无法内嵌预览的文件（Office 文档 / 压缩包 / 可执行文件 / 字体…）：
 * 给「在浏览器中打开」（浏览器会自己下载或交给系统程序）、复制路径、@ 引用，
 * 以及类型与大小信息——不再把二进制当文本读成乱码。
 */
export function NoPreview(props: { path: string; fileUrl: string; kind: 'office' | 'binary' }) {
  const [note, setNote] = useState('')
  const [size, setSize] = useState('')
  const [mime, setMime] = useState('')
  useEffect(() => {
    let dead = false
    fetch(props.fileUrl, { method: 'HEAD' })
      .then((r) => {
        if (dead) return
        setMime(String(r.headers.get('content-type') ?? ''))
        const len = Number(r.headers.get('content-length'))
        setSize(formatSize(len))
      })
      .catch(() => { /* 拿不到就算了，不影响面板 */ })
    return () => { dead = true }
  }, [props.fileUrl])
  const open = (): void => { try { window.open(props.fileUrl, '_blank', 'noopener') } catch { /* 弹窗被拦就算了 */ } }
  return (
    <div className="dsh-mt_noPrev" data-nopreview-kind={props.kind}>
      <span className="dsh-mt_noPrevIcon" aria-hidden><FileGlyph path={props.path} size={34} /></span>
      <div className="dsh-mt_noPrevTitle">{basenameOf(props.path)}</div>
      <div className="dsh-mt_noPrevDesc">
        {T(props.kind === 'office' ? 'file.noPreviewOffice' : 'file.noPreviewBinary')}
      </div>
      {(mime !== '' || size !== '') && (
        <div className="dsh-mt_noPrevMeta">{[mime, size].filter((x) => x !== '').join(' · ')}</div>
      )}
      <div className="dsh-mt_noPrevActions">
        <button type="button" className="dsh-mt_noPrevBtn" data-nopreview-action="open" onClick={open}>
          {T('file.openExternal')}
        </button>
        <button
          type="button"
          className="dsh-mt_noPrevBtn"
          data-nopreview-action="copy"
          onClick={() => { void copyText(props.path).then((ok) => setNote(ok ? T('exp.copied') : T('exp.copyFail'))) }}
        >
          {T('exp.copyAbs')}
        </button>
      </div>
      {note !== '' && <div className="dsh-mt_noPrevNote">{note}</div>}
    </div>
  )
}
