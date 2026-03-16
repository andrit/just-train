// ------------------------------------------------------------
// @trainer-app/shared — public API
//
// Import everything from this single entry point:
//   import { CreateClientSchema, ClientResponseSchema, convertWeight } from '@trainer-app/shared'
// ------------------------------------------------------------

// All enums as Zod schemas + inferred TypeScript types
export * from './enums'

// Input schemas (request bodies) + inferred types
export * from './schemas/index'

// Response schemas (Swagger docs + response serialization) + inferred types
export * from './schemas/response-schemas'

// TypeScript model interfaces (mirror DB schema shapes)
export * from './types/index'

// Utilities
export * from './utils/weight'
