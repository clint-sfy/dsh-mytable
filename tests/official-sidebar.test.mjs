import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/client/index.tsx', import.meta.url), 'utf8')

test('official sidebar uses the stable footer action and root-scoped project contract', () => {
  const footer = source.match(/ctx\.slots\.inject\(\s*['"]sidebar\.footer\.action['"][\s\S]*?ctx\.slots\.register\(\{([\s\S]*?)\},\s*WorktableFooterAction\)/)?.[1]

  assert.ok(footer, 'official footer action registration is missing')
  assert.match(footer, /name:\s*['"]sidebar\.footer\.action['"]/, 'footer action must use the official slot name')
  assert.match(footer, /id:\s*['"]dsh-mytable-worktable['"]/, 'footer action id must be stable')
  assert.match(footer, /order:\s*120\b/, 'footer action order must be stable')
  assert.match(footer, /label:\s*['"]工作台['"]/, 'footer action label must be stable')
  assert.match(footer, /children\s*:\s*\{[\s\S]*['"]sidebar\.worktable\.project['"]\s*:\s*\{[\s\S]*kind:\s*['"]list['"][\s\S]*scope:\s*['"]root['"]/, 'footer action must expose the root-scoped project child contract')
})

test('footer action does not register or select an official main panel', () => {
  assert.doesNotMatch(source, /ctx\.slots\.inject\(\s*['"]main['"]/, 'worktable must not register a full-screen main panel')
  assert.doesNotMatch(source, /ctx\.slots\.inject\(\s*['"]sidebar\.panellist['"]/, 'worktable must not register a panel-list entry')
  assert.doesNotMatch(source, /layout\.selectPanel|selectWorktablePanel|PANEL_ID|PANEL_LABEL/, 'footer action must not select a main panel')
  assert.doesNotMatch(source, /dsh-mt_desktop(?:Entry|Btn)/, 'legacy DOM sidebar injection must stay removed')
  assert.match(source, /ctx\.slots\.inject\(\s*['"]shell\.overlay['"]/, 'the existing split overlay must remain available')
})

test('footer action mounts the worktable entry with a stable overridable icon', () => {
  assert.match(source, /function WorktableFooterAction\s*\([^)]*\)/, 'official footer action component is missing')
  assert.match(source, /\},\s*WorktableFooterAction\)/, 'footer action must mount the worktable entry component')
  assert.match(source, /projects\.iconOverrides\[CONSOLE_ID\]\s*\?\?\s*CONSOLE_ICON/, 'worktable icon must retain a stable default and support overrides')
  assert.match(source, /function WorktableSection\s*\([^)]*\)/, 'worktable section runtime is missing')
  assert.doesNotMatch(source, /if \(runtimeOnly\) return null/, 'runtimeOnly must not suppress the form runtime')
})

test('footer action keeps the project list and icon picker mounted', () => {
  assert.doesNotMatch(source, /if \(footerAction\)\s*\{\s*return/, 'footer action must not return before the project list')
  assert.match(source, /className="dsh-mt_projects"/, 'official sidebar worktable must render its projects')
  assert.match(source, /openIconPick\('project',\s*CONSOLE_ID/, 'the worktable icon must open the shared icon picker')
  assert.match(source, /projects\.iconOverrides\[CONSOLE_ID\]/, 'the selected worktable icon must be rendered')
})

test('official account and settings popovers never move the docked worktable', () => {
  assert.doesNotMatch(source, /measureBottomOverlay|bottomInset/, 'worktable must not scan or offset itself for host bottom popovers')
  assert.doesNotMatch(source, /querySelectorAll<HTMLElement>\(['"]body \*['"]\)/, 'host popovers must not be mistaken for sidebar docks')
})
