// ------------------------------------------------------------
// components/templates/TemplatePickerSheet.tsx (v2.7.0)
//
// Bottom sheet that lists templates and lets the trainer
// pick one to load into a session plan.
// Called from SessionPlanPanel "Load template" button.
// ------------------------------------------------------------

import { useState }             from 'react'
import { cn }                   from '@/lib/cn'
import { interactions }         from '@/lib/interactions'
import { BottomSheet }          from '@/components/ui/BottomSheet'
import { Spinner }              from '@/components/ui/Spinner'
import { useTemplates }         from '@/lib/queries/templates'
import type { TemplateSummaryResponse } from '@trainer-app/shared'

interface TemplatePickerSheetProps {
  open:     boolean
  onClose:  () => void
  onSelect: (templateId: string) => void
  loading?: boolean
}

export function TemplatePickerSheet({
  open, onClose, onSelect, loading = false,
}: TemplatePickerSheetProps): React.JSX.Element {
  const { data: templates, isLoading } = useTemplates()
  const [search, setSearch] = useState('')

  const filtered = (templates ?? []).filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.description ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="80vh">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-surface-border shrink-0">
          <h2 className="text-sm font-medium text-ink">Load template</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-subtle hover:text-ink text-sm transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-surface-border shrink-0">
          <input
            type="text"
            placeholder="Search templates…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-brand-primary border border-surface-border rounded-xl px-3 py-2 text-sm text-ink placeholder-ink-faint focus:outline-none focus:border-command-blue/50"
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner size="md" className="text-command-blue" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-ink-subtle text-sm py-8">
              {search ? 'No templates match your search' : 'No templates yet'}
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map(t => (
                <TemplateRow
                  key={t.id}
                  template={t}
                  onSelect={() => onSelect(t.id)}
                  loading={loading}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  )
}

function TemplateRow({ template, onSelect, loading }: {
  template: TemplateSummaryResponse
  onSelect: () => void
  loading:  boolean
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={loading}
      className={cn(
        'w-full text-left bg-brand-secondary rounded-xl border border-surface-border',
        'px-4 py-3 transition-colors',
        'hover:border-command-blue/30 hover:bg-brand-secondary/80',
        interactions.button.base,
        interactions.button.press,
      )}
    >
      <p className="text-sm font-medium text-ink">{template.name}</p>
      {template.description && (
        <p className="text-xs text-ink-subtle mt-0.5 line-clamp-1">{template.description}</p>
      )}
    </button>
  )
}
