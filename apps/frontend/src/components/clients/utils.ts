// ------------------------------------------------------------
// components/clients/utils.ts — Client display helpers
// ------------------------------------------------------------

import type { ClientResponse } from '@trainer-app/shared'

// ── Progression state display ─────────────────────────────────────────────────

export const PROGRESSION_STATE_LABEL: Record<string, string> = {
  assessment:  'Assessment',
  programming: 'Programming',
  maintenance: 'Maintenance',
}

export const PROGRESSION_STATE_COLOR: Record<string, string> = {
  assessment:  'bg-amber-500/15 text-amber-400 border-amber-500/20',
  programming: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  maintenance: 'bg-sky-500/15 text-sky-400 border-sky-500/20',
}

// ── Focus display ─────────────────────────────────────────────────────────────

export const FOCUS_LABEL: Record<string, string> = {
  cardio:        'Cardio',
  resistance:    'Resistance',
  calisthenics:  'Calisthenics',
  mixed:         'Mixed',
}

export const FOCUS_ICON: Record<string, string> = {
  cardio:       '🏃',
  resistance:   '🏋️',
  calisthenics: '💪',
  mixed:        '⚡',
}

// ── At-risk detection ─────────────────────────────────────────────────────────

export const AT_RISK_DAYS = 14

export function isAtRisk(client: ClientResponse): boolean {
  if (!client.lastActiveAt) return false
  const daysSince = (Date.now() - new Date(client.lastActiveAt).getTime()) / (1000 * 60 * 60 * 24)
  return daysSince > AT_RISK_DAYS
}

export function hasNoActivity(client: ClientResponse): boolean {
  return client.lastActiveAt === null
}

export function daysSinceLastSession(client: ClientResponse): number | null {
  if (!client.lastActiveAt) return null
  return Math.floor((Date.now() - new Date(client.lastActiveAt).getTime()) / (1000 * 60 * 60 * 24))
}

export function lastSessionLabel(client: ClientResponse): string {
  const days = daysSinceLastSession(client)
  if (days === null) return 'No sessions yet'
  if (days === 0)    return 'Today'
  if (days === 1)    return 'Yesterday'
  if (days < 7)      return `${days}d ago`
  if (days < 30)     return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

// ── Initials ──────────────────────────────────────────────────────────────────

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

// ── Tab incompleteness ────────────────────────────────────────────────────────
// Used to show indicator dots on profile tabs.

export function isOverviewIncomplete(client: ClientResponse): boolean {
  return !client.primaryFocus || !client.startDate
}

export function isBaselineIncomplete(hasSnapshots: boolean): boolean {
  return !hasSnapshots
}

export function hasNoActiveGoals(goals: { achievedAt: string | null }[]): boolean {
  return goals.filter((g) => g.achievedAt === null).length === 0
}
