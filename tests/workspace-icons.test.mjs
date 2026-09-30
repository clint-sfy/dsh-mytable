import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import * as iconSet from '../src/client/icon-set.ts'
import { normalizePromptWorkspaceState } from '../src/client/prompt-workspaces-model.ts'

test('工作区图标选择集使用稳定 builtin ID', () => {
  assert.ok(iconSet.WORKSPACE_ICONS.length >= 36)
  assert.ok(iconSet.WORKSPACE_ICONS.every((icon) => /^builtin:[a-z0-9-]+$/.test(icon)))
})

test('文案工作区导入会把旧 emoji 映射为 builtin ID 并保留未知文本', () => {
  const state = normalizePromptWorkspaceState({
    version: 1,
    selectedWorkspaceId: 'old',
    selectedTemplateId: 'template',
    workspaces: [
      { id: 'old', name: '旧数据', icon: '🧪', templates: [{ id: 'template', name: '模板', constraints: [], fixedTexts: [] }] },
      { id: 'custom', name: '自定义', icon: '品牌字母', templates: [{ id: 'template-2', name: '模板', constraints: [], fixedTexts: [] }] },
    ],
  })
  assert.equal(state.workspaces[0].icon, 'builtin:flask')
  assert.equal(state.workspaces[1].icon, '品牌字母')
})

test('内置图标输出固定颜色 inline SVG，未知字符串输出安全文本', () => {
  assert.equal(typeof iconSet.workspaceIconSvgMarkup, 'function')
  const svg = iconSet.workspaceIconSvgMarkup('🧪')
  assert.match(svg, /^<svg /)
  assert.match(svg, /data-workspace-icon="builtin:flask"/)
  assert.match(svg, /#[0-9a-f]{6}/i)
  assert.doesNotMatch(svg, /🧪/)

  const fallback = iconSet.workspaceIconSvgMarkup('<品牌>')
  assert.match(fallback, /data-workspace-icon-fallback/)
  assert.match(fallback, /&lt;品牌&gt;/)
  assert.doesNotMatch(fallback, /<品牌>/)
})

test('DOM 桥使用 inline SVG 覆盖图标并能恢复宿主原始 DOM', () => {
  assert.equal(typeof iconSet.applyWorkspaceIconToElement, 'function')
  const attrs = new Map()
  const element = {
    innerHTML: '<span>宿主图标</span>',
    setAttribute(name, value) { attrs.set(name, value) },
    removeAttribute(name) { attrs.delete(name) },
  }
  iconSet.applyWorkspaceIconToElement(element, '🧪')
  assert.match(element.innerHTML, /<svg /)
  assert.equal(attrs.get('data-workspace-icon-id'), 'builtin:flask')
  assert.equal(attrs.has('data-mt-icon'), false)
  iconSet.clearWorkspaceIconOverride(element)
  assert.equal(element.innerHTML, '<span>宿主图标</span>')
  assert.equal(attrs.has('data-workspace-icon-id'), false)
})

test('DOM 桥对同一规范化图标幂等，不重复写入并仍能恢复原始 DOM', () => {
  let html = '<span>宿主图标</span>'
  let innerHTMLWrites = 0
  let setAttributeWrites = 0
  const attrs = new Map()
  const element = {
    get innerHTML() { return html },
    set innerHTML(value) { innerHTMLWrites++; html = value },
    getAttribute(name) { return attrs.get(name) ?? null },
    setAttribute(name, value) { setAttributeWrites++; attrs.set(name, value) },
    removeAttribute(name) { attrs.delete(name) },
  }

  iconSet.applyWorkspaceIconToElement(element, '🧪')
  const appliedMarkup = element.innerHTML
  iconSet.applyWorkspaceIconToElement(element, 'builtin:flask')

  assert.equal(element.innerHTML, appliedMarkup)
  assert.equal(innerHTMLWrites, 1)
  assert.equal(setAttributeWrites, 1)
  iconSet.clearWorkspaceIconOverride(element)
  assert.equal(element.innerHTML, '<span>宿主图标</span>')
})

test('项目主链路统一使用 workspace icon renderer', () => {
  const files = [
    'src/client/index.tsx',
    'src/client/prompt-workspaces-pane.tsx',
    'src/client/split.tsx',
  ].map((path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'))
  for (const source of files) assert.match(source, /WorkspaceIcon/)
  const styles = readFileSync(new URL('../src/client/styles.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(styles, /data-mt-icon\]\:\:before\{content:attr\(data-mt-icon\)/)
})
