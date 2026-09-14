// ------------------------------------------------------------
// lib/telemetry/sink.ts — where product events go
//
// One interface, one implementation today (Postgres). The route never knows
// which sink is active. Adding a vendor later (PostHog, or anything with a
// `capture`-shaped API) is a new file implementing TelemetrySink plus a case
// in createTelemetrySink() — the app, the route and the event shape do not
// change. That is the extensibility the designer asked for on 2026-09-14:
// paid analytics becomes a configuration flip once the product earns it.
//
// TELEMETRY_SINK: 'postgres' (default) | 'none'
// ------------------------------------------------------------

import type { ClientEventInput } from '@trainer-app/shared'
import { db, clientEvents } from '../../db'

export interface TelemetrySink {
  /** Persist a batch for one trainer. Must not throw for a single bad row. */
  record(trainerId: string, events: readonly ClientEventInput[]): Promise<number>
}

export const postgresSink: TelemetrySink = {
  async record(trainerId, events) {
    if (!events.length) return 0
    await db.insert(clientEvents).values(
      events.map((e) => ({
        trainerId,
        name:     e.name,
        props:    e.props ?? null,
        clientTs: new Date(e.clientTs),
      })),
    )
    return events.length
  },
}

export const noopSink: TelemetrySink = {
  async record() { return 0 },
}

export function createTelemetrySink(kind = process.env.TELEMETRY_SINK ?? 'postgres'): TelemetrySink {
  switch (kind) {
    case 'none':     return noopSink
    case 'postgres': return postgresSink
    // case 'posthog': return posthogSink   ← add when the product earns paid analytics
    default:
      throw new Error(`Unknown TELEMETRY_SINK "${kind}" — expected postgres | none`)
  }
}
