import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/client/index.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../src/client/styles.ts', import.meta.url), 'utf8')

test('mytable uses the official footer action while keeping the host sidebar DOM untouched', () => {
  assert.match(source, /ctx\.slots\.inject\(\s*['"]sidebar\.footer\.action['"]/, 'the official footer action must be registered')
  assert.match(source, /id:\s*['"]dsh-mytable-worktable['"]/, 'the footer action id must be stable')
  assert.match(source, /label:\s*['"]工作台['"]/, 'the footer action label must be stable')
  assert.match(source, /['"]sidebar\.worktable\.project['"]/, 'the root-scoped project child contract must remain available')
  assert.doesNotMatch(source, /ctx\.slots\.inject\(\s*['"]main['"]/, 'the worktable must not inject a full-screen main panel')
  assert.doesNotMatch(source, /ctx\.slots\.inject\(\s*['"]sidebar\.panellist['"]/, 'the worktable must not inject a panel-list item')
  assert.doesNotMatch(source, /layout\.selectPanel|selectWorktablePanel|PANEL_ID|PANEL_LABEL/, 'the footer action must not switch the main panel')
  assert.doesNotMatch(source, /dsh-mt_desktopEntry/)
  assert.doesNotMatch(source, /阿源的工作台/)
  assert.doesNotMatch(styles, /dsh-mt_desktop(?:Entry|Btn)/)

  assert.match(source, /ctx\.slots\.inject\(\s*['"]shell\.overlay['"]/, 'the split overlay remains available')
  assert.match(source, /setSplitEnv\(env\)/, 'splitEnv must still be installed')
  assert.match(source, /ctx\.slots\.subscribe\(['"]sidebar\.worktable\.project['"]/, 'project registration tracking remains')
  assert.match(source, /ctx\.provide\(['"]mytable['"]/, 'pane/viewer registration service remains')
  assert.match(source, /WorktableSettingsSection/, 'the official settings entry remains')
})
