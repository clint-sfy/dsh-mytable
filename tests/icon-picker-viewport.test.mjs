import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('../src/client/index.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../src/client/styles.ts', import.meta.url), 'utf8')

test('icon picker stays inside the viewport and scrolls its icon grid', () => {
  assert.match(source, /maxHeight:\s*`calc\(100vh - \$\{iconPick\.y \+ 8\}px\)`/)
  assert.match(styles, /\.dsh-mt_iconPop\{[^}]*display:flex[^}]*overflow:hidden/)
  assert.match(styles, /\.dsh-mt_iconGrid\{[^}]*overflow-y:auto/)
  assert.match(styles, /\.dsh-mt_iconCell\{[^}]*min-height:36px/)
})
