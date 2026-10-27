// ------------------------------------------------------------
// components/ui/ScoreSlider.tsx
//
// A 1–10 subjective-score slider with a big live value readout and
// optional low/high end labels. Extracted from SessionCloseout so the
// end-session flow and the snapshot-capture sheet share one control.
//
// `dimmed` mutes the row until the value is real — a slider reading "5"
// that is about to save nothing would be lying about what it does, so
// callers that treat an untouched score as "not recorded" pass
// dimmed={value == null} and omit the metric unless the user moved it.
// ------------------------------------------------------------

import { cn } from '@/lib/cn'

interface ScoreSliderProps {
  label:      string
  value:      number
  onChange:   (v: number) => void
  hint?:      string
  lowLabel?:  string
  highLabel?: string
  /** Mute the row (e.g. an optional score the user has not set yet). */
  dimmed?:    boolean
}

export function ScoreSlider({
  label,
  value,
  onChange,
  hint,
  lowLabel,
  highLabel,
  dimmed = false,
}: ScoreSliderProps): React.JSX.Element {
  return (
    <div className={cn('space-y-2 transition-opacity', dimmed && 'opacity-50')}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-ink">{label}</p>
          {hint && <p className="text-xs text-ink-faint">{hint}</p>}
        </div>
        <span className="font-mono text-2xl font-bold text-ink w-8 text-right">{value}</span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer
          bg-surface-border
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-5
          [&::-webkit-slider-thumb]:h-5
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-command-blue
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:shadow-md"
        aria-label={`${label}: ${value} out of 10`}
      />
      {(lowLabel || highLabel) && (
        <div className="flex justify-between text-[10px] text-ink-faint uppercase tracking-wider">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      )}
    </div>
  )
}
