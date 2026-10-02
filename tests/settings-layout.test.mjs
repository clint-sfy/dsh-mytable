import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('../src/client/index.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../src/client/styles.ts', import.meta.url), 'utf8')

test('settings panel is wide enough for one-line footer controls', () => {
  assert.match(source, /dsh-mt_settings[^\n]*width:\s*'min\(380px,calc\(100vw - 24px\)\)'/)
  assert.match(styles, /\.dsh-mt_versionRow\{[^}]*white-space:nowrap/)
  assert.match(styles, /\.dsh-mt_versionActions\{[^}]*flex:none/)
  assert.match(styles, /\.dsh-mt_updateBtn\{[^}]*white-space:nowrap/)
})

test('host settings and account popovers cannot offset the worktable', () => {
  assert.doesNotMatch(source, /measureBottomOverlay|bottomInset/)
  assert.doesNotMatch(source, /querySelectorAll<HTMLElement>\(['"]body \*['"]\)/)
})
