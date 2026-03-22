import { useRef, useEffect, useCallback } from 'react'

const SWIPE_THRESHOLD = 50

/**
 * Hook for horizontal swipe-based tab navigation.
 * Returns a ref to attach to the swipeable container element.
 *
 * - Swipe left → next tab
 * - Swipe right → previous tab
 * - No wraparound (first/last tab stops)
 * - Vertical scrolling is not hijacked (horizontal must dominate)
 */
export function useSwipeTabs(
  tabIds: string[],
  activeTab: string,
  onTabChange: (id: string) => void,
): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null)
  const startX = useRef(0)
  const startY = useRef(0)
  const currentX = useRef(0)
  const currentY = useRef(0)

  const handleSwipe = useCallback((deltaX: number, deltaY: number) => {
    if (Math.abs(deltaX) < SWIPE_THRESHOLD) return
    if (Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return

    const currentIndex = tabIds.indexOf(activeTab)
    if (currentIndex === -1) return

    if (deltaX < 0 && currentIndex < tabIds.length - 1) {
      onTabChange(tabIds[currentIndex + 1])
    } else if (deltaX > 0 && currentIndex > 0) {
      onTabChange(tabIds[currentIndex - 1])
    }
  }, [tabIds, activeTab, onTabChange])

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      startX.current = touch.clientX
      startY.current = touch.clientY
      currentX.current = touch.clientX
      currentY.current = touch.clientY
    }

    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0]
      currentX.current = touch.clientX
      currentY.current = touch.clientY
    }

    const onTouchEnd = () => {
      const deltaX = currentX.current - startX.current
      const deltaY = currentY.current - startY.current
      handleSwipe(deltaX, deltaY)
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [handleSwipe])

  return ref
}
