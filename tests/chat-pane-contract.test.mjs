import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/client/split.tsx', import.meta.url), 'utf8')

test('split layout keeps the host chat pane as the trailing right column', () => {
  assert.match(source, /this\.spec\s*=\s*\{\s*\.\.\.spec,\s*chatSide:\s*['"]right['"],\s*chatFullHeight:\s*true\s*\}/, 'opened layouts must normalize chat to the rightmost full-height column')
  assert.match(source, /const contentW\s*=\s*Math\.max\(0,\s*colW\s*-\s*chatW\)/, 'content panes must consume the width before the chat column')
  assert.match(source, /chatLeft\s*\?\s*g\.left\s*\+\s*chatW\s*:\s*g\.right\s*-\s*chatW/, 'the chat divider must be anchored from the right edge')
  assert.match(source, /viewArea\.style\.margin(?:Left|Right)\s*=\s*margin(?:Left|Right)/, 'the existing host chat view area must be shifted, not replaced')
})

test('opening a split never removes the host conversation root or input subtree', () => {
  assert.doesNotMatch(source, /(?:root|viewArea)\.(?:remove|removeChild)\(/, 'split opening must keep the host conversation root in the DOM')
  assert.doesNotMatch(source, /root\.innerHTML\s*=|viewArea\.innerHTML\s*=/, 'split opening must not replace the host chat/input DOM')
  assert.match(source, /this\.viewArea\s*=\s*viewArea/, 'the host view area remains the chat pane anchor')
})

test('opening a project switches to its bound conversation before revealing the workspace', () => {
  const indexSource = readFileSync(new URL('../src/client/index.tsx', import.meta.url), 'utf8')
  assert.match(
    indexSource,
    /const openSplit = useCallback\(async[\s\S]*?await sessionBridge\?\.sessions\?\.open\?\.\(bound\)[\s\S]*?splitStore\.open\(/,
    'the Desktop chat switch must settle before the split workspace is shown',
  )
})
