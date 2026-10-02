import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { addProjectSessionBinding, captureCurrentSessionId, sessionTitleOf } from '../src/client/add-project-model.ts'

const source = readFileSync(new URL('../src/client/index.tsx', import.meta.url), 'utf8')

test('pure add-project binding captures only the host current conversation', () => {
  assert.equal(captureCurrentSessionId({ current: 'session-current' }), 'session-current')
  assert.equal(
    captureCurrentSessionId({ current: 'stale-session' }, '{"sessionId":"desktop-current"}'),
    'desktop-current',
  )
  assert.equal(captureCurrentSessionId({ current: 'session-current' }, '{broken'), 'session-current')
  assert.equal(captureCurrentSessionId({ current: '' }), '')
  assert.deepEqual(addProjectSessionBinding({ current: 'session-current' }), { sessionId: 'session-current', canSave: true })
  assert.deepEqual(
    addProjectSessionBinding({ current: '' }, '{"sessionId":"desktop-current"}'),
    { sessionId: 'desktop-current', canSave: true },
  )
  assert.deepEqual(addProjectSessionBinding({ current: '' }), { sessionId: '', canSave: false })
  assert.equal(sessionTitleOf([{ sessions: [{ id: 'session-current', title: 'Current chat' }] }], 'session-current'), 'Current chat')
  assert.equal(sessionTitleOf([{ sessions: [{ id: 'first', title: 'First chat' }] }], ''), '')
})

test('add-project form captures the clicked current conversation and never falls back to the first session', () => {
  assert.match(source, /localStorage\.getItem\(['"]dsh\.sessions\.current['"]\)/, 'the add form must read the desktop current-session bridge')
  assert.match(source, /captureCurrentSessionId\(/, 'the add form must resolve the current conversation at open time')
  assert.match(source, /setWsSessionId\(capturedSessionId\)/, 'the captured conversation must be retained while the form loads')
  assert.doesNotMatch(source, /sessions\.find\([\s\S]*\)\?\.id\s*\?\?\s*sessions\[0\]\?\.id/, 'the add form must not fall back to the first session')
  assert.match(source, /add\.sessionCurrentUnavailable/, 'missing current conversation needs an explicit user-facing message')
  assert.match(source, /wsSessionId\s*&&[\s\S]*saveLayout|if \(!wsSessionId\)/, 'saving must remain blocked without a captured conversation')
})

test('the add-project form is rendered by the official footer runtime', () => {
  assert.match(source, /function WorktableFooterAction\s*\([^)]*\)/, 'official footer action must mount the worktable runtime')
  assert.match(source, /footerAction[\s\S]*addOpen|addOpen[\s\S]*footerAction/, 'footer runtime must keep the add form render path')
  assert.match(source, /className=\"dsh-mt_add/, 'the add-project form markup must remain present')
})

test('add-project modal is centered and conversation binding is selectable', () => {
  assert.match(source, /left:\s*'50%'[\s\S]*top:\s*'50%'[\s\S]*translate\(-50%,-50%\)/)
  assert.match(source, /<select[^>]*className="dsh-mt_sessionSelect"/)
  assert.match(source, /setWsSessionId\(e\.target\.value\)/)
  assert.match(source, /setWsSessionGroups\(bindableSessionGroups\(res\.groups\)\)/, 'new-project binding must hide ungrouped conversations too')
})
