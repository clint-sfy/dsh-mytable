import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const manifest = JSON.parse(readFileSync(new URL('../dsh.plugin.json', import.meta.url), 'utf8'))
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')
const indexSource = readFileSync(new URL('../src/client/index.tsx', import.meta.url), 'utf8')
const locales = readFileSync(new URL('../src/client/locales.ts', import.meta.url), 'utf8')

test('package metadata describes the user-facing worktable without implementation details', () => {
  for (const description of [pkg.description, manifest.description]) {
    assert.equal(typeof description, 'string')
    assert.doesNotMatch(description, /localStorage|IndexedDB|API|agent 级|标准插件包|应用抽屉/i)
    assert.match(description, /工作台/)
  }
})

test('README describes the official panel entry and local artifact without stale sidebar copy', () => {
  assert.match(readme, /官方.*面板|面板.*工作台/)
  assert.doesNotMatch(readme, /工作台侧边栏|侧边栏应出现工作台入口|localStorage|IndexedDB/i)
  assert.doesNotMatch(readme, /GitHub Release URL|releases\/download\/v0\.1\.1/i)
})

test('visible locale and generated control-room copy do not expose the old sidebar model', () => {
  assert.match(locales, /'rail\.title':\s*'工作台'/)
  assert.match(locales, /'rail\.title':\s*'Worktable'/)
  assert.match(locales, /'settings\.nav':\s*'工作台'/)
  assert.doesNotMatch(locales, /注册它的插件已卸载/)
  assert.doesNotMatch(indexSource, /侧边栏底部「工作台」区块|侧边栏里的项目应用抽屉|侧边栏底部的自建「工作台」插件/)
})
