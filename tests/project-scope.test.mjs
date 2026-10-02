import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveProjectScope } from '../src/client/project-scope.ts'

test('active project folder overrides the bound conversation cwd', () => {
  assert.deepEqual(
    resolveProjectScope({ sessionId: 'chat-current', cwd: 'C:\\Users\\clint\\Desktop' }, 'project-1', { 'project-1': 'C:\\MyProject\\demo' }, { 'project-1': 'chat-project' }),
    { sessionId: 'chat-project', cwd: 'C:\\MyProject\\demo' },
  )
})

test('bound project supplies its session before the host current-chat snapshot is ready', () => {
  assert.deepEqual(
    resolveProjectScope(null, 'project-1', { 'project-1': 'C:\\MyProject\\demo' }, { 'project-1': 'chat-project' }),
    { sessionId: 'chat-project', cwd: 'C:\\MyProject\\demo' },
  )
})

test('scope keeps conversation cwd when project has no folder binding', () => {
  assert.deepEqual(resolveProjectScope({ sessionId: 'chat-1', cwd: 'C:\\work' }, 'project-1', {}), { sessionId: 'chat-1', cwd: 'C:\\work' })
})
