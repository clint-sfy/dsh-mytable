import test from 'node:test'
import assert from 'node:assert/strict'

const plugin = await import('../lib/index.js')

function makeHarness() {
  const active = new Map()
  const effects = []
  const routes = []

  const webServer = {
    register(route) {
      const key = `${route.kind}:${route.path}`
      if (active.has(key)) throw new Error(`duplicate route: ${key}`)
      active.set(key, route)
      routes.push(route)
      return () => {
        if (active.get(key) === route) active.delete(key)
      }
    },
  }

  const ctx = {
    webServer,
    effect(setup) {
      const dispose = setup()
      effects.push(typeof dispose === 'function' ? dispose : () => {})
      return dispose
    },
    logger: { info() {}, warn() {} },
  }

  return {
    ctx,
    routes,
    dispose() {
      while (effects.length > 0) effects.pop()()
    },
  }
}

test('all HTTP routes can be applied again after the first context is disposed', () => {
  const harness = makeHarness()
  plugin.apply(harness.ctx)
  assert.equal(harness.routes.length, 26, 'the lifecycle probe must cover every HTTP route')
  harness.dispose()

  assert.doesNotThrow(() => plugin.apply(harness.ctx))
  assert.equal(harness.routes.length, 52)
  harness.dispose()
})
