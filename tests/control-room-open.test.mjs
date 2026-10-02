import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { existsSync } from 'node:fs'

const indexSource = readFileSync(new URL('../src/client/index.tsx', import.meta.url), 'utf8')
const splitSource = readFileSync(new URL('../src/client/split.tsx', import.meta.url), 'utf8')

test('control-room project cards open the existing split directly without main-panel switching', () => {
  assert.doesNotMatch(indexSource, /openControlRoomProject\(/, 'project opening must not use the removed control-room helper')
  assert.doesNotMatch(indexSource, /selectPanel\(null\)/, 'project opening must not clear or switch the official main panel')
  assert.doesNotMatch(indexSource, /waitForConversationRoot\(/, 'project opening must not wait for a main-panel transition')
  assert.match(indexSource, /const spec = \(view \?\? layout\) as LayoutSpec[\s\S]*?openSplit\(spec\)/, 'project opening must reuse openSplit directly')
  assert.doesNotMatch(splitSource, /waitForSessionRoot|waitForConversationRoot/, 'the split engine must not depend on the removed helper')
})

test('the obsolete control-room-open helper is removed', () => {
  assert.equal(existsSync(new URL('../src/client/control-room-open.ts', import.meta.url)), false)
})

test('control room opens directly without requiring a conversation binding', () => {
  assert.match(indexSource, /const clickConsoleCard = \([^)]*\) => \{\s*openConsole\(\)\s*\}/)
  const entry = indexSource.match(/<button[\s\S]*?dsh-mt_consoleEntry[\s\S]*?<\/button>/)?.[0] ?? ''
  assert.doesNotMatch(entry, /dsh-mt_bindBtn|openBindPick/)
})
