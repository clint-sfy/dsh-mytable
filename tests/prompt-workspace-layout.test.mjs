import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

test('current requirement editor is one and a half times its former height', () => {
  const source = readFileSync(join(root, 'src/client/styles.ts'), 'utf8')
  assert.match(source, /\.dsh-mt_pwNeed\{min-height:165px;/)
})

test('collapsed prompt-workspace sidebar keeps every workspace icon visible', () => {
  const source = readFileSync(join(root, 'src/client/styles.ts'), 'utf8')
  assert.doesNotMatch(
    source,
    /\.dsh-mt_pwWsItem:not\(\[data-active=true\]\)\{display:none\}/,
    'collapsed mode must hide workspace names, not inactive workspace rows',
  )
})

test('template actions collapse into one menu beside the fill-current-chat button', () => {
  const source = readFileSync(join(root, 'src/client/prompt-workspaces-pane.tsx'), 'utf8')
  const actions = source.match(/<span className="dsh-mt_pwTemplateActions">([\s\S]*?)<\/span>/)?.[1] || ''
  assert.match(actions, /<details\b[^>]*className="dsh-mt_pwTemplateMenu">[\s\S]*<summary>模板操作[\s\S]*导入模板[\s\S]*导出模板[\s\S]*删除模板[\s\S]*<\/details>[\s\S]*填入当前聊天框/)
  assert.doesNotMatch(source, /className="dsh-mt_pwSubmit"[\s\S]*填入当前聊天框/)
})

test('collapsed workspace import/export buttons use workspace SVG icons and match workspace icon geometry', () => {
  const source = readFileSync(join(root, 'src/client/prompt-workspaces-pane.tsx'), 'utf8')
  const styles = readFileSync(join(root, 'src/client/styles.ts'), 'utf8')
  const actions = source.match(/<div className="dsh-mt_pwSideActions">([\s\S]*?)<\/div>/)?.[1] || ''
  const importButton = actions.match(/<button\b(?=[^>]*aria-label="导入工作区文件")[^>]*>[\s\S]*?<\/button>/)?.[0] || ''
  const exportButton = actions.match(/<button\b(?=[^>]*aria-label="导出到本地文件")[^>]*>[\s\S]*?<\/button>/)?.[0] || ''

  assert.ok(importButton && exportButton, 'both workspace file action buttons should exist')
  assert.doesNotMatch(`${importButton}${exportButton}`, /📥|📤/, 'use stable icons instead of raw import/export emoji')
  for (const [label, button] of [['import', importButton], ['export', exportButton]]) {
    assert.match(button, /<(?:WorkspaceIcon|WorkspaceTransferIcon|svg)\b/, `${label} button should use a stable SVG icon`)
  }

  const collapsedGeometry = styles.match(/\.dsh-mt_pw\[data-side-collapsed=true\] \.dsh-mt_pwWsIcon,\.dsh-mt_pw\[data-side-collapsed=true\] \.dsh-mt_pwSideActions button\{([^}]*)\}/)?.[1] || ''
  assert.match(collapsedGeometry, /width:28px;height:28px/, 'collapsed action and workspace icon buttons should have the same dimensions')
  assert.match(styles, /\.dsh-mt_pw button\{[^}]*border-radius:7px/, 'workspace icon and action buttons should share the same rounded corners')
})

test('template menu and fill-current-chat control share one aligned control height', () => {
  const source = readFileSync(join(root, 'src/client/styles.ts'), 'utf8')
  assert.match(source, /\.dsh-mt_pwTemplateActions\{[^}]*align-items:stretch/)
  assert.match(source, /\.dsh-mt_pwTemplateMenu>summary\{[^}]*height:30px[^}]*display:flex[^}]*align-items:center/)
  assert.match(source, /\.dsh-mt_pwFill\{[^}]*height:30px/)
})

test('template menu closes when clicking outside or pressing Escape', () => {
  const source = readFileSync(join(root, 'src/client/prompt-workspaces-pane.tsx'), 'utf8')
  assert.match(source, /templateMenuRef = useRef<HTMLDetailsElement/)
  assert.match(source, /closeOnOutsidePointer[\s\S]*?templateMenuRef\.current[\s\S]*?\.contains\([\s\S]*?document\.addEventListener\(['"]pointerdown['"],/)
  assert.match(source, /closeOnEscape[\s\S]*?key\s*!==\s*['"]Escape['"][\s\S]*?\.open\s*=\s*false[\s\S]*?document\.addEventListener\(['"]keydown['"],/)
  assert.ok(source.includes("removeEventListener('pointerdown', closeOnOutsidePointer, true)"))
  assert.ok(source.includes("removeEventListener('keydown', closeOnEscape)"))
})

test('collapsed workspace icon switches workspace instead of opening icon picker', () => {
  const source = readFileSync(join(root, 'src/client/prompt-workspaces-pane.tsx'), 'utf8')
  assert.match(source, /onClick=\{\(\) => sidebarCollapsed\s*\?\s*selectWorkspace\(item\.id\)\s*:\s*setIconWorkspaceId/)
})
