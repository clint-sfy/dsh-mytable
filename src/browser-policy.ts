/**
 * 浏览器窗的 URL 策略 + iframe 沙箱决策 + 可嵌入性判定。
 *
 * 纯函数、零依赖：服务端探测路由（src/index.ts 的 /api/worktable/browser/probe）
 * 与客户端地址栏（src/client/browser-pane.tsx）共用同一份规则，也便于单测。
 * 写法参照 DSH-better-sidebar 的 src/client/browser.ts + src/browser-probe.ts。
 *
 * 安全模型分两层：
 * 1) **iframe 沙箱**是第一道边界——默认不给 `allow-same-origin`（不透明源：被访问的页面
 *    读不到界面自己的存储 / 拿不到 /api 的凭据），也永不给 `allow-top-navigation`
 *    （页面不能把界面本身导航走）。只有「本机地址」额外给 `allow-same-origin`，因为本地
 *    开发服务器（Vite 等）的模块 / HMR / fetch 流程需要一个真实源；它仍然与界面跨源。
 *    界面**自身那个源**是唯一硬例外：任何时候都保持不透明沙箱，绝不授 `allow-same-origin`。
 * 2) **地址栏策略**只放行 http(s)：javascript: / data: / file: 等一律拒绝，
 *    `//host` 与裸 `host/path` 补协议，非 http(s) 的显式 scheme 一律拒。
 *
 * 与 better-sidebar 的**有意差异**（工作台场景）：它默认拒绝本机地址、要靠设置里的白名单
 * 放开；工作台的浏览器主要用途就是看本地起的站点，所以这里**默认允许本机地址**，
 * 并给它们 `allow-same-origin`（见上）。界面自己的源仍然锁死不透明沙箱。
 */

/** 地址栏被拒绝的原因。 */
export type BrowserBlockReason = 'scheme'

/** 一次地址栏输入归一化的结果。 */
export type BrowserNavigateResult =
  | { kind: 'ok'; url: string }
  | { kind: 'blocked'; reason: BrowserBlockReason }
  | { kind: 'invalid' }

/** 一次 browser.probe 的返回（宿主代取目标站点的响应头）。 */
export interface BrowserProbeResult {
  reachable: boolean
  /** 跟随重定向后的最终地址（可达时才有）。 */
  url?: string
  status?: number
  xFrameOptions?: string
  /** CSP 的 frame-ancestors 源列表（该指令存在时才有）。 */
  frameAncestors?: string[]
}

/** 一次探测给出的可嵌入性结论。 */
export type Embeddability = 'embeddable' | 'blocked' | 'unknown'

/**
 * 明确禁止进入 iframe 的 scheme（即使不带 `//`）。
 * `host:port` 这种形状（example.com:8080）不在此列——下面按主机名解析。
 */
const FORBIDDEN_SCHEMES = new Set([
  'javascript', 'data', 'file', 'about', 'vbscript', 'blob',
  'mailto', 'tel', 'ftp', 'ftps', 'ws', 'wss', 'sftp', 'ssh',
  'chrome', 'chrome-extension', 'moz-extension', 'edge', 'opera', 'resource', 'view-source',
])

/** 一个本机主机名（localhost、IPv6 ::1、127.0.0.0/8、0.0.0.0）。 */
export function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (host === 'localhost' || host === '::1' || host === '0.0.0.0') return true
  const parts = host.split('.')
  return parts.length === 4
    && parts[0] === '127'
    && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

/**
 * 取 Content-Security-Policy 里 `frame-ancestors` 的源列表；指令不存在（或为空）时
 * 返回 undefined。该指令是唯一带源列表的，源之间用空格分隔（`'none'` / `'self'` / `*` / 源）。
 */
export function extractFrameAncestors(csp: string | null): string[] | undefined {
  if (csp === null) return undefined
  for (const directive of csp.split(';')) {
    const parts = directive.trim().split(/\s+/)
    if (parts[0] === 'frame-ancestors') {
      const sources = parts.slice(1).filter((source) => source !== '')
      return sources.length === 0 ? undefined : sources
    }
  }
  return undefined
}

/**
 * 站点能否在 iframe 里渲染。判据就是浏览器拒绝加载 iframe 时用的那几个信号：
 * X-Frame-Options 的 DENY / SAMEORIGIN，或 frame-ancestors 里没有 `*`
 * （这里的 'self' 指**站点自己**的源，永远不是我们的源，所以同样拒绝我们）。
 * 探不到（不可达）时给 'unknown'，客户端保持普通 iframe。
 */
