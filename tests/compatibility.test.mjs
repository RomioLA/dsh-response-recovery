import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

test('vanilla rc.2 refuses plugin activation before registering a listener', () => {
  const source = [
    "import { apply } from './src/index.js'",
    "let registered = 0",
    "let rejected = false",
    "try { apply({ on() { registered++ } }) } catch (e) {",
    "  rejected = /RESPONSE_RECOVERY_CONTRACT_VERSION=1/.test(String(e))",
    "}",
    "if (!rejected || registered !== 0) process.exit(19)",
  ].join(';')
  const child = spawnSync(process.execPath, [
    '--import', './tests/preload.mjs', '--input-type=module', '-e', source,
  ], { cwd: process.cwd(), encoding: 'utf8', timeout: 20000 })
  assert.equal(child.status, 0, child.stderr || child.stdout)
})
