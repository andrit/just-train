// ------------------------------------------------------------
// services/cloudinary.test.ts — access type plumbing (security gate G16)
//
// The SDK is mocked; what is under test is that every call that must know
// the delivery type gets it, and that client-media URLs are signed.
// ------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('cloudinary', () => {
  const uploader = {
    upload_stream: vi.fn((_opts: unknown, cb: (e: unknown, r: unknown) => void) => ({
      end: () => cb(null, { secure_url: 'https://res.cloudinary.com/x/y', public_id: 'pid', width: 10, height: 10 }),
    })),
    destroy: vi.fn().mockResolvedValue({ result: 'ok' }),
  }
  const api = {
    delete_resources_by_prefix: vi.fn().mockResolvedValue({ deleted: {} }),
    delete_folder:              vi.fn().mockResolvedValue({}),
  }
  const url = vi.fn((publicId: string, opts: Record<string, unknown>) =>
    `${opts.type}${opts.sign_url ? '/s--sig--' : ''}/${publicId}`)
  return { v2: { uploader, api, url, config: vi.fn() } }
})

import { v2 as cloudinary } from 'cloudinary'
import { uploadBuffer, deleteByPublicId, deleteByPrefix, mediaDeliveryUrl } from '../../services/cloudinary.service'

const optsOf = (fn: unknown, idx = 0): Record<string, unknown> =>
  (vi.mocked(fn as (...a: unknown[]) => unknown).mock.calls[0]?.[idx] ?? {}) as Record<string, unknown>

beforeEach(() => { vi.clearAllMocks() })

describe('mediaDeliveryUrl', () => {
  it('signs client media under the authenticated type and forces the stored webp format for images', () => {
    const out = mediaDeliveryUrl('trainer-app/clients/c1/snapshots/s1/abc', 'image', 'authenticated')
    expect(out).toBe('authenticated/s--sig--/trainer-app/clients/c1/snapshots/s1/abc')
    expect(optsOf(cloudinary.url, 1)).toMatchObject({ type: 'authenticated', sign_url: true, secure: true, resource_type: 'image', format: 'webp' })
  })

  it('leaves library media public and unsigned; videos keep their container', () => {
    expect(mediaDeliveryUrl('trainer-app/exercises/e1/abc', 'video', 'public')).toBe('upload/trainer-app/exercises/e1/abc')
    const opts = optsOf(cloudinary.url, 1)
    expect(opts).toMatchObject({ type: 'upload', sign_url: false, resource_type: 'video' })
    expect(opts).not.toHaveProperty('format')
  })

  it('is deterministic for the same asset — the service-worker cache key stays stable', () => {
    const a = mediaDeliveryUrl('p', 'image', 'authenticated')
    const b = mediaDeliveryUrl('p', 'image', 'authenticated')
    expect(a).toBe(b)
  })
})

describe('type plumbing', () => {
  it('uploadBuffer passes the Cloudinary type for client media and defaults to public', async () => {
    await uploadBuffer(Buffer.alloc(16), 'trainer-app/clients/c1/snapshots/s1', 'image/jpeg', 'authenticated')
    expect(optsOf(cloudinary.uploader.upload_stream)).toMatchObject({ type: 'authenticated', resource_type: 'image' })
    vi.clearAllMocks()
    await uploadBuffer(Buffer.alloc(16), 'trainer-app/exercises/e1', 'video/mp4')
    expect(optsOf(cloudinary.uploader.upload_stream)).toMatchObject({ type: 'upload', resource_type: 'video' })
  })

  it('deleteByPublicId scopes the destroy by type', async () => {
    await deleteByPublicId('pid', 'video', 'authenticated')
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('pid', { resource_type: 'video', type: 'authenticated' })
  })

  it('deleteByPrefix scopes both resource types by delivery type — a purge that forgot it would delete nothing', async () => {
    await deleteByPrefix('trainer-app/clients/c1', 'authenticated')
    const calls = vi.mocked(cloudinary.api.delete_resources_by_prefix).mock.calls
    expect(calls.map((c) => c[1])).toEqual([
      { resource_type: 'image', type: 'authenticated' },
      { resource_type: 'video', type: 'authenticated' },
    ])
    expect(cloudinary.api.delete_folder).toHaveBeenCalledWith('trainer-app/clients/c1')
  })
})
