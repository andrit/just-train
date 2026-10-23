// ------------------------------------------------------------
// pages/HelpPage.tsx — in-app Help / user manual
//
// Renders lib/helpContent.ts (which mirrors docs/USER_MANUAL.md) as a single
// scrolling page with a sticky "jump to" chip row. The "For Trainers" section
// shows only for trainer-mode accounts. Static content — works offline.
// ------------------------------------------------------------

import { cn }                 from '@/lib/cn'
import { useMode }            from '@/lib/mode'
import { HELP_SECTIONS }      from '@/lib/helpContent'
import type { HelpBlock }     from '@/lib/helpContent'

// ── Block renderer ──────────────────────────────────────────────────────────────

function Block({ block }: { block: HelpBlock }): React.JSX.Element {
  if (block.kind === 'p') {
    return <p className="text-gray-400 leading-relaxed mb-3">{block.text}</p>
  }
  if (block.kind === 'ul') {
    return (
      <ul className="list-disc list-inside space-y-1.5 text-gray-400 mb-3">
        {block.items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    )
  }
  return (
    <ol className="list-decimal list-inside space-y-2 text-gray-400 mb-3">
      {block.items.map((item) => <li key={item} className="leading-relaxed">{item}</li>)}
    </ol>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HelpPage(): React.JSX.Element {
  const mode = useMode()

  const sections = HELP_SECTIONS.filter(
    (s) => s.audience === 'all' || mode.can.viewRoster,
  )

  const jumpTo = (id: string): void => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto pb-24">

      {/* Header */}
      <div className="mb-4 animate-slide-up">
        <h1 className="font-display text-3xl uppercase tracking-wide text-white">Help</h1>
        <p className="text-xs text-gray-500 mt-1">
          How Just Train works, screen by screen.
        </p>
      </div>

      {/* Sticky jump-to chip row */}
      <div className="sticky top-0 z-10 -mx-4 px-4 md:-mx-6 md:px-6 py-2 mb-6 bg-brand-primary/90 backdrop-blur border-b border-surface-border">
        <div className="flex gap-1 overflow-x-auto scrollbar-hidden">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => jumpTo(s.id)}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150',
                'bg-[#1C1C1C] border-surface-border text-gray-300 hover:border-gray-400 hover:text-gray-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-command-blue',
              )}
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-10 text-sm">
        {sections.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-20">
            <h2 className="font-display text-sm uppercase tracking-widest text-command-blue mb-3">
              {s.title}
            </h2>
            {s.blocks.map((block, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <Block key={i} block={block} />
            ))}
          </section>
        ))}
      </div>

      <p className="text-[10px] text-gray-600 mt-10">
        Can’t find an answer here? Reach out from the app store listing or your account email.
      </p>
    </div>
  )
}
