// ------------------------------------------------------------
// components/shell/AppInitSkeleton.tsx
//
// Shown while AuthProvider resolves the session on a cold load. A static shell
// skeleton (no data, no heavy imports) so the wait reads as "the app is loading"
// rather than a bare centred spinner. The session refresh round-trip can't be
// made instant — the access token is in-memory and lost on reload, so the refresh
// is unavoidable; this masks it with perceived structure. See the #19 perf plan.
// ------------------------------------------------------------

export function AppInitSkeleton(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-brand-primary flex flex-col animate-pulse" aria-hidden>
      {/* Content — mirrors the home surface: greeting · body map · Train CTA */}
      <div className="flex-1 w-full max-w-xl mx-auto px-5 pt-10 space-y-6">
        <div className="space-y-2">
          <div className="h-7  w-40 rounded-lg bg-surface-raised" />
          <div className="h-4  w-56 rounded    bg-surface-raised/70" />
        </div>
        <div className="h-64 rounded-2xl bg-surface-raised" />
        <div className="h-14 rounded-2xl bg-surface-raised" />
      </div>

      {/* Bottom nav placeholder — same footprint as the real tab bar */}
      <div className="h-16 border-t border-surface-border flex items-center justify-around px-6">
        {['a', 'b', 'c', 'd'].map((k) => (
          <div key={k} className="h-8 w-8 rounded-lg bg-surface-raised" />
        ))}
      </div>
    </div>
  )
}
