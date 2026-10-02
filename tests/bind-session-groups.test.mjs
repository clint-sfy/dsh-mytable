import assert from 'node:assert/strict'
import { bindableSessionGroups } from '../src/client/add-project-model.ts'

const groups = [
  { title: '未分组', sessions: [{ id: 'loose', title: '游离对话', isCurrent: false }] },
  { title: 'work_table', sessions: [{ id: 'bound', title: 'dsh-mytable', isCurrent: true }] },
]

assert.deepEqual(bindableSessionGroups(groups), [groups[1]])
assert.equal(groups.length, 2)
console.log('ok   bind session list hides ungrouped conversations')
