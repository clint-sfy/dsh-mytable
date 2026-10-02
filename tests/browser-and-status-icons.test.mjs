import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const icons = readFileSync(new URL('../src/client/browser-icons.tsx', import.meta.url), 'utf8')
const index = readFileSync(new URL('../src/client/index.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../src/client/styles.ts', import.meta.url), 'utf8')

test('browser go is an in-window arrow while external keeps the box-out glyph', () => {
  const go = icons.match(/export function IconGo[\s\S]*?\n}/)?.[0] ?? ''
  const external = icons.match(/export function IconExternal[\s\S]*?\n}/)?.[0] ?? ''
  assert.match(go, /<circle/)
  assert.match(go, /M5 8h6/)
  assert.doesNotMatch(go, /M6\.2 9\.8 12 4/)
  assert.match(external, /M13\.5 2\.5 8 8/)
})

test('conversation binding stays visible as a bubble and uses a spinner only while busy', () => {
  assert.match(index, /dsh-mt_bindState/)
  assert.doesNotMatch(index, /dsh-mt_bindCircles/)
  assert.match(styles, /\.dsh-mt_bindState\{[^}]*border:[^;}]*solid currentColor/)
  assert.match(styles, /\.dsh-mt_bindState::after\{[^}]*border-left:[^;}]*solid currentColor/)
  assert.doesNotMatch(styles, /\.dsh-mt_bindState\{[^}]*display:none/)
  assert.match(styles, /data-bound=busy[^}]*\.dsh-mt_bindState[^}]*border:0/)
  assert.match(styles, /dsh-state-dot-spin/)
  assert.match(styles, /dsh-state-dot-dash/)
  assert.match(styles, /prefers-reduced-motion:reduce/)
})

test('control-room cards keep icon and name until icon-only width', () => {
  assert.match(styles, /@container \(max-width:150px\)[^{]*\{[^}]*dsh-mt_consoleCardHead/)
  assert.match(styles, /@container \(max-width:78px\)[^{]*\{[^}]*dsh-mt_consoleName/)
  assert.doesNotMatch(styles, /@container \(max-width:118px\)[^{]*\{[^}]*dsh-mt_consoleName/)
})
