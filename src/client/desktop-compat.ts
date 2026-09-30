type LocationLike = {
  protocol?: unknown
  hostname?: unknown
}

function currentLocation(): LocationLike | undefined {
  try {
    return typeof location === 'undefined' ? undefined : location
  } catch {
    return undefined
  }
}

/** Desktop shell uses the dedicated dsh-app://app document origin. */
export function isDesktopApp(locationLike?: LocationLike | null): boolean {
  const current = locationLike === undefined ? currentLocation() : locationLike
  return current?.protocol === 'dsh-app:' && current?.hostname === 'app'
}

function parseWebOrigin(value: unknown): URL | null {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) return null
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) return null
    return parsed
  } catch {
    return null
  }
}

/** Resolve an HTTP(S) web origin to the corresponding terminal WebSocket origin. */
export function resolveWebSocketOrigin(webOrigin: unknown, locationOrigin: string): string | null {
  const parsed = parseWebOrigin(webOrigin) ?? parseWebOrigin(locationOrigin)
  if (!parsed) return null
  return (parsed.protocol === 'https:' ? 'wss://' : 'ws://') + parsed.host
}
