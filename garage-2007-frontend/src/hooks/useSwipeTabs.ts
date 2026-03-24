import { useRef, useEffect, useCallback } from 'react'

const SWIPE_THRESHOLD = 50
const MIN_SWIPE_DURATION_MS = 80 // reject taps shorter than this

/**
 * Hook for horizontal swipe-based tab navigation.
 * Returns a ref to attach to the swipeable container element.
 *
 * - Swipe left → next tab
 * - Swipe right → previous tab
 * - No wraparound (first/last tab stops)
 * - Vertical scrolling is not hijacked (horizontal must dominate)
 * - Multi-touch gestures (e.g. two-thumb tapping) are ignored
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
  const startTime = useRef(0)
  const multiTouch = useRef(false) // flag: was there ever >1 finger?

  const handleSwipe = useCallback((deltaX: number, deltaY: number) => {
    if (Math.abs(deltaX) < SWIPE_THRESHOLD) return
    // Horizontal movement must clearly dominate vertical
    if (Math.abs(deltaX) < Math.abs(deltaY) * 2) return

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
      // If gesture starts with multiple fingers, mark immediately
      multiTouch.current = e.touches.length > 1
      const touch = e.touches[0]
      startX.current = touch.clientX
      startY.current = touch.clientY
      currentX.current = touch.clientX
      currentY.current = touch.clientY
      startTime.current = Date.now()
    }

    const onTouchMove = (e: TouchEvent) => {
      // If any extra finger appears mid-gesture, invalidate
      if (e.touches.length > 1) {
        multiTouch.current = true
        return
      }
      const touch = e.touches[0]
      currentX.current = touch.clientX
      currentY.current = touch.clientY
    }

    const onTouchEnd = () => {
      // Reject multi-touch gestures entirely
      if (multiTouch.current) return
      // Reject very short gestures (taps)
      if (Date.now() - startTime.current < MIN_SWIPE_DURATION_MS) return

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

