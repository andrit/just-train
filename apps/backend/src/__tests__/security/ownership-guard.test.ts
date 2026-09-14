// ------------------------------------------------------------
// security/ownership-guard.test.ts — every parameterised route must resolve
// the caller's ownership before acting.
//
// Phase 19 audit (2026-09-14) found seven routes that mutated by bare id:
// POST /sessions/:id/exercises, PATCH+DELETE /session-exercises/:id,
// POST /session-exercises/:id/sets, PATCH+DELETE /sets/:id,
// DELETE /template-exercises/:id. Nothing in the suite could have caught them
// because the db is mocked and a mocked findFirst ignores WHERE clauses.
//
// This is a source-level guard, and it is honest about what it checks: that
// the handler body USES `request.trainer.trainerId` in one of the shapes that
// mean "scoped" —
//   eq(<table>.trainerId, request.trainer.trainerId)   direct SQL scope
//   eq(<table>.trainerId, trainerId)                    via `const trainerId = request.trainer.trainerId`
//   === / !== request.trainer.trainerId                 compare after a relational load
//   someFn(..., request.trainer.trainerId, ...)         passed to a resolver (buildReportData, ownedSet, …)
//   const trainerId = …; someFn(trainerId, …)           same, through the local alias (findOwnedClient)
// An object-literal property (`{ trainerId: request.trainer.trainerId }`) does
// NOT count: that is how logSyncWrite() made an unscoped route look scoped.
//
// It cannot prove the WHERE is right; the real-database matrix does that.
// It CAN fail — and did, on all seven, before the fixes.
// ------------------------------------------------------------

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROUTES_DIR = join(__dirname, '..', '..', 'routes')

interface ParamRoute { file: string; method: string; path: string; body: string }

function parameterisedRoutes(): ParamRoute[] {
  const out: ParamRoute[] = []
  for (const file of readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.ts')).sort()) {
    const src = readFileSync(join(ROUTES_DIR, file), 'utf8')
    const re = /app\.(get|post|patch|delete)\('([^']*:[^']*)'/g
    let m: RegExpExecArray | null
    while ((m = re.exec(src))) {
      const rest = src.slice(m.index + m[0].length)
      const next = rest.search(/\n {2}app\.(get|post|patch|delete)\('/)
      out.push({ file, method: m[1].toUpperCase(), path: m[2], body: rest.slice(0, next === -1 ? undefined : next) })
    }
  }
  return out
}

const SCOPED_SHAPES: RegExp[] = [
  /eq\(\w+\.trainerId,\s*request\.trainer\.trainerId\)/,
  /const trainerId\s*=\s*request\.trainer\.trainerId[\s\S]*eq\(\w+\.trainerId,\s*trainerId\)/,
  /[!=]==\s*request\.trainer\.trainerId/,
  /\w+\(\s*(?:[^()]*,\s*)?request\.trainer\.trainerId\s*[,)]/,
  /const trainerId\s*=\s*request\.trainer\.trainerId[\s\S]*\w+\(\s*(?:[^()]*,\s*)?trainerId\s*[,)]/,
]

function looksScoped(body: string): boolean {
  return SCOPED_SHAPES.some((re) => re.test(body))
}

describe('ownership guard — parameterised routes resolve the caller before acting', () => {
  const routes = parameterisedRoutes()

  it('finds the routes (sanity: the scan is not silently empty)', () => {
    expect(routes.length).toBeGreaterThan(40)
  })

  for (const r of routes) {
    it(`${r.method} ${r.path} (${r.file})`, () => {
      expect(looksScoped(r.body), `${r.method} ${r.path} never uses request.trainer.trainerId in a scoping shape`).toBe(true)
    })
  }
})
