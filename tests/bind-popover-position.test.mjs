import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('../src/client/index.tsx', import.meta.url), 'utf8')

test('binding popover stays vertically centered on the clicked project row', () => {
  assert.match(source, /const y = clamp\(Math\.round\(r\.top \+ r\.height \/ 2\)/)
  assert.match(source, /dsh-mt_bindPop[^\n]*translateY\(-50%\)/)
})

test('binding buttons use native lightweight titles instead of a black body tooltip', () => {
  assert.doesNotMatch(source, /showBindTip\(|dsh-mytable: bind tip/)
  assert.match(source, /bindBtn\.setAttribute\('title', tip\)/)
})
