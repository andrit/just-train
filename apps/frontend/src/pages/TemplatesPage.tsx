// ------------------------------------------------------------
// pages/TemplatesPage.tsx (v2.7.0)
// Server-side search, debounced, breadcrumb chip, auto-seed
// ------------------------------------------------------------

import { useState, useEffect, useRef, useCallback } from 'react'
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
  const [inputValue,  setInputValue]  = useState('')
  const [search,      setSearch]      = useState('')
  const [builderOpen, setBuilderOpen] = useState(false)
  const [editId,      setEditId]      = useState<string | null>(null)
  const [deleteId,    setDeleteId]    = useState<string | null>(null)
  const seededRef   = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: templates, isLoading, refetch } = useTemplates(search || undefined)
  const deleteTemplate = useDeleteTemplate()
  const forkTemplate   = useForkTemplate()

  // Debounce 300ms then send to backend
  const handleSearchChange = useCallback((value: string): void => {
    setInputValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setSearch(value), 300)
  }, [])

  const clearSearch = (): void => {
    setInputValue('')
    setSearch('')
  }

  // Auto-seed defaults once per mount — backend handles per-name idempotency
  // so this is safe to call even if the trainer already has templates
  useEffect(() => {
    if (isLoading || search || seededRef.current) return
    seededRef.current = true
    apiClient.post('/auth/seed-templates', {})
      .then(() => refetch())
      .catch(() => { /* silent — don't error if user already has all defaults */ })
  }, [isLoading, search, refetch])

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
          onClick={() => { setEditId(null); setBuilderOpen(true) }}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-xl',
            'bg-command-blue/15 border border-command-blue/30',
            'text-xs font-medium text-command-blue',
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
      <div className="px-4 pt-3 pb-2 border-b border-surface-border shrink-0">
        <div className="relative">
          <svg viewBox="0 0 16 16" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none">
            <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.5" />
            <path d="M11 11l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, description, or muscle group…"
            value={inputValue}
            onChange={e => handleSearchChange(e.target.value)}
            className="w-full bg-brand-primary border border-surface-border rounded-xl pl-8 pr-8 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-command-blue/50"
          />
          {inputValue && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300 transition-colors"
            >
              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {/* Active search breadcrumb chip */}
        {search && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-gray-600 uppercase tracking-wider">Searching for</span>
            <button
              type="button"
              onClick={clearSearch}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-command-blue/15 border border-command-blue/30 text-xs text-command-blue"
            >
              {search}
              <svg viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            {!isLoading && (
              <span className="text-[10px] text-gray-600">
                {(templates ?? []).length} result{(templates ?? []).length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Spinner size="md" className="text-command-blue" />
          </div>
        ) : (templates ?? []).length === 0 ? (
          <div className="text-center py-12">
            <p className="text-2xl mb-3" aria-hidden>📋</p>
            <p className="text-gray-400 font-medium">
              {search ? `No templates found for "${search}"` : 'No templates yet'}
            </p>
            {search ? (
              <button type="button" onClick={clearSearch} className="text-sm text-command-blue mt-2">
                Clear search
              </button>
            ) : (
              <p className="text-gray-600 text-sm mt-1">Tap "+ New template" to get started</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {(templates ?? []).map(t => (
              <TemplateCard
                key={t.id}
                template={t}
                onEdit={() => { setEditId(t.id); setBuilderOpen(true) }}
                onFork={() => handleFork(t.id, t.name)}
                onDelete={() => setDeleteId(t.id)}
              />
            ))}
          </div>
        )}
      </div>

      <TemplateBuilderSheet
        open={builderOpen}
        templateId={editId}
        onClose={() => { setBuilderOpen(false); setEditId(null) }}
      />

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

function TemplateCard({ template, onEdit, onFork, onDelete }: {
  template: TemplateSummaryResponse
  onEdit:   () => void
  onFork:   () => void
  onDelete: () => void
}): React.JSX.Element {
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
                <button type="button" onClick={() => { onEdit(); setMenuOpen(false) }}
                  className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-surface-border/30 transition-colors">
                  Edit template
                </button>
                <button type="button" onClick={() => { onFork(); setMenuOpen(false) }}
                  className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-surface-border/30 transition-colors border-t border-surface-border">
                  Duplicate
                </button>
                <button type="button" onClick={() => { onDelete(); setMenuOpen(false) }}
                  className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-surface-border/30 transition-colors border-t border-surface-border">
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <p className="text-[10px] text-gray-700 mt-3">
        Created {new Date(template.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </p>
    </div>
  )
}
