import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const plugin = await import('../lib/index.js')
const addPluginSource = readFileSync(new URL('../src/client/AddPluginModal.tsx', import.meta.url), 'utf8')
const settingsSource = readFileSync(new URL('../src/client/SettingsSection.tsx', import.meta.url), 'utf8')

function makeHarness() {
  const routes = []
  const effects = []
  const webServer = {
    register(route) {
      routes.push(route)
      return () => {}
    },
  }
  return {
    ctx: {
      webServer,
      effect(setup) {
        const dispose = setup()
        effects.push(typeof dispose === 'function' ? dispose : () => {})
        return dispose
      },
      logger: { info() {}, warn() {} },
    },
    routes,
    dispose() {
      while (effects.length > 0) effects.pop()()
    },
  }
}

async function invoke(route, method, body) {
  let status
  let responseBody = ''
  const req = {
    method,
    url: '/api/worktable/plugins/manage',
    headers: { 'content-type': 'application/json' },
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield Buffer.from(JSON.stringify(body))
    },
  }
  const res = {
    writeHead(code) { status = code },
    end(value) { responseBody = value === undefined ? '' : String(value) },
  }
  await route.handler(req, res)
  return { status, body: responseBody }
}

test('server registers an exact plugin-management endpoint that is POST-only', async () => {
  const harness = makeHarness()
  try {
    await plugin.apply(harness.ctx)
    const route = harness.routes.find((candidate) => candidate.path === '/api/worktable/plugins/manage')
    assert.ok(route, 'plugin-management route must be registered')
    assert.equal(route.kind, 'exact')
    assert.equal(typeof route.handler, 'function')

    const response = await invoke(route, 'GET')
    assert.equal(response.status, 405, 'plugin-management endpoint must reject non-POST requests')
  } finally {
    harness.dispose()
  }
})

test('AddPluginModal sends install requests to the plugin-management endpoint', () => {
  assert.match(
    addPluginSource,
    /fetch\(\s*['"]\/api\/worktable\/plugins\/manage['"][\s\S]{0,500}method:\s*['"]POST['"]/,
    'install action must POST to the server management route',
  )
  assert.match(
    addPluginSource,
    /body:\s*JSON\.stringify\([\s\S]*action\s*:\s*['"]install['"]/,
    'the request body must identify the install action',
  )
})

test('AddPluginModal exposes an observable install status', () => {
  assert.match(
    addPluginSource,
    /const\s+\[\s*[A-Za-z_$][\w$]*(?:Status|State)\s*,\s*set[A-Za-z_$][\w$]*\s*\]\s*=\s*useState/,
    'installing/installed state must be held in component state',
  )
  assert.match(addPluginSource, /set[A-Za-z_$][\w$]*\(\s*['"]installing['"]\s*\)/, 'installing state must be entered before the request')
  assert.match(addPluginSource, /['"](?:installed|error|failed)['"]/, 'success or failure must be represented in the status state')
  assert.match(
    addPluginSource,
    /aria-live\s*=\s*['"]polite['"]|dsh-mt_addInstallStatus/,
    'install status must be rendered as user-visible feedback',
  )
})

test('registered plugin cards offer optional remove while built-in cards do not', () => {
  const cardStart = settingsSource.indexOf('function PrefCard(')
  const sectionStart = settingsSource.indexOf('/** 「工作台」设置节')
  assert.ok(cardStart >= 0 && sectionStart > cardStart, 'PrefCard component should exist')
  const card = settingsSource.slice(cardStart, sectionStart)
  assert.match(card, /onRemove\?:\s*\(\)\s*=>\s*void/)
  assert.match(card, /props\.onRemove/)
  assert.match(card, /onClick=\{\(\)\s*=>\s*props\.onRemove\(\)\}/, 'the remove button must invoke the optional callback')
  assert.match(card, /remove/i, 'the optional action must be identifiable as remove')

  const panePluginStart = settingsSource.indexOf('{registry.panes.map')
  const paneAddStart = settingsSource.indexOf('data-add-kind="pane"', panePluginStart)
  const viewerPluginStart = settingsSource.indexOf('{registry.viewers.map')
  const viewerAddStart = settingsSource.indexOf('data-add-kind="viewer"', viewerPluginStart)
  assert.ok(panePluginStart >= 0 && paneAddStart > panePluginStart, 'pane plugin cards should be rendered')
  assert.ok(viewerPluginStart >= 0 && viewerAddStart > viewerPluginStart, 'viewer plugin cards should be rendered')
  assert.match(settingsSource.slice(panePluginStart, paneAddStart), /onRemove=/)
  assert.match(settingsSource.slice(viewerPluginStart, viewerAddStart), /onRemove=/)

  const builtinPaneStart = settingsSource.indexOf('{PANE_PREF_KEYS.map')
  assert.ok(builtinPaneStart >= 0 && builtinPaneStart < panePluginStart, 'built-in pane cards should precede plugin cards')
  assert.doesNotMatch(settingsSource.slice(builtinPaneStart, panePluginStart), /onRemove=/)
})

test('settings cards render plugin icons through WorkspaceIcon', () => {
  assert.match(settingsSource, /import\s*\{\s*WorkspaceIcon\s*\}\s*from\s*['"]\.\/icon-renderer['"]/, 'settings must import the shared icon renderer')

  const cardStart = settingsSource.indexOf('function PrefCard(')
  const sectionStart = settingsSource.indexOf('/** 「工作台」设置节')
  assert.ok(cardStart >= 0 && sectionStart > cardStart, 'PrefCard component should exist')
  const card = settingsSource.slice(cardStart, sectionStart)
  assert.match(card, /<WorkspaceIcon\s+value=\{props\.icon\}\s*\/>/, 'card icons must use WorkspaceIcon')
  assert.doesNotMatch(card, /<span[^>]*dsh-mt_setIcon[^>]*>\s*\{props\.icon\}\s*<\/span>/, 'cards must not emit raw icon text')
})
