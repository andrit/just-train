# TrainerApp — Color System

> The design language for a training app lives at the intersection of discipline and energy.
> Every color earns its place by doing a specific job. Nothing is decorative.

---

## The Palette

| Name | Hex | Role |
|---|---|---|
| **Forge Black** | `#000000` | Absolute ground. Foundation surface. |
| **Chalk White** | `#FFFFFF` | Absolute light. Primary text on dark. |
| **Iron Grey** | `#8A9099` | Structure. Neutral body. Secondary text and borders. |
| **Ember Red** | `#D91B1B` | Intensity design element. |
| **Command Blue** | `#1B50D9` | Action design element. |
| **Signal Yellow** | `#FFE200` | Notification design element. |

---

## Design Element Definitions

### 🔴 Ember Red `#D91B1B` — Intensity

The color of heat, effort, and maximum output. Ember Red appears at moments of peak
physiological or emotional intensity in the training experience.

**What it signals:** danger, effort, urgency, threshold, personal record, failure, fire.

**Where it lives:**
- PR flash — a set that breaks a personal record
- Destructive actions — delete, cancel, discard (the cost of the action is high)
- At-risk client flags — 21+ days without a session
- Rest timer in final 3 seconds — the body is at its limit
- End-of-session energy indicator when scores are low
- Challenge deadline approaching (≤48 hours)

**Where it does not belong:**
- Primary navigation (it creates false urgency in neutral contexts)
- Success states (success is relief, not intensity)
- Anything routine — its power comes from rarity

---

### 🔵 Command Blue `#1B50D9` — Action

The color of clarity, direction, and decision. Command Blue appears wherever the
trainer or athlete needs to do something intentional — a deliberate act, not a reaction.

**What it signals:** primary action, navigation, confirmation, trust, forward motion.

**Where it lives:**
- Primary buttons — "Log Set", "Start Session", "Save Template"
- Active navigation state — current tab, selected item
- Interactive links and tappable rows
- Progress bars and streak indicators
- Session timeline — active/in-progress states

**Where it does not belong:**
- Error or warning states (blue reads as calm, not alarming)
- Achievement moments (those belong to yellow or white)
- Anything passive — it should only appear on things that respond to touch

---

### 🟡 Signal Yellow `#FFE200` — Notification

The most visually arresting color in the palette. Signal Yellow is used exclusively to
demand immediate attention. Its power depends entirely on restraint — overuse destroys it.

**What it signals:** new information, alert, achievement, badge, streak, something requires notice.

**Where it lives:**
- Notification badges and unread counts
- Achievement unlocks — first PR, streak milestones
- At-risk alerts at the trainer-level (the flag that something needs attention, not the severity)
- Challenge completion celebration
- "New" labels on content the trainer hasn't seen

**Where it does not belong:**
- Decorative use of any kind
- Hover states or transitions (yellow in motion is noise)
- Anywhere it appears alongside Ember Red (the two compete; they cannot share a card)

---

## Color Theory

### Foundation: The Neutral Stack

Forge Black, Chalk White, and Iron Grey carry no semantic meaning. They are the
stage. Every surface, every card, every body-text line is built from these three.

Iron Grey bridges the two absolutes. In a dark-primary UI, it provides the liveable
middle register — secondary text, borders, placeholders, icons at rest. It reads as
physical material (cast iron plates, barbell knurling) rather than digital decoration.

### The Triadic Chromatic Accents

Ember Red, Command Blue, and Signal Yellow are the three primary colors. This is
not coincidental — primary colors have maximum perceptual separation. The eye
distinguishes them without effort. Each accent can be read and understood in
peripheral vision without focus.

```
              Signal Yellow #FFE200
              (52° on the color wheel)
             /
Ember Red --+-- Command Blue
#D91B1B          #1B50D9
(0° / 360°)      (222°)
```

Red and Blue sit 222° apart — close to complementary opposition. Their tension is
productive: high contrast without clashing, because they are anchored to different
jobs. Yellow sits between them at 52°, acting as the mediating third.

### Psychological Assignments

The three chromatic colors map to a familiar human signaling system:

| Color | Physiological response | Training context |
|---|---|---|
| Red | Activating. Raises alertness. Signals cost. | Effort, danger, threshold |
| Blue | Clarifying. Signals safety and direction. | Decision, action, control |
| Yellow | Orienting. Highest luminance. Demands notice. | Alert, reward, novelty |

This is why traffic lights, emergency systems, and athletic warning systems
globally use these three — they work before the brain has time to think.

### Saturation and Luminance Parity

Ember Red and Command Blue are calibrated to the same saturation and lightness in
HSL space:

| Color | Hex | H | S | L |
|---|---|---|---|---|
| Ember Red | `#D91B1B` | 0° | 77% | 47% |
| Command Blue | `#1B50D9` | 222° | 77% | 47% |

Identical S and L means they read as equally weighted. Neither dominates the other
at a system level — dominance is determined by context and area, not by an
inherent brightness advantage.

Signal Yellow deliberately breaks this parity (L=50%, S=100%) because notification
elements must be intrinsically louder. A yellow at 77% saturation would be muddy
and weak. It needs to shout.

### Rules

1. **One chromatic color per element.** Never Ember Red and Command Blue on the same component.
2. **Never Signal Yellow alongside Ember Red.** They both demand attention; they cancel each other.
3. **Iron Grey is not a substitute for Signal Yellow.** If the thing needs to be noticed, use yellow.
4. **Ember Red is never used for primary navigation.** It would make the whole UI feel dangerous.
5. **Command Blue is the default action color. Ember Red is the peak-state action color.**
   A normal "Save" is blue. A "End Session" that closes something real is red.
6. **Signal Yellow appears sparingly.** A UI where everything is notable has noted nothing.

---

## Relationship to Existing Tokens

The current Tailwind config uses `brand.highlight` (`#e94560`) as the red accent.
That value will migrate to Ember Red (`#D91B1B`) as the design system is applied.
The `brand.accent` (`#0f3460`) deep blue will migrate to Command Blue (`#1B50D9`).

Token names in `tailwind.config.js`:

```js
colors: {
  // Neutral foundation
  'forge-black':   '#000000',
  'chalk-white':   '#FFFFFF',
  'iron-grey':     '#8A9099',  // also mapped to brand.primary (page background)

  // Chromatic accents — semantic, not decorative
  'ember-red':     '#D91B1B',  // intensity
  'command-blue':  '#1B50D9',  // action — also replaces brand.highlight in focus rings
  'signal-yellow': '#FFE200',  // notification
}
```

`brand.highlight` (`#e94560`) has been removed. Component-level references to
`brand-highlight` are being migrated to `command-blue` (actions/focus),
`ember-red` (destructive/intensity), or `signal-yellow` (notifications) by intent.
