import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

test('current requirement editor is one and a half times its former height', () => {
  const source = readFileSync(join(root, 'src/client/styles.ts'), 'utf8')
  assert.match(source, /\.dsh-mt_pwNeed\{min-height:165px;/)
})
