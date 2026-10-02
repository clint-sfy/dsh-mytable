import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

test('package has no standalone Flowglass plugin entry', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  assert.equal(pkg.exports?.['./flowglass'], undefined)
  assert.ok(!pkg.files?.includes('flowglass-plugin/**'))
  assert.ok(!pkg.files?.includes('lib/flowglass-entry.js'))

  const patch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
  assert.doesNotMatch(patch, /flowglass/i)
})

test('top-level source starts Flowglass directly after exposing mytable', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const client = readFileSync(join(root, 'src/client/index.tsx'), 'utf8')
  const generated = readFileSync(join(root, 'src/client/flowglass-bundled.generated.js'), 'utf8')
  assert.ok(pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-session'))
  assert.match(client, /export const inject = \[[^\]]*['"]remote['"][^\]]*['"]timer['"]/s)
  assert.match(client, /import \{ createBundledFlowglassClient \} from ['"]\.\/flowglass-bundled\.generated\.js['"]/)
  assert.match(client, /ctx\.provide\(['"]mytable['"],[\s\S]*?window as any\)\.__dshMytable = service[\s\S]*?createBundledFlowglassClient\([\s\S]*?flowglassClient\.apply\(ctx\)/)
  assert.match(generated, /export function createBundledFlowglassClient/)
  assert.match(generated, /registerPaneType/)
  assert.match(generated, /const worktableOnly = RT\.bundleId === ['"]flow['"]/)
  assert.doesNotMatch(generated, /const worktableOnly = RT\.bundleId === ['"]flow['"][\s\S]{0,180}window\.__dshMytable/)
  const registerStart = generated.indexOf('const plugins = [createToolboxClient()')
  const remoteStart = generated.indexOf('const disposeRemote = await ctx.remote.$mount')
  assert.ok(registerStart >= 0 && remoteStart >= 0 && registerStart < remoteStart,
    'worktable pane must register before the optional Remote connection')
  assert.doesNotMatch(generated, /let host = null/, 'an early pane render must never observe a null host facade')
  assert.match(generated, /let host = \{[\s\S]*?call\(methodName, args\)[\s\S]*?Flowglass 服务正在连接/, 'early pane renders need a safe connecting facade')
})

test('top-level host source applies Flowglass without a child Cordis component', () => {
  const host = readFileSync(join(root, 'src/index.ts'), 'utf8')
  assert.match(host, /import \{ apply as applyFlowglassHost \} from ['"]dsh-flowglass['"]/) 
  assert.match(host, /export const inject = \[['"]webServer['"], ['"]sessions['"]\]/)
  assert.match(host, /inject\(\[['"]fs['"], ['"]sessionQuery['"], ['"]timer['"]\][\s\S]*?applyFlowglassHost\(flowCtx\)/)
  assert.doesNotMatch(host, /export const inject = \[[^\]]*['"]fs['"]/s)
})
