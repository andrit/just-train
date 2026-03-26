// ------------------------------------------------------------
// pages/TemplatesPage.tsx (v2.7.0)
//
// Full template library:
//   - Grid of template cards with workout type badges
//   - Search filter
//   - Fork, Edit, Delete actions per card
//   - New template → opens builder sheet
// ------------------------------------------------------------

import { useState, useEffect, useRef } from 'react'
import { cn }                          from '@/lib/cn'
import { interactions }                from '@/lib/interactions'
import {
  useTemplates,
  useDeleteTemplate,
  useForkTemplate,
}                                      from '@/lib/queries/templates'
import { Spinner }                     from '@/components/ui/Spinner'
import { ConfirmDialog }               from '@/components/ui/ConfirmDialog'
import { TemplateBuilderSheet }        from '@/components/templates/TemplateBuilderSheet'
import { toast }                       from '@/store/toastStore'
import { apiClient }                   from '@/lib/api'
import type { TemplateSummaryResponse } from '@trainer-app/shared'

export default function TemplatesPage(): React.JSX.Element {
  const { data: templates, isLoading, refetch } = useTemplates()
  const deleteTemplate = useDeleteTemplate()
  const forkTemplate   = useForkTemplate()

  const [search,      setSearch]      = useState('')
  const [builderOpen, setBuilderOpen] = useState(false)
  const [editId,      setEditId]      = useState<string | null>(null)
  const [deleteId,    setDeleteId]    = useState<string | null>(null)
  const [seeding,     setSeeding]     = useState(false)
  const seededRef = useRef(false)

  // Auto-seed defaults when the list is empty — fires once per mount
  useEffect(() => {
    if (isLoading) return
    if (seededRef.current) return
    if ((templates ?? []).length > 0) return
    seededRef.current = true
    setSeeding(true)
    apiClient.post('/auth/seed-templates', {})
      .then(() => refetch())
      .catch(() => toast.error('Could not load default templates'))
      .finally(() => setSeeding(false))
  }, [isLoading, templates, refetch])

  const filtered = (templates ?? []).filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.description ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const handleDelete = (): void => {
    if (!deleteId) return
    deleteTemplate.mutate(deleteId, {
      onSuccess: () => { setDeleteId(null); toast.success('Template deleted') },
      onError:   () => toast.error('Failed to delete template'),
    })
  }

  const handleFork = (id: string, name: string): void => {
    forkTemplate.mutate({ id, name: `${name} (copy)` }, {
      onSuccess: () => toast.success('Template duplicated'),
      onError:   () => toast.error('Failed to duplicate template'),
    })
  }

  const handleEdit = (id: string): void => {
    setEditId(id)
    setBuilderOpen(true)
  }

  const handleNew = (): void => {
    setEditId(null)
    setBuilderOpen(true)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-surface-border shrink-0">
        <div>
          <h1 className="text-lg font-display font-medium text-white">Templates</h1>
          <p className="text-xs text-gray-500 mt-0.5">Reusable workout programs</p>
        </div>
        <button
          type="button"
          onClick={handleNew}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-xl',
            'bg-brand-highlight/15 border border-brand-highlight/30',
            'text-xs font-medium text-brand-highlight',
            interactions.button.base,
            interactions.button.press,
          )}
        >
          <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          New template
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-surface-border shrink-0">
        <input
          type="text"
          placeholder="Search templates…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-brand-primary border border-surface-border rounded-xl px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand-highlight/50"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading || seeding ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Spinner size="md" className="text-brand-highlight" />
            {seeding && (
              <p className="text-xs text-gray-500">Loading default templates…</p>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-2xl mb-3" aria-hidden>📋</p>
            <p className="text-gray-400 font-medium">
              {search ? 'No templates match your search' : 'No templates yet'}
            </p>
            {!search && (
              <p className="text-gray-600 text-sm mt-1">
                Create your first template or fork one of the defaults
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(t => (
              <TemplateCard
                key={t.id}
                template={t}
                onEdit={() => handleEdit(t.id)}
                onFork={() => handleFork(t.id, t.name)}
                onDelete={() => setDeleteId(t.id)}
                forking={forkTemplate.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* Template builder sheet */}
      <TemplateBuilderSheet
        open={builderOpen}
        templateId={editId}
        onClose={() => { setBuilderOpen(false); setEditId(null) }}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteId}
        title="Delete template?"
        message="This template will be permanently deleted. Sessions that used it are not affected."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}

// ── Template card ─────────────────────────────────────────────────────────────

interface TemplateCardProps {
  template:  TemplateSummaryResponse
  onEdit:    () => void
  onFork:    () => void
  onDelete:  () => void
  forking:   boolean
}

function TemplateCard({ template, onEdit, onFork, onDelete }: TemplateCardProps): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="bg-brand-secondary rounded-2xl border border-surface-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-100 truncate">{template.name}</p>
          {template.description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{template.description}</p>
          )}
        </div>

        {/* Actions menu */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-surface-border/30 transition-colors"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <circle cx="8" cy="3" r="1.2" />
              <circle cx="8" cy="8" r="1.2" />
              <circle cx="8" cy="13" r="1.2" />
            </svg>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 z-50 w-44 bg-brand-primary border border-surface-border rounded-xl shadow-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => { onEdit(); setMenuOpen(false) }}
                  className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-surface-border/30 transition-colors"
                >
                  Edit template
                </button>
                <button
                  type="button"
                  onClick={() => { onFork(); setMenuOpen(false) }}
                  className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-surface-border/30 transition-colors border-t border-surface-border"
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={() => { onDelete(); setMenuOpen(false) }}
                  className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-surface-border/30 transition-colors border-t border-surface-border"
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Created date */}
      <p className="text-[10px] text-gray-700 mt-3">
        Created {new Date(template.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </p>
    </div>
  )
}
