import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const compat = await import('../src/client/desktop-compat.ts').catch((error) => {
  if (error?.code === 'ERR_MODULE_NOT_FOUND') return null
  throw error
})
const isDesktopApp = compat?.isDesktopApp
const resolveWebSocketOrigin = compat?.resolveWebSocketOrigin

test('detects the Desktop dsh-app://app location', () => {
  assert.equal(typeof isDesktopApp, 'function', 'desktop compatibility module is missing')
  assert.equal(isDesktopApp({ protocol: 'dsh-app:', hostname: 'app' }), true)
  assert.equal(isDesktopApp({ protocol: 'https:', hostname: 'app' }), false)
  assert.equal(isDesktopApp({ protocol: 'dsh-app:', hostname: 'other' }), false)
  assert.equal(isDesktopApp(undefined), false)
})

test('converts an http or https transport webOrigin to ws or wss', () => {
  assert.equal(typeof resolveWebSocketOrigin, 'function', 'desktop compatibility module is missing')
  assert.equal(
    resolveWebSocketOrigin('http://127.0.0.1:4312', 'https://web.example.test'),
    'ws://127.0.0.1:4312',
  )
  assert.equal(
    resolveWebSocketOrigin('https://desktop.example.test:8443', 'http://web.example.test'),
    'wss://desktop.example.test:8443',
  )
})

test('falls back to location.origin when webOrigin is invalid or missing', () => {
  assert.equal(typeof resolveWebSocketOrigin, 'function', 'desktop compatibility module is missing')
  assert.equal(
    resolveWebSocketOrigin('file:///tmp/dsh', 'https://web.example.test:9443'),
    'wss://web.example.test:9443',
  )
  assert.equal(
    resolveWebSocketOrigin('https://web.example.test/path', 'http://web.example.test:3000'),
    'ws://web.example.test:3000',
  )
  assert.equal(
    resolveWebSocketOrigin(undefined, 'http://web.example.test:3000'),
    'ws://web.example.test:3000',
  )
})

test('fails closed for dsh-app://app when the transport origin is missing or invalid', () => {
  assert.equal(resolveWebSocketOrigin(undefined, 'dsh-app://app'), null)
  assert.equal(resolveWebSocketOrigin('file:///tmp/dsh', 'dsh-app://app'), null)
  assert.equal(resolveWebSocketOrigin('ws://desktop.example.test:4312', 'dsh-app://app'), null)
})

test('TerminalPane guards invalid WebSocket origins and reuses cleanup for failed setup', () => {
  const source = readFileSync(new URL('../src/client/split.tsx', import.meta.url), 'utf8')
  const terminal = source.slice(source.indexOf('function TerminalPane()'), source.indexOf('\n/** markdown 渲染器'))
  const originGuard = terminal.indexOf('if (wsOrigin === null)')
  const constructor = terminal.indexOf('new WebSocket(url)')
  assert.ok(originGuard >= 0, 'TerminalPane must fail before constructing a URL from a null origin')
  assert.ok(originGuard < constructor, 'invalid origin must be handled before WebSocket construction')
  assert.match(terminal, /const cleanup = \(\) => \{[\s\S]*unsubTheme[\s\S]*removeEventListener[\s\S]*term\?\.dispose/)
  assert.match(terminal.slice(constructor), /catch \{[\s\S]*cleanup\(\)/)
})

test('TerminalPane cleans up before reporting a WebSocket error', () => {
  const source = readFileSync(new URL('../src/client/split.tsx', import.meta.url), 'utf8')
  const terminal = source.slice(source.indexOf('function TerminalPane()'), source.indexOf('\n/** markdown 渲染器'))
  const cleanup = terminal.indexOf('const cleanup = () => {')
  const onerror = terminal.indexOf('ws.onerror =')
  const onData = terminal.indexOf('\n    term.onData', onerror)
  assert.ok(cleanup >= 0, 'TerminalPane must define a shared cleanup function')
  assert.ok(onerror > cleanup, 'WebSocket error handling must use the shared cleanup function')
  assert.match(terminal.slice(cleanup, onerror), /if \(disposed\) return/)
  const onerrorBlock = terminal.slice(onerror, onData)
  const cleanupCall = onerrorBlock.indexOf('cleanup()')
  const failedCall = onerrorBlock.indexOf("setFailed(T('pane.termFail'))")
  assert.ok(cleanupCall >= 0, 'WebSocket errors must invoke cleanup')
  assert.ok(failedCall >= 0, 'WebSocket errors must report the terminal failure')
  assert.ok(cleanupCall < failedCall, 'WebSocket errors must clean up before reporting failure')
})
