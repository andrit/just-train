import { describe, it, expect } from 'vitest'
import { describeUserAgent } from '@/lib/userAgent'

describe('describeUserAgent', () => {
  it('reads Chrome on Android from a Galaxy UA', () => {
    expect(describeUserAgent('Mozilla/5.0 (Linux; Android 13; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36')).toBe('Chrome on Android')
  })
  it('does not call Safari-claiming Chrome "Safari", but does recognise real Safari on iPhone', () => {
    expect(describeUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')).toBe('Safari on iPhone')
  })
  it('prefers Edge over the Chrome token it also carries', () => {
    expect(describeUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36 Edg/120.0')).toBe('Edge on Windows')
  })
  it('handles Mac Chrome and Firefox on Linux', () => {
    expect(describeUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/143.0 Safari/537.36')).toBe('Chrome on Mac')
    expect(describeUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0')).toBe('Firefox on Linux')
  })
  it('falls back honestly', () => {
    expect(describeUserAgent(null)).toBe('Unknown device')
    expect(describeUserAgent('curl/8.4')).toBe('Browser')
  })
})
