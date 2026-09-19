import assert from 'node:assert/strict'
import test from 'node:test'
import { buildWorkspacePrompt, normalizePromptWorkspaceState } from '../src/client/prompt-workspaces-model.ts'

test('文案严格按限制文件、固定要求、当前需求排列', () => {
  const prompt = buildWorkspacePrompt({
    id: 'prd', name: 'PRD 编程',
    constraints: [
      { id: 'a', path: 'docs/architecture.md', mode: 'read', note: '沿用领域语言' },
      { id: 'b', path: 'src/app.ts', mode: 'editable', note: '' },
    ],
    fixedTexts: ['先给方案', '完成后测试'],
  }, '增加导出按钮')
  assert.ok(prompt.indexOf('【限制文件】') < prompt.indexOf('【固定要求】'))
  assert.ok(prompt.indexOf('【固定要求】') < prompt.indexOf('【当前需求】'))
  assert.equal(prompt.endsWith('增加导出按钮'), true)
  assert.match(prompt, /仅允许阅读，不要修改/)
  assert.match(prompt, /允许阅读和修改/)
})

test('导入拒绝未知版本', () => {
  assert.throws(() => normalizePromptWorkspaceState({ version: 2, workspaces: [] }), /不支持/)
})

test('导入会修复失效的选中项', () => {
  const state = normalizePromptWorkspaceState({
    version: 1, selectedWorkspaceId: 'missing', selectedTemplateId: 'missing',
    workspaces: [{ id: 'ws', name: '代码', templates: [{ id: 'prd', name: 'PRD', constraints: [], fixedTexts: [] }] }],
  })
  assert.equal(state.selectedWorkspaceId, 'ws')
  assert.equal(state.selectedTemplateId, 'prd')
})

test('尚未填路径的限制项也能导出后再导入', () => {
  const state = normalizePromptWorkspaceState({
    version: 1, selectedWorkspaceId: 'ws', selectedTemplateId: 'prd',
    workspaces: [{ id: 'ws', name: '代码', templates: [{
      id: 'prd', name: 'PRD', constraints: [{ id: 'pending', path: '', mode: 'read', note: '' }], fixedTexts: [],
    }] }],
  })
  assert.equal(state.workspaces[0].templates[0].constraints[0].path, '')
})
