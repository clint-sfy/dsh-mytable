/**
 * 浏览器窗策略回归测试（地址栏归一化 / 沙箱令牌 / 可嵌入性判定 / frame-ancestors 解析）。
 * 用法：node tests/browser-policy.test.mjs
 *
 * 直接打靶源码模块 src/browser-policy.ts（Node 24 原生类型剥离，无需构建产物）——
 * 这份策略同时被服务端探测路由与客户端地址栏使用，单测覆盖的就是两边共用的那份规则。
 *
 * 覆盖点（对齐 DSH-better-sidebar 的 browser.ts / browser-probe.ts 语义，差异处已断言）：
 *   A. 裸域名 / 带端口 / 显式 scheme / //host 的归一化；本机地址补 http，其它补 https
 *   B. 危险 scheme（javascript: / data: / file:）一律 blocked，空输入 invalid
 *   C. 界面自身 origin 可浏览（不被本机规则拦下）
 *   D. 沙箱令牌：默认不含 allow-same-origin / allow-top-navigation；本机地址加 allow-same-origin；
 *      界面自身 origin 永远不加
 *   E. frame-ancestors 解析（含空源列表、无该指令）
 *   F. 可嵌入性判定（DENY / SAMEORIGIN / frame-ancestors / 通配 / 不可达）
 */
import {
  BROWSER_IFRAME_SANDBOX,
  BROWSER_IFRAME_SANDBOX_LOCAL,
  embeddabilityOf,
  extractFrameAncestors,
  iframeSandboxFor,
  isLoopbackHostname,
  normalizeBrowserUrl,
} from '../src/browser-policy.ts'

