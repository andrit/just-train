// ------------------------------------------------------------
// lib/widgets.ts — Dashboard widget registry (Phase 4)
//
// Single source of truth for:
//   - All valid widget IDs
//   - Default widget order per trainer mode
//   - Widget display metadata (label, description, mode availability)
//
// widgetProgression is stored on the trainer record as a comma-delimited
// string. This file handles all parsing, validation, and defaults.
//
// TO ADD A NEW WIDGET:
//   1. Add its ID to WIDGET_IDS
//   2. Add its metadata to WIDGET_META
//   3. Add it to the relevant default order arrays
//   4. Build the widget component in components/dashboard/widgets/
//   5. Register it in components/dashboard/WidgetRenderer.tsx
// ------------------------------------------------------------

// ── Widget IDs ────────────────────────────────────────────────────────────────

export const WIDGET_IDS = [
  'atRisk',          // At-risk client alert — trainer only
  'selfTraining',    // Self-client quick-access tile — both modes
  'recentSessions',  // Last N sessions — both modes
  'activeClients',   // Active client count callout — trainer only
  'goals',           // Active goals count — both modes
  'volume',          // Total volume this week — both modes (Phase 7)
  'streak',          // Consistency streak — both modes (Phase 7)
  'newClients',      // Clients added this month — trainer only (Phase 7)
] as const

export type WidgetId = typeof WIDGET_IDS[number]

// ── Widget metadata ───────────────────────────────────────────────────────────

interface WidgetMeta {
  label:       string
  description: string
  /** Which trainer modes can show this widget */
  modes:       ('athlete' | 'trainer')[]
  /** Phase when this widget has real data. Before that it shows a placeholder. */
  availableFrom: 4 | 5 | 6 | 7
}

export const WIDGET_META: Record<WidgetId, WidgetMeta> = {
  atRisk: {
    label:         'At-Risk Clients',
    description:   'Clients with no session in the last 14 days',
    modes:         ['trainer'],
    availableFrom: 4,
  },
  selfTraining: {
    label:         'My Training',
    description:   'Quick access to your own training profile',
    modes:         ['athlete', 'trainer'],
    availableFrom: 4,
  },
  recentSessions: {
    label:         'Recent Sessions',
    description:   'Latest sessions across your roster',
    modes:         ['athlete', 'trainer'],
    availableFrom: 5,
  },
  activeClients: {
    label:         'Active Clients',
    description:   'Clients with a session this month',
    modes:         ['trainer'],
    availableFrom: 4,
  },
  goals: {
    label:         'Goals',
    description:   'Active goals across all clients',
    modes:         ['athlete', 'trainer'],
    availableFrom: 4,
  },
  volume: {
    label:         'Volume This Week',
    description:   'Total weight lifted across all sessions',
    modes:         ['athlete', 'trainer'],
    availableFrom: 7,
  },
  streak: {
    label:         'Consistency Streak',
    description:   'Consecutive weeks with at least one session',
    modes:         ['athlete', 'trainer'],
    availableFrom: 7,
  },
  newClients: {
    label:         'New Clients',
    description:   'Clients added this month',
    modes:         ['trainer'],
    availableFrom: 7,
  },
}

// ── Default orders ────────────────────────────────────────────────────────────

export const DEFAULT_TRAINER_WIDGET_ORDER: WidgetId[] = [
  'atRisk',
  'selfTraining',
  'activeClients',
  'recentSessions',
  'goals',
]

export const DEFAULT_ATHLETE_WIDGET_ORDER: WidgetId[] = [
  'selfTraining',
  'recentSessions',
  'goals',
  'streak',
]

// ── Parse / serialize ─────────────────────────────────────────────────────────

/**
 * Parse a widgetProgression string from the DB into a validated WidgetId array.
 * Unknown IDs are silently filtered — handles future removals gracefully.
 * If the string is null/empty, returns the default order for the given mode.
 */
export function parseWidgetProgression(
  raw:  string | null | undefined,
  mode: 'athlete' | 'trainer',
): WidgetId[] {
  const defaultOrder = mode === 'athlete'
    ? DEFAULT_ATHLETE_WIDGET_ORDER
    : DEFAULT_TRAINER_WIDGET_ORDER

  if (!raw || raw.trim() === '') return defaultOrder

  const parsed = raw
    .split(',')
    .map((id) => id.trim())
    .filter((id): id is WidgetId => (WIDGET_IDS as readonly string[]).includes(id))
    // Also filter to only widgets available in the current mode
    .filter((id) => WIDGET_META[id].modes.includes(mode))

  // If parsing produces an empty array (all unknown), fall back to default
  return parsed.length > 0 ? parsed : defaultOrder
}

/**
 * Serialize a WidgetId array back to the DB string format.
 */
export function serializeWidgetProgression(order: WidgetId[]): string {
  return order.join(',')
}

/**
 * Get all widgets available for a given mode, in the order defined by
 * the trainer's widgetProgression. Used to populate the preferences list.
 * Widgets not in the trainer's progression are appended at the end (unchecked).
 */
export function getWidgetsForMode(
  progression: WidgetId[],
  mode: 'athlete' | 'trainer',
): { id: WidgetId; enabled: boolean; meta: WidgetMeta }[] {
  const modeWidgets = WIDGET_IDS.filter((id) => WIDGET_META[id].modes.includes(mode))
  const enabledSet  = new Set(progression)

  // Enabled widgets first (in progression order), then disabled ones
  const enabled  = progression.filter((id) => modeWidgets.includes(id))
  const disabled = modeWidgets.filter((id) => !enabledSet.has(id))

  return [
    ...enabled.map((id)  => ({ id, enabled: true,  meta: WIDGET_META[id] })),
    ...disabled.map((id) => ({ id, enabled: false, meta: WIDGET_META[id] })),
  ]
}

// ── CTA label options ─────────────────────────────────────────────────────────
// The selectable options for the "start training" CTA button.
// Trainers pick from this list (or will type a custom value in Phase 4.5).

export const CTA_LABEL_OPTIONS = [
  'Start Training',
  'Just Do It',
  "Let's Go",
  'Begin Session',
  'Train Now',
  'Get After It',
  'Time to Work',
  'Do the Work',
] as const

export type CtaLabel = typeof CTA_LABEL_OPTIONS[number]
