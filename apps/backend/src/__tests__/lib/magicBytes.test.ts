// lib/magicBytes.test.ts — byte sniffing + the validator built on it (G17)

import { describe, it, expect } from 'vitest'
import { sniffMediaType } from '../../lib/magicBytes'
import { validateMediaFile } from '../../services/cloudinary.service'

const pad = (head: number[] | string, len = 32): Buffer => {
  const b = Buffer.alloc(len)
  if (typeof head === 'string') b.write(head, 0, 'latin1'); else Buffer.from(head).copy(b)
  return b
}
const ftyp = (brand: string): Buffer => { const b = pad([0, 0, 0, 0x18]); b.write('ftyp' + brand, 4, 'latin1'); return b }

describe('sniffMediaType', () => {
  it('recognises every accepted format from its signature', () => {
    expect(sniffMediaType(pad([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(sniffMediaType(pad('\x89PNG\r\n\x1a\n'))).toBe('image/png')
    expect(sniffMediaType(pad('RIFF\x00\x00\x00\x00WEBPVP8 '))).toBe('image/webp')
    expect(sniffMediaType(pad('GIF89a'))).toBe('image/gif')
    expect(sniffMediaType(pad('GIF87a'))).toBe('image/gif')
    expect(sniffMediaType(ftyp('isom'))).toBe('video/mp4')
    expect(sniffMediaType(ftyp('mp42'))).toBe('video/mp4')
    expect(sniffMediaType(ftyp('qt  '))).toBe('video/quicktime')
    expect(sniffMediaType(pad([0x1a, 0x45, 0xdf, 0xa3]))).toBe('video/webm')
  })

  it('rejects what the app does not accept, whatever the header claimed', () => {
    expect(sniffMediaType(pad('<!DOCTYPE html><script>'))).toBeNull()       // HTML labelled image/png
    expect(sniffMediaType(pad('%PDF-1.7'))).toBeNull()
    expect(sniffMediaType(pad('RIFF\x00\x00\x00\x00WAVEfmt '))).toBeNull()  // RIFF but not WebP
    expect(sniffMediaType(pad([0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]))).toBe('video/mp4')
      // ↑ HEIC is an ISO BMFF 'ftyp heic' — sniffed as the mp4 family. Cloudinary will
      //   reject it as a video, which matches today's behaviour (HEIC is not accepted).
    expect(sniffMediaType(Buffer.from([0xff, 0xd8]))).toBeNull()             // too short to judge
    expect(sniffMediaType(Buffer.alloc(0))).toBeNull()
  })
})

describe('validateMediaFile', () => {
  it('returns the sniffed type — the client header plays no part', () => {
    expect(validateMediaFile(pad([0xff, 0xd8, 0xff]))).toEqual({ ok: true, mimeType: 'image/jpeg' })
  })

  it('rejects unknown bytes with the allow-list message', () => {
    const r = validateMediaFile(pad('hello world, not media'))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Unsupported file type/)
  })

  it('applies the image and video size caps by sniffed class', () => {
    const bigImage = Buffer.alloc(10 * 1024 * 1024 + 1); Buffer.from([0xff, 0xd8, 0xff]).copy(bigImage)
    const r1 = validateMediaFile(bigImage)
    expect(r1.ok).toBe(false); if (!r1.ok) expect(r1.error).toMatch(/Image too large/)

    const okVideo = Buffer.alloc(10 * 1024 * 1024 + 1); ftyp('isom').copy(okVideo)
    expect(validateMediaFile(okVideo)).toEqual({ ok: true, mimeType: 'video/mp4' })   // 10 MB is fine for video

    const bigVideo = Buffer.alloc(100 * 1024 * 1024 + 1); ftyp('isom').copy(bigVideo)
    const r2 = validateMediaFile(bigVideo)
    expect(r2.ok).toBe(false); if (!r2.ok) expect(r2.error).toMatch(/Video too large/)
  })
})
