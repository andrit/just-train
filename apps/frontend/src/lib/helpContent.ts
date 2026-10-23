// ------------------------------------------------------------
// lib/helpContent.ts
//
// In-app source of truth for the Help screen (pages/HelpPage.tsx).
// Mirrors docs/USER_MANUAL.md — keep the two in sync. The markdown file
// stays the doc-of-record; this is its in-app rendering. When the manual
// changes, update this; when this changes, update the manual.
//
// Sections marked audience: 'trainer' render only for trainer-mode accounts.
// ------------------------------------------------------------

export type HelpBlock =
  | { kind: 'p';     text: string }
  | { kind: 'ul';    items: string[] }
  | { kind: 'steps'; items: string[] }

export interface HelpSection {
  id:       string
  title:    string
  audience: 'all' | 'trainer'
  blocks:   HelpBlock[]
}

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    audience: 'all',
    blocks: [
      { kind: 'steps', items: [
        'Create an account with email and password. You get a verification email — verifying keeps your account recoverable, but you can start training right away.',
        'Pick your mode on the welcome screen: Athlete (a complete training app for you) or Trainer (everything the athlete has, plus a client roster, reports, and at-risk alerts). Athlete to Trainer is not a casual switch, so choose the one that fits.',
        'Install it to your phone (recommended). On iPhone: Share, then Add to Home Screen. On Android: the browser offers Install, or use the in-app prompt after your first session. Once installed it opens full-screen, works offline, and keeps you signed in.',
      ] },
    ],
  },
  {
    id: 'home-and-my-training',
    title: 'Home & My Training',
    audience: 'all',
    blocks: [
      { kind: 'p', text: 'Home is the launch screen — a single screen with no scrolling: a greeting, a body figure shaded by what you have trained in the last 30 days, and the Train button. Home is for starting; all your feedback lives one tap away in My Training.' },
      { kind: 'p', text: 'My Training is your dashboard — the progress picture:' },
      { kind: 'ul', items: [
        'Headline stats — Streak, This week, Last session — always visible up top; swipe the carousel for more (consistency, volume, PRs, energy).',
        'Recent Sessions — tap any to review it.',
        'Volume per session and Volume by body part charts — your trend and your balance.',
        'Tabs: Overview, Timeline, Baseline, PRs, Challenges.',
      ] },
    ],
  },
  {
    id: 'body-map',
    title: 'The body map',
    audience: 'all',
    blocks: [
      { kind: 'p', text: 'The figure on Home shows which muscles you have been training in the last 30 days — brighter blue means more sessions, grey means untrained. It is a glance answer to "am I hitting everything?"' },
      { kind: 'ul', items: [
        'Tap the whole figure for the Body breakdown: every muscle grouped by body part with its 30-day count, plus your most-trained and most-neglected at the top.',
        'Tap a region (e.g. your quads) to scope the sheet to just that area.',
        'Tap the Neglected tile to list the muscles you have not trained in the last 30 days.',
        'Tap a muscle to see the exercises that work it (prime movers first), and open one to add it to a workout.',
      ] },
      { kind: 'p', text: 'So a cold spot on the figure turns straight into "here is how to train it."' },
    ],
  },
  {
    id: 'logging-a-session',
    title: 'Logging a session',
    audience: 'all',
    blocks: [
      { kind: 'p', text: 'Tap Train on Home, then:' },
      { kind: 'steps', items: [
        'Start a session — blank, or from a template. You can also plan a future session from the launcher: build it now, execute it later.',
        'Add blocks and exercises. Each block is a type (resistance, cardio, calisthenics, stretching, cooldown); add exercises from the library or quick-add a new one mid-session.',
        'Log your sets. The app pre-fills targets and your last-time numbers. Resistance: weight by reps, with an optional weight ramp to auto-step the load. Cardio: time, distance, and intensity. Calisthenics: reps or a timed hold. Stretching/Cooldown: hold time. Single-limb moves are tracked per side. Circuits group exercises to perform round-robin.',
        'Personal records flash when you beat your best Load (heaviest) or Volume (weight by reps) for an exercise, and a chip marks the record-holding set.',
        'The rest timer starts automatically after a set — it counts down in a banner and buzzes at zero.',
        'End the session in one step: name it (or let it auto-name by date), review what you did, and optionally rate how you felt (energy / mobility / stress). Nothing is saved until you tap Finish, so an abandoned session stays resumable.',
      ] },
      { kind: 'p', text: 'The active session rides along as a pill if you leave it — tap to jump back in. It keeps working offline; your sets sync when you are back on signal.' },
    ],
  },
  {
    id: 'exercises',
    title: 'Exercises',
    audience: 'all',
    blocks: [
      { kind: 'ul', items: [
        'Filter the library by workout type, body part, equipment, or search by name.',
        'Each exercise shows a muscle map (which muscles it works, primary vs secondary), plus equipment, difficulty, and instructions.',
        'Add to Workout adds it to your open or planned session (it asks which if you have more than one).',
        'Add your own — create a custom exercise, including its muscles, so it shows up on your map too.',
      ] },
    ],
  },
  {
    id: 'templates',
    title: 'Templates',
    audience: 'all',
    blocks: [
      { kind: 'p', text: 'The Templates library lets you save and reuse session plans:' },
      { kind: 'ul', items: [
        'Build a template (blocks, exercises, targets), or save any session as a template.',
        'Apply a template to start a new session pre-filled with its plan.',
        'Fork a template to make a modified copy.',
      ] },
    ],
  },
  {
    id: 'tracking-progress',
    title: 'Tracking progress',
    audience: 'all',
    blocks: [
      { kind: 'ul', items: [
        'Snapshots (Baseline tab) — capture measurements over time (weight, body fat, resting HR, a few performance numbers, and how you feel). The app shows the change from your baseline.',
        'Goals (Overview tab) — statements of intent, kept as history so your whole arc is visible.',
        'Personal Bests (PRs tab) — your best estimated 1-rep-max and best volume per exercise.',
        'Per-exercise progress — open an exercise’s detail to see its estimated 1RM trend and whether that lift is actually growing.',
        'Challenges — measurable goals with a deadline; progress updates automatically as you log.',
        'Progress photos — attach photos to a snapshot and compare before/after. Photos are private by default; you choose what, if anything, is shareable.',
      ] },
    ],
  },
  {
    id: 'settings-and-account',
    title: 'Settings & account',
    audience: 'all',
    blocks: [
      { kind: 'p', text: 'Preferences covers your profile (name, weight unit), dashboard options (the Train button label, layout, widgets), and alert styling.' },
      { kind: 'p', text: 'Account (inside Preferences):' },
      { kind: 'ul', items: [
        'Change password (signs out your other devices), change sign-in email (confirmed via a link), and forgot-password / reset.',
        'Devices — see where you are signed in and sign out a device, or everywhere.',
        'Download my data — a full export of everything you have logged.',
        'Deactivate account — soft-deletes it; signing back in within 30 days restores it, after which it is permanently purged.',
      ] },
    ],
  },
  {
    id: 'offline',
    title: 'Offline',
    audience: 'all',
    blocks: [
      { kind: 'p', text: 'Just Train works without a signal once installed. You can log a whole session offline — sets queue locally and sync automatically when you reconnect. A banner shows when you are offline or syncing.' },
    ],
  },
  {
    id: 'for-trainers',
    title: 'For Trainers',
    audience: 'trainer',
    blocks: [
      { kind: 'p', text: 'Everything above is your own training (your My Training is your personal athlete experience). As a Trainer you also get:' },
      { kind: 'ul', items: [
        'Clients — a roster of the people you coach. Each client has the same Overview / Timeline / Baseline / PRs / Challenges profile you have for yourself.',
        'Plan the day — build and run sessions for any client; multiple planned sessions can be open at once.',
        'Monthly reports — a progress email per client (goal arc, key metrics, and your note), sent on demand or on a schedule.',
        'At-risk alerts — a heads-up when a client has not logged a session in a while.',
        'Challenges you set for clients, with progress tracked automatically.',
      ] },
    ],
  },
]
