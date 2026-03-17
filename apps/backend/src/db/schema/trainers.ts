// ------------------------------------------------------------
// schema/trainers.ts — Trainers and Clients tables
//
// PHASE 2 ADDITIONS:
//   - emailVerified: boolean — reserved for future email verification flow
//   - lastLoginAt:   timestamp — audit trail
//
// PHASE 3C ADDITIONS:
//   - Trainer: subscriptionTier, subscriptionStatus, onboardedAt (SaaS prep)
//   - Client:  primaryFocus, secondaryFocus, progressionState, startDate,
//              caloricGoal, nutritionNotes, isSelf
//   - isSelf:  true = trainer is training themselves. Auto-created at registration.
//              The billing gate (Phase SaaS) allows free-tier trainers to train
//              themselves only — creating external clients requires a paid tier.
//
// pgEnum values are derived from Zod enum .options so there is
// exactly one source of truth: the shared enums file.
// DB enums and TypeScript types are always in sync.
// ------------------------------------------------------------

import { pgTable, uuid, text, boolean, timestamp, date, integer, decimal, pgEnum } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import {
  TrainerRoleEnum,
  WeightUnitEnum,
  ClientFocusEnum,
  ProgressionStateEnum,
  SubscriptionTierEnum,
  SubscriptionStatusEnum,
  TrainerModeEnum,
} from '@trainer-app/shared'

// ------------------------------------------------------------
// POSTGRES ENUMS
// ------------------------------------------------------------
export const trainerRoleEnum       = pgEnum('trainer_role',        TrainerRoleEnum.options)
export const weightUnitEnum        = pgEnum('weight_unit',         WeightUnitEnum.options)
export const clientFocusEnum       = pgEnum('client_focus',        ClientFocusEnum.options)
export const progressionStateEnum  = pgEnum('progression_state',   ProgressionStateEnum.options)
export const subscriptionTierEnum  = pgEnum('subscription_tier',   SubscriptionTierEnum.options)
export const subscriptionStatusEnum = pgEnum('subscription_status', SubscriptionStatusEnum.options)
export const trainerModeEnum       = pgEnum('trainer_mode',        TrainerModeEnum.options)