let pass = 0
const failures = []
const ok = (name) => { console.log('ok   ' + name); pass++ }
function fail(name, detail) {
  failures.push(name + ': ' + detail)
  console.error('FAIL(' + name + '): ' + detail)
}
/** 断言实际值等于期望值 */
function eq(name, actual, expected) {
  if (actual === expected) ok(name)
  else fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

const SELF = 'http://127.0.0.1:3080'

// ── A. 地址栏归一化 ────────────────────────────────────────────────────────────
const norm = (input) => normalizeBrowserUrl(input, SELF)
eq('A1 裸域名补 https', norm('example.com').url, 'https://example.com/')
eq('A2 裸域名带路径', norm('example.com/a/b?c=1').url, 'https://example.com/a/b?c=1')
eq('A3 host:port 不被误判成 scheme', norm('example.com:8080/x').url, 'https://example.com:8080/x')
eq('A4 显式 http 保留', norm('http://example.com/x').url, 'http://example.com/x')
eq('A5 //host 补 https', norm('//example.com/x').url, 'https://example.com/x')
eq('A6 本机 host:port 补 http（本地服务一般是 http）', norm('localhost:5173').url, 'http://localhost:5173/')
eq('A7 本机 IP 补 http', norm('127.0.0.1:8080/app').url, 'http://127.0.0.1:8080/app')
eq('A8 IPv6 本机地址补 http', norm('[::1]:9000').url, 'http://[::1]:9000/')
eq('A9 内网 IP 仍补 https（非本机）', norm('192.168.1.5:3000').url, 'https://192.168.1.5:3000/')
eq('A10 前后空白被裁掉', norm('  example.com  ').url, 'https://example.com/')

// ── B. 拒绝与无效 ──────────────────────────────────────────────────────────────
eq('B1 javascript: 被拒', norm('javascript:alert(1)').kind, 'blocked')
eq('B2 data: 被拒', norm('data:text/html,<b>x</b>').kind, 'blocked')
eq('B3 file: 被拒', norm('file:///C:/Windows/win.ini').kind, 'blocked')
eq('B4 ftp:// 被拒（带 // 也走兜底）', norm('ftp://example.com/x').kind, 'blocked')
eq('B5 空输入 invalid', norm('').kind, 'invalid')
eq('B6 纯空白 invalid', norm('   ').kind, 'invalid')
eq('B7 拒绝原因标注为 scheme', norm('javascript:1').reason, 'scheme')

// ── C. 界面自身 origin ────────────────────────────────────────────────────────
eq('C1 界面自身地址放行（不被本机规则拦）', normalizeBrowserUrl('http://127.0.0.1:3080/?token=x', SELF).kind, 'ok')
eq('C2 界面自身地址归一后原样', normalizeBrowserUrl('http://127.0.0.1:3080/a', SELF).url, 'http://127.0.0.1:3080/a')

// ── D. 沙箱令牌 ───────────────────────────────────────────────────────────────
eq('D1 普通站点：不透明沙箱（无 allow-same-origin）', iframeSandboxFor('https://example.com', SELF), BROWSER_IFRAME_SANDBOX)
eq('D2 本机地址：额外给 allow-same-origin（本地开发服务器需要真实源）', iframeSandboxFor('http://localhost:5173', SELF), BROWSER_IFRAME_SANDBOX_LOCAL)
eq('D3 界面自身 origin：即使也是本机也绝不给 allow-same-origin', iframeSandboxFor('http://127.0.0.1:3080/', SELF), BROWSER_IFRAME_SANDBOX)
eq('D4 基底令牌不含 allow-same-origin', BROWSER_IFRAME_SANDBOX.includes('allow-same-origin'), false)
eq('D5 基底令牌不含 allow-top-navigation（页面不能劫持界面）', BROWSER_IFRAME_SANDBOX.includes('allow-top-navigation'), false)
eq('D6 本机令牌含 allow-same-origin', BROWSER_IFRAME_SANDBOX_LOCAL.includes('allow-same-origin'), true)
eq('D7 本机令牌仍不含 allow-top-navigation', BROWSER_IFRAME_SANDBOX_LOCAL.includes('allow-top-navigation'), false)
eq('D8 登录流程需要的令牌在（forms/popups）', BROWSER_IFRAME_SANDBOX.includes('allow-forms') && BROWSER_IFRAME_SANDBOX.includes('allow-popups'), true)

// ── E. frame-ancestors 解析 ───────────────────────────────────────────────────
eq('E1 取到 none', JSON.stringify(extractFrameAncestors("default-src 'self'; frame-ancestors 'none'")), JSON.stringify(["'none'"]))
eq('E2 取到通配', JSON.stringify(extractFrameAncestors('frame-ancestors *')), JSON.stringify(['*']))
eq('E3 多个源', JSON.stringify(extractFrameAncestors("frame-ancestors 'self' https://a.com")), JSON.stringify(["'self'", 'https://a.com']))
eq('E4 无该指令 → undefined', extractFrameAncestors("default-src 'self'"), undefined)
eq('E5 没有 CSP 头 → undefined', extractFrameAncestors(null), undefined)
eq('E6 空源列表 → undefined', extractFrameAncestors('frame-ancestors'), undefined)

// ── F. 可嵌入性 ───────────────────────────────────────────────────────────────
eq('F1 探不到 → unknown（保留普通 iframe）', embeddabilityOf({ reachable: false }), 'unknown')
eq('F2 X-Frame-Options: DENY → blocked', embeddabilityOf({ reachable: true, status: 200, xFrameOptions: 'DENY' }), 'blocked')
eq('F3 x-frame-options 小写 sameorigin → blocked', embeddabilityOf({ reachable: true, status: 200, xFrameOptions: 'sameorigin' }), 'blocked')
eq("F4 frame-ancestors 'self' → blocked（'self' 指的是站点自己，不是我们）", embeddabilityOf({ reachable: true, status: 200, frameAncestors: ["'self'"] }), 'blocked')
eq('F5 frame-ancestors * → embeddable', embeddabilityOf({ reachable: true, status: 200, frameAncestors: ['*'] }), 'embeddable')
eq('F6 无任何信号 → embeddable', embeddabilityOf({ reachable: true, status: 200 }), 'embeddable')
eq('F7 ALLOW-FROM（老写法）不当作可嵌入证据', embeddabilityOf({ reachable: true, status: 200, xFrameOptions: 'ALLOW-FROM https://a.com' }), 'embeddable')

// ── G. 本机主机名判定 ─────────────────────────────────────────────────────────
for (const host of ['localhost', 'LOCALHOST', '127.0.0.1', '127.9.9.9', '::1', '[::1]', '0.0.0.0']) {
  eq(`G 本机: ${host}`, isLoopbackHostname(host), true)
}
for (const host of ['example.com', '128.0.0.1', 'localhost.example.com', '10.0.0.1', '127.0.0.256']) {
  eq(`G 非本机: ${host}`, isLoopbackHostname(host), false)
}

console.log(`\n${pass} passed, ${failures.length} failed`)
for (const f of failures) console.error('  - ' + f)
process.exitCode = failures.length === 0 ? 0 : 1
