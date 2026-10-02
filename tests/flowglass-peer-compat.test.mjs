import test from 'node:test'
import assert from 'node:assert/strict'
import { gunzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

function readPackageJsonFromTgz(file) {
  const tar = gunzipSync(readFileSync(file))
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512)
    const name = header.toString('utf8', 0, 100).replace(/\0.*$/, '')
    if (!name) break
    const size = Number.parseInt(header.toString('utf8', 124, 136).replace(/\0.*$/, '').trim() || '0', 8)
    const bodyStart = offset + 512
    if (name === 'package/package.json') {
      return JSON.parse(tar.subarray(bodyStart, bodyStart + size).toString('utf8'))
    }
    offset = bodyStart + Math.ceil(size / 512) * 512
  }
  throw new Error(`package/package.json not found in ${file}`)
}

function readTextFromTgz(file, wanted) {
  const tar = gunzipSync(readFileSync(file))
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512)
    const name = header.toString('utf8', 0, 100).replace(/\0.*$/, '')
    if (!name) break
    const size = Number.parseInt(header.toString('utf8', 124, 136).replace(/\0.*$/, '').trim() || '0', 8)
    const bodyStart = offset + 512
    if (name === wanted) return tar.subarray(bodyStart, bodyStart + size).toString('utf8')
    offset = bodyStart + Math.ceil(size / 512) * 512
  }
  throw new Error(`${wanted} not found in ${file}`)
}

test('Flowglass build source covers DSH 0.2.0-rc.2 without becoming a runtime sub-plugin', () => {
  const mytable = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const dependency = mytable.devDependencies?.['dsh-flowglass']
  assert.match(dependency, /^file:vendor\/dsh-flowglass-0\.7\.4\.tgz$/)
  assert.equal(mytable.dependencies?.['dsh-flowglass'], undefined)
  assert.ok(!mytable.bundledDependencies?.includes('dsh-flowglass'))

  const flowglass = readPackageJsonFromTgz(join(root, dependency.slice('file:'.length)))
  assert.equal(flowglass.version, '0.7.4')
  for (const peer of [
    '@deepseek-ai/dsh-typert-protocol',
    '@deepseek-ai/dsh-client-ui-primitives',
  ]) {
    assert.match(
      flowglass.peerDependencies?.[peer] ?? '',
      /(?:^|\|\|\s*)\^0\.2\.0-rc\.2(?:\s*\|\||$)/,
      `${peer} must include a ^0.2.0-rc.2-compatible alternative`,
    )
  }
})

test('top-level client source contains the Flowglass pane registration', () => {
  const client = readFileSync(join(root, 'src', 'client', 'flowglass-bundled.generated.js'), 'utf8')
  assert.match(client, /registerPaneType/)
  assert.match(client, /dsh-flowglass:flow/)
})

test('vendored Flowglass registers its built-in tool immediately before timer-based healing', () => {
  const mytable = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const dependency = mytable.devDependencies['dsh-flowglass']
  const host = readTextFromTgz(join(root, dependency.slice('file:'.length)), 'package/flowglass/lib/index.js')
  const immediate = host.indexOf('\n  once()\n  let ivSlow = null')
  const retryTimer = host.indexOf('const ivFast = ctx.interval', immediate)
  assert.ok(immediate >= 0 && retryTimer > immediate, 'built-in flow tool must register before the retry timer starts')
})
