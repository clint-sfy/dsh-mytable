import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const styles = readFileSync(new URL('../src/client/styles.ts', import.meta.url), 'utf8')

test('workspace files use the compact Harness file-tree geometry', () => {
  assert.match(styles, /\.dsh-mt_exp\{[^}]*font-size:var\(--dsh-content-font-size-secondary,13px\)/)
  assert.match(styles, /\.dsh-mt_exBody\{[^}]*padding:4px 0 8px/)
  assert.match(styles, /\.dsh-mt_exRow\{[^}]*border-radius:6px[^}]*padding:3px 10px/)
  assert.doesNotMatch(styles, /\.dsh-mt_exRow\{[^}]*height:34px/)
})

test('terminal uses the Harness screen spacing and typography', () => {
  assert.match(styles, /\.dsh-mt_termHost\{[^}]*box-sizing:border-box[^}]*padding:8px[^}]*font-size:13px/)
  assert.match(styles, /\.dsh-mt_termHost\{[^}]*background:var\(--dsw-alias-bg-base/)
})

test('fixed prompt textarea is twice the previous height', () => {
  assert.match(styles, /\.dsh-mt_pwFixed textarea\{[^}]*min-height:116px/)
})
