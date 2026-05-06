// Explicit module augmentations for @fastify/cookie and @fastify/multipart.
// These plugins normally augment fastify's types via their own declaration files,
// but pnpm's symlink layout means those augmentations are not reliably picked up
// by tsc. Redeclaring them here ensures they are always in scope for the backend.
export {}

declare module 'fastify' {
  interface FastifyRequest {
    /** Parsed cookie map — added by @fastify/cookie */
    cookies: Record<string, string | undefined>
    /** Read a single multipart file — added by @fastify/multipart */
    file(options?: Record<string, unknown>): Promise<import('@fastify/multipart').MultipartFile | undefined>
  }
  interface FastifyReply {
    /** Set a response cookie — added by @fastify/cookie */
    setCookie(name: string, value: string, options?: Record<string, unknown>): this
    /** Clear a response cookie — added by @fastify/cookie */
    clearCookie(name: string, options?: Record<string, unknown>): this
  }
}
