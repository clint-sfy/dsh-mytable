/**
 * 浏览器窗真机验收驱动：起夹具站点 + 起 headless Edge + 跑 CDP 探针，收尾清理。
 *
 * 用法：
 *   node tests/run-browser-pane-check.mjs <就绪URL> [ws模块路径]
 *     就绪URL：一个跑着 dsh-mytable 的实例地址（含一次性 token），如
 *       http://127.0.0.1:5658/?token=…
 *     ws模块路径缺省取宿主自带的 ws（与 cdp-probe 用法一致）。
 *
 * 退出码：探针失败或步骤断言失败 → 1。
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const url = process.argv[2]
if (!url || !/^https?:\/\//.test(url)) {
  console.error('usage: node tests/run-browser-pane-check.mjs <instance-url-with-token> [ws-module-path]')
  process.exit(2)
}
const WS = process.argv[3] ?? 'C:/MySoftware/nodejs/node_global/node_modules/@deepseek-ai/dsh/node_modules/ws/index.js'
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p))
const CDP_PORT = 9222

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const children = []
function killAll() {
  for (const c of children) { try { c.kill() } catch {} }
}
process.on('exit', killAll)

// ── 夹具站点 ────────────────────────────────────────────────────────────────
const fixture = spawn(process.execPath, [join(HERE, 'browser-fixture-server.mjs')], { stdio: ['ignore', 'pipe', 'inherit'] })
children.push(fixture)
const port = await new Promise((res, rej) => {
  let buf = ''
  const timer = setTimeout(() => rej(new Error('fixture did not report a port')), 10000)
  fixture.stdout.on('data', (d) => {
    buf += String(d)
    const m = /FIXTURE http:\/\/127\.0\.0\.1:(\d+)/.exec(buf)
    if (m) { clearTimeout(timer); res(Number(m[1])) }
  })
})
console.log('fixture: http://127.0.0.1:' + port)

// ── headless Edge ──────────────────────────────────────────────────────────
let edge = null
if (EDGE) {
  const profileDir = mkdtempSync(join(tmpdir(), 'mytable-edge-'))
  edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions', '--disable-sync',
    '--hide-scrollbars', '--window-size=1700,1100',
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`, 'about:blank',
  ], { stdio: 'ignore' })
  children.push(edge)
  await sleep(6000)
  process.on('exit', () => { try { rmSync(profileDir, { recursive: true, force: true }) } catch {} })
} else {
  console.log('（没找到 msedge，沿用已在 9222 上的无头浏览器）')
}

// ── 探针 ───────────────────────────────────────────────────────────────────
const argsFile = join(tmpdir(), 'mytable-browser-probe-args.json')
writeFileSync(argsFile, JSON.stringify({ port }))
const shot = join(HERE, '..', '.tmp', 'shot-browser-pane.png')
const probe = spawn(process.execPath, [
  join(HERE, 'cdp-probe.mjs'), WS, url, join(HERE, 'verify-browser-pane.js'), shot, 'fresh', argsFile,
], { stdio: ['ignore', 'pipe', 'pipe'] })
let stdout = ''
let stderr = ''
probe.stdout.on('data', (d) => { stdout += String(d); process.stdout.write(String(d)) })
probe.stderr.on('data', (d) => { stderr += String(d); process.stderr.write(String(d)) })
const code = await new Promise((res) => probe.on('exit', (c) => res(c ?? 1)))
killAll()
try { rmSync(argsFile, { force: true }) } catch {}
console.log(code === 0 ? '\n浏览器窗验收：全部通过' : '\n浏览器窗验收：有失败项')
process.exit(code)
