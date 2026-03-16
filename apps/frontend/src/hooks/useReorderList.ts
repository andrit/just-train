// ------------------------------------------------------------
// hooks/useReorderList.ts — Pointer-based drag-to-reorder (v1.4.5)
//
// Works with both mouse and touch (pointer events unify both).
// No external library — uses the browser's built-in Pointer Events API.
//
// USAGE:
//   const { items, dragHandleProps, isDragging, draggingIndex } = useReorderList({
//     items: widgetOrder,
//     onReorder: updateWidgetOrder,
//   })
//
//   {items.map((item, index) => (
//     <div key={item}>
//       {/* Attach to the drag handle element */}
//       <button {...dragHandleProps(index)} aria-label="Drag to reorder">
//         <HamburgerIcon />
//       </button>
//       {item}
//     </div>
//   ))}
//
// HOW IT WORKS:
//   1. pointerdown on handle → record startY, startIndex, capture pointer
//   2. pointermove → compute currentY offset, find which slot we've dragged into
//   3. pointerup → finalize order, call onReorder, clear state
//
// The list reorders in-place during drag (live preview).
// onReorder is called only on drop, not during drag.
// ------------------------------------------------------------

import { useState, useCallback, useRef } from 'react'

interface UseReorderListOptions<T> {
  items:      T[]
  onReorder:  (newOrder: T[]) => void
  /** Minimum pixels to move before drag is considered initiated */
  threshold?: number
}

interface UseReorderListResult<T> {
  /** Current display order (reorders during drag) */
  items:         T[]
  /** Attach these props to each drag handle element */
  dragHandleProps: (index: number) => {
    onPointerDown: (e: React.PointerEvent) => void
    style:         React.CSSProperties
    role:          string
    'aria-label':  string
    tabIndex:      number
  }
  /** True while a drag is in progress */
  isDragging:    boolean
  /** Index of the item currently being dragged (-1 if none) */
  draggingIndex: number
}

export function useReorderList<T>({
  items: initialItems,
  onReorder,
  threshold = 4,
}: UseReorderListOptions<T>): UseReorderListResult<T> {
  const [items,         setItems]        = useState<T[]>(initialItems)
  const [draggingIndex, setDraggingIndex]= useState(-1)

  // Sync external items changes (e.g. after save round-trip)
  // Only sync when not dragging to avoid fighting with live reorder
  const isDraggingRef = useRef(false)
  if (!isDraggingRef.current && items !== initialItems) {
    // shallow compare
    const same = items.length === initialItems.length &&
      items.every((item, i) => item === initialItems[i])
    if (!same) setItems(initialItems)
  }

  // Drag state tracked in refs (no re-render needed mid-drag)
  const startYRef    = useRef(0)
  const startIndexRef = useRef(0)
  const itemHeightRef = useRef(0)
  const currentItemsRef = useRef<T[]>(items)
  currentItemsRef.current = items

  const onPointerDown = useCallback((e: React.PointerEvent, index: number): void => {
    // Only respond to primary pointer (left mouse / single touch)
    if (e.button !== 0 && e.pointerType === 'mouse') return

    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)

    const handle   = e.currentTarget as HTMLElement
    const listItem = handle.closest('[data-reorder-item]') as HTMLElement | null
    itemHeightRef.current = listItem?.offsetHeight ?? 56

    startYRef.current     = e.clientY
    startIndexRef.current = index
    isDraggingRef.current = true

    setDraggingIndex(index)

    const onMove = (moveEvent: PointerEvent): void => {
      const deltaY = moveEvent.clientY - startYRef.current
      if (Math.abs(deltaY) < threshold && draggingIndex === -1) return

      // How many slots have we moved?
      const slotsMoved = Math.round(deltaY / itemHeightRef.current)
      const newIndex   = Math.max(
        0,
        Math.min(
          currentItemsRef.current.length - 1,
          startIndexRef.current + slotsMoved,
        ),
      )

      // Reorder items array for live preview
      setItems((prev) => {
        const next = [...prev]
        const [dragged] = next.splice(startIndexRef.current, 1)
        next.splice(newIndex, 0, dragged)
        // Update start so further movement is relative to new position
        // (only when we actually moved a slot)
        if (newIndex !== startIndexRef.current) {
          startYRef.current    = startYRef.current + (newIndex - startIndexRef.current) * itemHeightRef.current
          startIndexRef.current = newIndex
          setDraggingIndex(newIndex)
        }
        return next
      })
    }

    const onUp = (): void => {
      isDraggingRef.current = false
      setDraggingIndex(-1)
      // Call onReorder with the final order
      onReorder(currentItemsRef.current)
      handle.releasePointerCapture(e.pointerId)
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onUp)
    }

    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onUp)
  }, [onReorder, threshold, draggingIndex])

  const dragHandleProps = useCallback((index: number) => ({
    onPointerDown: (e: React.PointerEvent) => onPointerDown(e, index),
    style:         { touchAction: 'none', cursor: 'grab' } as React.CSSProperties,
    role:          'button' as const,
    'aria-label':  'Drag to reorder',
    tabIndex:      0,
  }), [onPointerDown])

  return {
    items,
    dragHandleProps,
    isDragging:    isDraggingRef.current,
    draggingIndex,
  }
}