export function embeddabilityOf(probe: BrowserProbeResult): Embeddability {
  if (probe.reachable !== true) return 'unknown'
  const xfo = probe.xFrameOptions?.trim().toUpperCase()
  if (xfo === 'DENY' || xfo === 'SAMEORIGIN') return 'blocked'
  if (probe.frameAncestors !== undefined && !probe.frameAncestors.some((source) => source === '*')) return 'blocked'
  return 'embeddable'
}

/**
 * iframe 的沙箱令牌。**不含** `allow-same-origin`（不透明源——拿不到界面存储 / API），
 * **不含** `allow-top-navigation`（被访问的页面不能劫持界面）。
 * allow-forms / allow-popups / allow-downloads / allow-modals 让登录流程能用；
 * allow-popups-to-escape-sandbox 让 OAuth 弹窗按普通标签页打开（它们本来就与界面跨源）。
 */
export const BROWSER_IFRAME_SANDBOX =
  'allow-scripts allow-forms allow-popups allow-downloads allow-modals allow-popups-to-escape-sandbox'

/** 本机地址（用户自己起的本地服务）额外加 allow-same-origin：本地开发服务器需要真实源。 */
export const BROWSER_IFRAME_SANDBOX_LOCAL = `${BROWSER_IFRAME_SANDBOX} allow-same-origin`

/**
 * 某个地址该用哪套沙箱令牌。
 * - 界面自身的源 → 永远不透明沙箱（就算它同时也是本机地址）
 * - 本机地址（localhost / 127.x / ::1）→ 加 allow-same-origin（本地开发服务器可用）
 * - 其它站点 → 不透明沙箱
 */
export function iframeSandboxFor(url: string, selfOrigin?: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return BROWSER_IFRAME_SANDBOX
  }
  if (selfOrigin !== undefined) {
    try {
      if (parsed.origin === new URL(selfOrigin).origin) return BROWSER_IFRAME_SANDBOX
    } catch {
      // selfOrigin 解析不了（实际不会发生）：继续按下面的规则判
    }
  }
  return isLoopbackHostname(parsed.hostname) ? BROWSER_IFRAME_SANDBOX_LOCAL : BROWSER_IFRAME_SANDBOX
}

/**
 * 把一次地址栏输入归一化成可导航的 http(s) 地址。
 *
 * - 空 → invalid
 * - `http(s)://…` → 直接用
 * - 其它显式 scheme：在禁止表里 → blocked(scheme)；不在表里（例如 `example.com:8080`
 *   会被 scheme 正则误认）→ 当主机名补协议
 * - 裸 `host/path`、`//host/path` → 补协议；**本机地址补 http**（本地服务一般是 http，
 *   补 https 会直接连不上），其它补 https
 */
export function normalizeBrowserUrl(input: string, selfOrigin?: string): BrowserNavigateResult {
  const trimmed = input.trim()
  if (trimmed === '') return { kind: 'invalid' }
  // 区分「显式 scheme」与「裸 host:port」：example.com:8080 会被朴素的 scheme 正则命中
  // （scheme 里允许点号），所以只有 http(s) 或已知禁止的 scheme 才当作 scheme 处理。
  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(trimmed)
  const explicitScheme = schemeMatch === null ? '' : schemeMatch[1]!.toLowerCase()
  const hasHttpScheme = explicitScheme === 'http' || explicitScheme === 'https'
  if (!hasHttpScheme && FORBIDDEN_SCHEMES.has(explicitScheme)) return { kind: 'blocked', reason: 'scheme' }
  const bare = trimmed.replace(/^\/\//, '')
  const hostOnly = (bare.split(/[/?#]/)[0] ?? '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '')
  const protocol = hasHttpScheme
    ? explicitScheme
    : (isLoopbackHostname(hostOnly) ? 'http' : 'https')
  const withScheme = hasHttpScheme ? trimmed : `${protocol}://${bare}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return { kind: 'invalid' }
  }
  // 协议兜底：仍然解析成非 http(s) 的（例如 ftp:// 带 `//` 绕过上面的表）一律拒。
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { kind: 'blocked', reason: 'scheme' }
  if (selfOrigin !== undefined) {
    try {
      if (url.origin === new URL(selfOrigin).origin) return { kind: 'ok', url: url.href }
    } catch {
      // selfOrigin 解析不了：按普通地址处理
    }
  }
  return { kind: 'ok', url: url.href }
}
