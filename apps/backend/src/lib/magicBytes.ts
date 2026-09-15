// lib/magicBytes.ts — what a file IS, from its first bytes (security gate G17).
//
// The client's Content-Type is a claim; the bytes are the evidence. Every
// upload route resolves the media type from here and ignores the header.
// Covers exactly the types the app accepts — a sniffer for "anything" is a
// dependency (file-type, ESM-only from v17 — the backend is CJS) for no gain.

export type SniffedMediaType =
  | 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
  | 'video/mp4'  | 'video/webm' | 'video/quicktime'

function ascii(buf: Buffer, start: number, len: number): string {
  return buf.subarray(start, start + len).toString('latin1')
}

/** null = not one of the accepted formats (or too short to tell). */
export function sniffMediaType(buf: Buffer): SniffedMediaType | null {
  if (buf.length < 12) return null

  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (ascii(buf, 0, 8) === '\x89PNG\r\n\x1a\n')                 return 'image/png'
  if (ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 4) === 'WEBP') return 'image/webp'
  const gif = ascii(buf, 0, 6)
  if (gif === 'GIF87a' || gif === 'GIF89a')                     return 'image/gif'

  // ISO BMFF (MP4 family + QuickTime): size(4) 'ftyp'(4) major_brand(4).
  if (ascii(buf, 4, 4) === 'ftyp') {
    return ascii(buf, 8, 4) === 'qt  ' ? 'video/quicktime' : 'video/mp4'
  }
  // EBML header — WebM (and Matroska, which Cloudinary treats the same).
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'video/webm'

  return null
}
