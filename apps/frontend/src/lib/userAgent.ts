// ------------------------------------------------------------
// lib/userAgent.ts — "Chrome on Android", from a raw User-Agent
//
// The device list stores the UA captured at login. Nobody wants to read
// "Mozilla/5.0 (Linux; Android 13; SM-G981B) AppleWebKit/537.36 …"; this
// reduces it to browser + platform. Deliberately small — order matters
// (Edge/Opera claim Chrome, Chrome claims Safari) and unknowns fall through
// to a generic label rather than a wrong one.
// ------------------------------------------------------------

export function describeUserAgent(ua: string | null | undefined): string {
  if (!ua) return 'Unknown device'

  const browser =
    /Edg\//.test(ua)                 ? 'Edge'    :
    /OPR\/|Opera/.test(ua)           ? 'Opera'   :
    /Firefox\//.test(ua)             ? 'Firefox' :
    /Chrome\//.test(ua)              ? 'Chrome'  :
    /Safari\//.test(ua)              ? 'Safari'  :
    'Browser'

  const platform =
    /iPhone/.test(ua)                ? 'iPhone'  :
    /iPad/.test(ua)                  ? 'iPad'    :
    /Android/.test(ua)               ? 'Android' :
    /Mac OS X|Macintosh/.test(ua)    ? 'Mac'     :
    /Windows/.test(ua)               ? 'Windows' :
    /CrOS/.test(ua)                  ? 'ChromeOS':
    /Linux/.test(ua)                 ? 'Linux'   :
    null

  return platform ? `${browser} on ${platform}` : browser
}
