# Preferences — Relevance & Completeness Audit

**Date:** 2026-10-23
**Scope:** `apps/frontend/src/pages/PreferencesPage.tsx` + `apps/frontend/src/hooks/usePreferences.ts`
**Purpose:** Check every preference currently surfaced for (a) relevance to the athlete-first product, (b) completeness vs. what the app actually does, and (c) consistency. Findings only — no code changed by this audit.

---

## 1. What's on the screen today

| Section | Fields |
|---|---|
| **Profile** | Name · Weight unit (lbs/kg) |
| **Training Mode** | Display-only badge — **guarded to `trainerMode === 'trainer'`** (athletes don't see it) |
| **Dashboard** | CTA label · Session layout · Weekly session target · 1RM estimates *(athlete-only)* · PR notification type · Rest timer duration · Auto-send monthly reports · Timezone · Widget order (drag) |
| **Alerts** | At-risk alerts toggle · Alert color · Message tone |
| **Privacy** | Progress-photo sharing (private / selected / all) |
| **Account** | Change email · Change password · Devices · Export data |
| **Danger zone** | Deactivate account |

The hook (`usePreferences`) exposes: `ctaLabel, alertsEnabled, alertColorScheme, alertTone, sessionLayout, weeklySessionTarget, show1rmEstimate, autoReportEnabled, timezone, widgetOrder, trainerMode, prNotifyType, restDurationSeconds, photoSharingPreference`.

---

## 2. Relevance findings (athlete-first product)

The product is now athlete-first; new accounts are athlete-only. Several settings are **trainer-era concepts still shown to athletes**, where they describe something an athlete has no instance of:

1. **Alerts section is shown to everyone but is trainer-only in meaning.** "At-risk alerts" = "clients with no session in 14+ days." An athlete has no clients — the toggle, color, and tone all configure an alert that can never fire for them. **Recommend:** guard the whole Alerts section behind `trainerMode === 'trainer'`, exactly as the Training Mode section already is. *(High — confusing dead setting for the primary user.)*
2. **Auto-send monthly reports** — "for clients with auto-report enabled." Same issue: client-report machinery, surfaced to athletes. **Recommend:** trainer-guard it. *(High.)*
3. **Timezone** is justified in its own hint by reports + alerts ("send at 08:00 in your local time"). For an athlete with neither, its rationale evaporates. It may still be wanted later for scheduling, but today it's a setting whose stated purpose doesn't apply to athletes. **Recommend:** either trainer-guard, or re-justify with an athlete-relevant reason before keeping it. *(Medium.)*
4. **Widget order exposes internal phase numbers.** Greyed widgets show a "Phase 7" badge and "available in future updates" copy — dev vocabulary leaking into the user UI. **Recommend:** replace "Phase N" with "Coming soon" or hide unavailable widgets. *(Medium — polish/credibility.)*
5. **Privacy → progress-photo sharing** configures a feature that hasn't shipped ("when that feature launches"). A live control with no effect invites "why did nothing happen?" **Recommend:** hide until the sharing feature exists, or label it clearly as not-yet-active. *(Low–medium.)*

---

## 3. Completeness gaps (things the app does / will do, not yet in Preferences)

1. **Theme (light/dark).** The light/dark theme is an active goal with the token down-payment already shipped; a theme toggle is Step 4 of `task-plan-light-dark-theme.md`. It belongs in Preferences (Profile or a new "Appearance" section) once the sweep lands. **Currently absent.** *(Will be needed soon.)*
2. **Stepper increment size.** If the "hold-to-jump-5" idea ships, a per-user default step for weight/reps is a natural preference. Flag the linkage; don't build until that feature is scoped.
3. **Distance unit for cardio.** Cardio sets display meters ("400m"). There's a weight unit (lbs/kg) but **no distance unit (mi/km)** for cardio-focused users. *(Low — only if cardio is a real segment.)*
4. **Email verification status / resend** lives on a dashboard banner, not here — acceptable, but a read-only "email verified ✓ / resend" row in the Account section would be the conventional home. *(Low.)*
5. **Push notifications** — correctly absent (deferred post-SaaS). No action.

---

## 4. Consistency & polish

1. **Two different toggle implementations.** The shared `Toggle` component (w-11 h-6) is used for at-risk alerts, but 1RM estimates and auto-report use hand-rolled inline switches (w-10 h-5). **Recommend:** use `Toggle` everywhere. *(Low.)*
2. **Inconsistent save feedback.** Some fields render a "Saving…" spinner (CTA, PR type, rest timer, color, tone, photo sharing); others don't (weight unit, session layout, weekly target, 1RM, auto-report, timezone). **Recommend:** one consistent pattern. *(Low.)*
3. **Stale file header.** The top comment says "Trainer preferences (v1.4.5)" with "4 sections" — there are now 7 (Profile, Training Mode, Dashboard, Alerts, Privacy, Account, Danger zone). **Recommend:** refresh the header. *(Trivial.)*

---

## 5. Structure

The **"Dashboard" section is a catch-all** — it holds CTA label and widget order (genuinely dashboard), but also rest timer (a *session* setting), auto-send reports (*reporting*), and timezone (*system*). **Recommend** regrouping into clearer sections, e.g. **Training/Session** (session layout, rest timer, PR notify, 1RM, weekly target), **Reports** (auto-send, timezone) — trainer-only, and **Dashboard** (CTA, widgets). Reduces the "why is this here?" friction and makes the trainer-guarding in §2 fall out naturally.

---

## 6. Prioritized recommendation list

| # | Change | Priority |
|---|---|---|
| 1 | Trainer-guard the **Alerts** section (athletes have no clients) | High |
| 2 | Trainer-guard **Auto-send monthly reports** | High |
| 3 | Decide **Timezone** fate (guard or re-justify for athletes) | Medium |
| 4 | Replace **"Phase N"** widget badges with "Coming soon" / hide | Medium |
| 5 | Hide/label **progress-photo sharing** until the feature ships | Medium |
| 6 | Add **theme toggle** when light/dark sweep lands | Medium (scheduled) |
| 7 | Unify toggles + save feedback; refresh stale header | Low |
| 8 | Regroup "Dashboard" into Training / Reports / Dashboard | Low |

Items 1–2 are the highest-value: they remove settings that are actively confusing for the primary (athlete) user and are a small, low-risk guard — the exact pattern the Training Mode section already uses.