// ------------------------------------------------------------
// TRAINERS
// ------------------------------------------------------------
export const trainers = pgTable('trainers', {
  id:           uuid('id').primaryKey().defaultRandom(),
  name:         text('name').notNull(),
  email:        text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role:         trainerRoleEnum('role').notNull().default('trainer'),
  weightUnitPreference: weightUnitEnum('weight_unit_preference').notNull().default('lbs'),

  // Auth / audit
  emailVerified: boolean('email_verified').notNull().default(false),
  lastLoginAt:   timestamp('last_login_at'),

  // Phase 3C: SaaS subscription — not yet enforced (billing deferred to SaaS phase)
  // free    = limited usage for either mode
  // pro     = full features for either mode (different price per mode)
  // studio  = trainer-only, unlimited clients + team features
  subscriptionTier:   subscriptionTierEnum('subscription_tier').notNull().default('free'),
  subscriptionStatus: subscriptionStatusEnum('subscription_status').notNull().default('trialing'),
  onboardedAt:        timestamp('onboarded_at'),

  // Phase 3D: product mode — set at onboarding, determines nav and dashboard shape.
  // athlete = own training only, simplified nav, no client roster shown.
  // trainer = managing clients + optional self-training, full nav.
  // Mode and tier are orthogonal — both modes can be free or paid.
  trainerMode: trainerModeEnum('trainer_mode').notNull().default('trainer'),

  // Phase 3D: usage signals for future billing / value metric model.
  reportsSentCount: integer('reports_sent_count').notNull().default(0),
  lastActiveAt:     timestamp('last_active_at'),

  // Phase 4 Preferences — trainer/athlete personalization settings.
  //
  // ctaLabel: the call-to-action wording on the "start training" button.
  //   Default: 'Start Training'. Trainer can change to 'Just Do It', 'Let\'s Go', etc.
  //   Shown on the dashboard launcher. Athlete-branding feature.
  //
  // alertsEnabled: controls whether the at-risk client alert appears on
  //   every app open. true = show on open, false = never show.
  //   Can be toggled in the Preferences screen (Phase 4.5).
  //
  // widgetProgression: comma-delimited ordered list of widget IDs shown on
  //   the trainer dashboard. Stored as text (not jsonb) because we only ever
  //   read/write the whole value — never query inside it.
  //   e.g. "atRisk,selfTraining,recentSessions,activeClients,goals"
  //   Parsed to string[] in the UI with .split(',').
  //   Written back with .join(',') after drag-to-reorder or preference edit.
  //   Unknown IDs are filtered out silently on parse (forward-compat).
  ctaLabel:           text('cta_label').notNull().default('Start Training'),
  alertsEnabled:      boolean('alerts_enabled').notNull().default(true),
  widgetProgression:  text('widget_progression'),  // null = use mode default order

  // Phase 4.5: at-risk alert customization — color and message tone.
  // alertColorScheme: 'amber' | 'red' | 'blue' | 'green'
  // alertTone:        'clinical' | 'motivating' | 'firm'
  alertColorScheme:   text('alert_color_scheme').notNull().default('amber'),
  alertTone:          text('alert_tone').notNull().default('clinical'),

  // v1.5.0: session layout preference
  // 'horizontal' = workout blocks scroll left/right (default, focus mode)
  // 'vertical'   = workout blocks stacked top-to-bottom (overview mode)
  sessionLayout:      text('session_layout').notNull().default('horizontal'),

  // v1.6.0: KPI preferences
  // weeklySessionTarget: used for consistency score ("X/3 sessions this week")
  // show1rmEstimate:     athlete mode only — shows Epley 1RM estimates on KPI cards
  //                      default off, first-time tip surfaces it
  weeklySessionTarget: integer('weekly_session_target').notNull().default(3),
  show1rmEstimate:     boolean('show_1rm_estimate').notNull().default(false),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export type Trainer    = typeof trainers.$inferSelect
export type NewTrainer = typeof trainers.$inferInsert

// ------------------------------------------------------------
// CLIENTS
// ------------------------------------------------------------
export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),

  trainerId: uuid('trainer_id')
    .notNull()
    .references(() => trainers.id, { onDelete: 'cascade' }),

  // Identity
  name:        text('name').notNull(),
  email:       text('email'),
  phone:       text('phone'),
  photoUrl:    text('photo_url'),
  dateOfBirth: text('date_of_birth'),    // 'YYYY-MM-DD'

  // Legacy quick-notes (kept; structured goals go in client_goals table)
  goals: text('goals'),
  notes: text('notes'),

  // Phase 3C: Training focus — drives KPI selection in dashboard and reports
  primaryFocus:   clientFocusEnum('primary_focus'),
  secondaryFocus: clientFocusEnum('secondary_focus'),

  // Phase 3C: Progression state — assessment → programming → maintenance
  progressionState: progressionStateEnum('progression_state').notNull().default('assessment'),

  // Phase 3C: Start date
  startDate: text('start_date'),    // 'YYYY-MM-DD'

  // Phase 3C: Nutrition hook — deferred to a future phase; captures intent only
  caloricGoal:    integer('caloric_goal'),
  nutritionNotes: text('nutrition_notes'),

  // Phase 3C: self-training mode
  isSelf: boolean('is_self').notNull().default(false),

  // Phase 3D: updated whenever a session is logged for this client.
  // Used to compute "active client count" for usage-based billing
  // without a costly aggregation query each time.
  lastActiveAt: timestamp('last_active_at'),

  // Soft-delete — inactive clients hidden from UI but history preserved
  active: boolean('active').notNull().default(true),

  // v1.6.0: per-client KPI preferences (trainer configures per client)
  weeklySessionTarget: integer('weekly_session_target').notNull().default(3),
  show1rmEstimate:     boolean('show_1rm_estimate').notNull().default(false),

  // v1.7.0: tracks when the last monthly report was sent
  lastReportSentAt:    timestamp('last_report_sent_at'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export type Client    = typeof clients.$inferSelect
export type NewClient = typeof clients.$inferInsert

// ------------------------------------------------------------
// RELATIONS
// clientGoals and clientSnapshots relations are declared in their own files
// to avoid circular imports. trainers ← clients (here), clients ← goals/snapshots (there).
// ------------------------------------------------------------
export const trainersRelations = relations(trainers, ({ many }) => ({
  clients: many(clients),
}))

export const clientsRelations = relations(clients, ({ one }) => ({
  trainer: one(trainers, { fields: [clients.trainerId], references: [trainers.id] }),
}))
