// lib/clientIp.ts — the address a request came from, as seen through the
// proxies in front of Railway. Shared by the global rate limiter and the
// login lockout so both key on the same value.
//
// Takes the FIRST X-Forwarded-For entry. That is only trustworthy if the
// first proxy overwrites the header rather than appending to a client-sent
// one (Vercel documents that it does; Railway's edge is behind it). Checked
// as part of the live-surface pass — SECURITY.md G9 / G15.

export function clientIp(req: { headers: Record<string, string | string[] | undefined>; ip: string }): string {
  const xff = req.headers['x-forwarded-for']
  const first = (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0]?.trim()
  return first || req.ip || 'unknown'
}
