// ------------------------------------------------------------
// components/kpi/KpiCarousel.tsx (v1.6.0)
//
// 4-card KPI carousel with dot navigation.
// Mobile: swipe only (snap scroll). Desktop: arrows + dots.
// Cards 1-4 are the "always visible" set. Cards 5-8 are reached
// via carousel navigation.
// ------------------------------------------------------------

import { useState, useRef, useCallback } from 'react'
import { cn }                             from '@/lib/cn'
import { KpiCard }                        from './KpiCard'
import type { KpiCardData }               from './KpiCard'
import { interactions }                   from '@/lib/interactions'

const VISIBLE  = 4  // cards shown per page
const PAGE_GAP = 12 // px gap between cards

interface KpiCarouselProps {
  cards:     KpiCardData[]
  isLoading: boolean
}

function SkeletonCard(): React.JSX.Element {
  return (
    <div className="flex flex-col bg-surface rounded-2xl border border-surface-border p-4 min-h-[100px] w-full animate-pulse">
      <div className="h-2 w-16 bg-surface-border rounded mb-3" />
      <div className="h-6 w-12 bg-surface-border rounded mt-auto" />
      <div className="h-2 w-20 bg-surface-border rounded mt-2" />
    </div>
  )
}

export function KpiCarousel({ cards, isLoading }: KpiCarouselProps): React.JSX.Element {
  const [page, setPage]   = useState(0)
  const scrollRef         = useRef<HTMLDivElement>(null)
  const totalPages        = Math.ceil(cards.length / VISIBLE)

  const scrollToPage = useCallback((p: number): void => {
    if (!scrollRef.current) return
    const cardWidth = scrollRef.current.offsetWidth / VISIBLE
    scrollRef.current.scrollTo({
      left:     p * VISIBLE * (cardWidth + PAGE_GAP),
      behavior: 'smooth',
    })
    setPage(p)
  }, [])

  const handleScroll = useCallback((): void => {
    if (!scrollRef.current) return
    const cardWidth = scrollRef.current.offsetWidth / VISIBLE
    const p = Math.round(scrollRef.current.scrollLeft / (VISIBLE * (cardWidth + PAGE_GAP)))
    setPage(Math.min(p, totalPages - 1))
  }, [totalPages])

  if (isLoading) {
    return (
      <div className="grid grid-cols-4 gap-3">
        {/* eslint-disable-next-line react/no-array-index-key */}
        {Array.from({ length: VISIBLE }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Scroll container */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="grid gap-3 overflow-x-auto scrollbar-hidden snap-x snap-mandatory"
        style={{
          gridTemplateColumns: `repeat(${cards.length}, calc(25% - ${PAGE_GAP * 3 / 4}px))`,
          scrollSnapType: 'x mandatory',
        }}
      >
        {cards.map((card, i) => (
          <div
            key={i}  // eslint-disable-line react/no-array-index-key
            style={{ scrollSnapAlign: i % VISIBLE === 0 ? 'start' : 'none' }}
          >
            <KpiCard data={card} />
          </div>
        ))}
      </div>

      {/* Dots + arrows — only shown when more than one page */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-3">
          {/* Prev arrow — desktop only */}
          <button
            type="button"
            onClick={() => scrollToPage(Math.max(0, page - 1))}
            disabled={page === 0}
            aria-label="Previous KPIs"
            className={cn(
              'hidden md:flex w-6 h-6 items-center justify-center rounded-full',
              'border border-surface-border text-gray-500',
              'hover:text-gray-300 hover:border-gray-500',
              'disabled:opacity-30 disabled:cursor-not-allowed',
              'transition-all duration-150',
              interactions.button.press,
            )}
          >
            <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
              <path d="M8 10L4 6l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Dots */}
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}  // eslint-disable-line react/no-array-index-key
              type="button"
              onClick={() => scrollToPage(i)}
              aria-label={`Go to KPI page ${i + 1}`}
              className={cn(
                'rounded-full transition-all duration-200',
                i === page
                  ? 'w-4 h-1.5 bg-brand-highlight'
                  : 'w-1.5 h-1.5 bg-surface-border hover:bg-gray-500',
              )}
            />
          ))}

          {/* Next arrow — desktop only */}
          <button
            type="button"
            onClick={() => scrollToPage(Math.min(totalPages - 1, page + 1))}
            disabled={page === totalPages - 1}
            aria-label="Next KPIs"
            className={cn(
              'hidden md:flex w-6 h-6 items-center justify-center rounded-full',
              'border border-surface-border text-gray-500',
              'hover:text-gray-300 hover:border-gray-500',
              'disabled:opacity-30 disabled:cursor-not-allowed',
              'transition-all duration-150',
              interactions.button.press,
            )}
          >
            <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
              <path d="M4 10l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
