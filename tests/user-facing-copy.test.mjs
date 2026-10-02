import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const localePath = join(root, 'src', 'client', 'locales.ts')
const settingsPath = join(root, 'src', 'client', 'SettingsSection.tsx')

function localeValueLines() {
  return readFileSync(localePath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => /^\s*'[^']+'\s*:/.test(line))
    .join('\n')
}

test('user-facing copy avoids implementation and extension-registration details', () => {
  const copy = localeValueLines()
  for (const pattern of [
    /dsh\.mytable/i,
    /dsh-mytable/i,
    /IndexedDB/i,
    /localStorage/i,
    /ctx\.mytable/i,
    /registerPaneType/i,
    /registerFileViewer/i,
    /已注册插件类型/i,
    /插件注册/i,
    /开放接口/i,
    /PRD/i,
    /node-pty/i,
    /plugin registrations/i,
    /registered by a plugin/i,
    /extension API/i,
  ]) {
    assert.doesNotMatch(copy, pattern)
  }

  assert.match(copy, /'settings\.foot':\s*'项目、布局和设置保存在本机。'/)
  assert.match(copy, /'settings\.foot':\s*'Projects, layouts, and settings are stored on this device\.'/)
})

test('settings UI does not display internal type-registration counts', () => {
  const source = readFileSync(settingsPath, 'utf8')
  assert.doesNotMatch(source, /dsh-mt_setCount/)
  assert.doesNotMatch(source, /PANE_PREF_KEYS\.length\s*\+\s*registry\.panes\.length/)
  assert.doesNotMatch(source, /PREVIEW_FAMILIES\.length\s*\+\s*registry\.viewers\.length/)
})
