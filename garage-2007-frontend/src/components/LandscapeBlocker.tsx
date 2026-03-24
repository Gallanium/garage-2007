import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'

// Объявляем глобальный тип для Telegram API, чтобы избежать ошибок TS
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        platform?: string
        lockOrientation?: () => void
        [key: string]: unknown
      }
    }
  }
}

/**
 * Игровой блокировщик ориентации. 
 * Если юзер с мобильного телефона переворачивает его в горизонтальное положение (landscape),
 * мы полностью перекрываем UI экраном с просьбой вернуться в портретный режим.
 * (На десктопе landscape игнорируется, так как само окно там горизонтальное).
 */
export function LandscapeBlocker() {
  const [isMobileLandscape, setIsMobileLandscape] = useState(false)

  useEffect(() => {
    const platform = window.Telegram?.WebApp?.platform || 'unknown'
    const isMobile = platform === 'android' || platform === 'ios' || /android|iphone|ipad|ipod/i.test(navigator.userAgent)

    const checkOrientation = () => {
      if (!isMobile) {
        setIsMobileLandscape(false)
        return
      }
      
      // На мобилках: ширина больше высоты = альбомный режим (landscape)
      if (window.innerWidth > window.innerHeight) {
        setIsMobileLandscape(true)
      } else {
        setIsMobileLandscape(false)
        // Если поддерживается API телеграма для блокировки переворота 
        // (Telegram WebApp v8.0+) — фиксируем ориентацию сразу после возврата в portrait
        try {
          if (window.Telegram?.WebApp?.lockOrientation) {
            window.Telegram.WebApp.lockOrientation()
          }
        } catch (e) {
          console.debug('Failed to lock orientation', e)
        }
      }
    }

    checkOrientation()
    window.addEventListener('resize', checkOrientation)
    window.addEventListener('orientationchange', checkOrientation)
    return () => {
      window.removeEventListener('resize', checkOrientation)
      window.removeEventListener('orientationchange', checkOrientation)
    }
  }, [])

  if (!isMobileLandscape) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-gray-950 flex flex-col items-center justify-center text-center p-6" style={{ paddingBottom: 'calc(24px + var(--tg-safe-area-bottom, 0))' }}>
      <div className="bg-gray-900/80 p-8 rounded-2xl border border-gray-800 shadow-2xl flex flex-col items-center max-w-sm w-full">
        <RotateCcw className="w-16 h-16 text-garage-yellow mb-6 animate-[spin_2s_ease-in-out_infinite]" />
        
        <h1 className="text-xl font-mono font-bold text-white mb-4 uppercase tracking-widest leading-tight">
          Поверните<br/>телефон
        </h1>
        
        <p className="text-xs font-mono text-gray-400 leading-relaxed">
          «Гараж 2007» создан для игры в вертикальном режиме.
        </p>
      </div>
    </div>
  )
}
