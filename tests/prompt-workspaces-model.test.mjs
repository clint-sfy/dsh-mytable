import assert from 'node:assert/strict'
import test from 'node:test'
import { buildWorkspacePrompt, defaultPromptWorkspaceState, normalizePromptWorkspaceState } from '../src/client/prompt-workspaces-model.ts'

test('代码编程工作区默认只提供 TODO 模板', () => {
  const state = defaultPromptWorkspaceState()
  assert.deepEqual(state.workspaces[0].templates.map((item) => item.name), ['TODO'])
  assert.equal(state.selectedTemplateId, state.workspaces[0].templates[0].id)
})

test('旧默认模板迁移时只清理 PRD 和测试并保留用户模板', () => {
  const state = normalizePromptWorkspaceState({
    version: 1,
    selectedWorkspaceId: 'code',
    selectedTemplateId: 'prd',
    workspaces: [{
      id: 'code',
      name: '代码编程工作区',
      icon: 'builtin:laptop',
      templates: [
        { id: 'prd', name: 'PRD 编程', constraints: [], fixedTexts: [] },
        { id: 'todo', name: 'Todo 撰写', constraints: [], fixedTexts: ['保留内容'] },
        { id: 'test', name: '测试撰写', constraints: [], fixedTexts: [] },
        { id: 'mine', name: '我的模板', constraints: [], fixedTexts: [] },
      ],
    }],
  })
  assert.deepEqual(state.workspaces[0].templates.map((item) => item.name), ['TODO', '我的模板'])
  assert.deepEqual(state.workspaces[0].templates[0].fixedTexts, ['保留内容'])
  assert.equal(state.selectedTemplateId, 'todo')
})

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
  assert.match(prompt, /允许阅读、新建、修改和删除/)
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
