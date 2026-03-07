# Stage 8 — Система бустов: Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Реализовать систему временных бустов (×2/×3 доход, ×5 клики) за гайки с UI-баром на игровом экране и визуальным эффектом в Phaser.

**Architecture:** Отдельный слайс `boostActions.ts` по паттерну существующих слайсов. `getActiveMultiplier()` вызывается из `clickActions` и `persistenceActions`. `BoostsBar` размещается между Phaser-канвасом и `GameFooter` в `App.tsx`.

**Tech Stack:** React 19, TypeScript, Zustand 5, Phaser 3, Tailwind CSS 3

**Design Doc:** `docs/plans/2026-03-07-stage8-boosts-design.md`

**Рабочая директория:** все `npm`/`npx` команды — из `garage-2007-frontend/`

---

### Task 1: Константы бустов

**Files:**
- Create: `garage-2007-frontend/src/store/constants/boosts.ts`

**Step 1: Создать файл констант**

```typescript
// src/store/constants/boosts.ts
import type { BoostType, BoostDefinition } from '../types'

export const BOOST_DEFINITIONS: Record<BoostType, BoostDefinition> = {
  income_2x: {
    label: 'Двойной доход',
    costNuts: 50,
    durationMs: 3_600_000,
    multiplier: 2,
    description: '×2 ко всему доходу на 1 час',
  },
  income_3x: {
    label: 'Тройной доход',
    costNuts: 80,
    durationMs: 1_800_000,
    multiplier: 3,
    description: '×3 ко всему доходу на 30 мин',
  },
  turbo: {
    label: 'Суперклик',
    costNuts: 30,
    durationMs: 900_000,
    multiplier: 5,
    description: '×5 к доходу за клик на 15 мин',
  },
}

// Группы взаимоисключающих бустов — нельзя активировать одновременно
export const BOOST_CONFLICT_GROUPS: BoostType[][] = [
  ['income_2x', 'income_3x'],
]
```

**Step 2: Проверить типы**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

Ожидание: 0 ошибок (типы `BoostType` и `BoostDefinition` уже есть в `types.ts`).

**Step 3: Коммит**

```bash
git add garage-2007-frontend/src/store/constants/boosts.ts
git commit -m "feat(boosts): add BOOST_DEFINITIONS and BOOST_CONFLICT_GROUPS constants"
```

---

### Task 2: Расширить типы — GameState и GameActions

**Files:**
- Modify: `garage-2007-frontend/src/store/types.ts`

**Step 1: Добавить `boosts` в `GameState` и actions в `GameActions`**

В `GameState` (после `rewardedVideo: RewardedVideoState`):
```typescript
  boosts: BoostsState
```

В `GameActions` (после `watchRewardedVideo`):
```typescript
  activateBoost: (type: BoostType) => boolean
  tickBoosts: () => void
  getActiveMultiplier: (scope: 'income' | 'click') => number
  startBoostTick: () => () => void
```

**Step 2: Проверить типы**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

Ожидание: ошибки вида «Property 'boosts' is missing in type» — это нормально, исправим в следующих задачах.

**Step 3: Коммит**

```bash
git add garage-2007-frontend/src/store/types.ts
git commit -m "feat(boosts): extend GameState and GameActions with boost types"
```

---

### Task 3: Добавить boosts в initialState

**Files:**
- Modify: `garage-2007-frontend/src/store/initialState.ts`

**Step 1: Добавить поле**

После `rewardedVideo: { ... }`:
```typescript
  boosts: { active: [] },
```

**Step 2: Проверить типы**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

Ожидание: ошибки уменьшились — `initialState` теперь удовлетворяет `GameState`.

**Step 3: Коммит**

```bash
git add garage-2007-frontend/src/store/initialState.ts
git commit -m "feat(boosts): add boosts initial state"
```

---

### Task 4: Store slice boostActions

**Files:**
- Create: `garage-2007-frontend/src/store/actions/boostActions.ts`

**Step 1: Создать слайс**

```typescript
// src/store/actions/boostActions.ts
import type { StateCreator } from 'zustand'
import type { GameStore, BoostType } from '../types'
import { BOOST_DEFINITIONS, BOOST_CONFLICT_GROUPS } from '../constants/boosts'

type Slice = Pick<GameStore, 'activateBoost' | 'tickBoosts' | 'getActiveMultiplier' | 'startBoostTick'>

export const createBoostSlice: StateCreator<GameStore, [], [], Slice> = (_set, get) => ({
  activateBoost: (type: BoostType): boolean => {
    const state = get()
    const def = BOOST_DEFINITIONS[type]

    // Проверить баланс гаек
    if (state.nuts < def.costNuts) return false

    // Проверить конфликты: нельзя активировать если активен буст из той же группы
    const conflictGroup = BOOST_CONFLICT_GROUPS.find(group => group.includes(type))
    if (conflictGroup) {
      const hasConflict = state.boosts.active.some(b => conflictGroup.includes(b.type))
      if (hasConflict) return false
    }

    const now = Date.now()
    _set(s => ({
      nuts: s.nuts - def.costNuts,
      boosts: {
        active: [
          ...s.boosts.active,
          { type, activatedAt: now, expiresAt: now + def.durationMs },
        ],
      },
    }))

    get().saveProgress()
    return true
  },

  tickBoosts: (): void => {
    const now = Date.now()
    const { boosts } = get()
    const alive = boosts.active.filter(b => b.expiresAt > now)
    if (alive.length !== boosts.active.length) {
      _set({ boosts: { active: alive } })
    }
  },

  getActiveMultiplier: (scope: 'income' | 'click'): number => {
    const { boosts } = get()
    const now = Date.now()
    const active = boosts.active.filter(b => b.expiresAt > now)

    // Income multiplier: произведение income_2x / income_3x
    let incomeMultiplier = 1
    for (const b of active) {
      if (b.type === 'income_2x' || b.type === 'income_3x') {
        incomeMultiplier *= BOOST_DEFINITIONS[b.type].multiplier
      }
    }

    if (scope === 'income') return incomeMultiplier

    // Click multiplier: turbo × income
    const turboBoost = active.find(b => b.type === 'turbo')
    const turboMultiplier = turboBoost ? BOOST_DEFINITIONS.turbo.multiplier : 1
    return turboMultiplier * incomeMultiplier
  },

  startBoostTick: (): (() => void) => {
    const id = setInterval(() => {
      get().tickBoosts()
    }, 1000)
    return () => clearInterval(id)
  },
})
```

**Step 2: Проверить типы**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

Ожидание: ошибок, связанных с `boostActions`, нет.

**Step 3: Коммит**

```bash
git add garage-2007-frontend/src/store/actions/boostActions.ts
git commit -m "feat(boosts): implement boostActions slice"
```

---

### Task 5: Подключить слайс в gameStore и экспортировать константы

**Files:**
- Modify: `garage-2007-frontend/src/store/gameStore.ts`

**Step 1: Добавить импорт и подключение слайса**

После строки `import { createRewardedVideoSlice }`:
```typescript
import { createBoostSlice }        from './actions/boostActions'
```

В `create<GameStore>((...a) => ({`:
```typescript
  ...createBoostSlice(...a),
```

После `export * from './constants/dailyRewards'`:
```typescript
export * from './constants/boosts'
```

**Step 2: Проверить типы**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

Ожидание: 0 ошибок.

**Step 3: Коммит**

```bash
git add garage-2007-frontend/src/store/gameStore.ts
git commit -m "feat(boosts): wire boostActions slice into gameStore"
```

---

### Task 6: Persistence — расширить SaveData и миграция

**Files:**
- Modify: `garage-2007-frontend/src/utils/storageService.ts`

**Step 1: Обновить `SAVE_VERSION`**

```typescript
export const SAVE_VERSION = 5
```

**Step 2: Добавить поле в `SaveData`**

После `rewardedVideo?`:
```typescript
  /** Активные бусты (backward compat: может отсутствовать в старых сейвах) */
  boosts?: {
    active: Array<{ type: string; activatedAt: number; expiresAt: number }>
  }
```

**Step 3: Добавить дефолт в `DEFAULT_SAVE_DATA`**

После `rewardedVideo: { ... }`:
```typescript
  boosts: { active: [] },
```

**Step 4: Добавить миграцию v4 → v5 в `loadGame()`**

После блока `if (merged.version < 4)`:
```typescript
    // --- Миграция v4 → v5: добавление поля boosts ---
    if (merged.version < 5) {
      merged.boosts = { active: [] }
      merged.version = 5
    }
```

**Step 5: Проверить типы**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

Ожидание: 0 ошибок.

**Step 6: Коммит**

```bash
git add garage-2007-frontend/src/utils/storageService.ts
git commit -m "feat(boosts): extend SaveData with boosts field, SAVE_VERSION=5, migration v4→v5"
```

---

### Task 7: Сохранение и загрузка бустов в persistenceActions

**Files:**
- Modify: `garage-2007-frontend/src/store/actions/persistenceActions.ts`

**Step 1: Добавить boosts в `saveProgress`**

После блока `rewardedVideo: { ... }` внутри `saveGameFull({...})`:
```typescript
      boosts: {
        active: s.boosts.active.map(b => ({
          type: b.type,
          activatedAt: b.activatedAt,
          expiresAt: b.expiresAt,
        })),
      },
```

**Step 2: Восстановить бусты в `loadProgress`**

После строки `const offlineTimeAway = ...`:
```typescript
    const now = Date.now()
    const restoredBoosts = (saveData.boosts?.active ?? [])
      .filter(b => b.expiresAt > now)
      .map(b => ({ type: b.type as import('../types').BoostType, activatedAt: b.activatedAt, expiresAt: b.expiresAt }))
```

В `_set({...})` добавить:
```typescript
      boosts: { active: restoredBoosts },
```

**Step 3: Применить мультипликатор бустов в `startPassiveIncome`**

Найти внутри `startPassiveIncome` блок:
```typescript
        if (passiveIncomePerSecond > 0) {
          const newBalance = roundCurrency(s.balance + passiveIncomePerSecond)
```

Заменить на:
```typescript
        if (passiveIncomePerSecond > 0) {
          const boostMultiplier = get().getActiveMultiplier('income')
          const earned = roundCurrency(passiveIncomePerSecond * boostMultiplier)
          const newBalance = roundCurrency(s.balance + earned)
```

И заменить `s.totalEarned + passiveIncomePerSecond` на `s.totalEarned + earned`.

**Step 4: Проверить типы**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

Ожидание: 0 ошибок.

**Step 5: Коммит**

```bash
git add garage-2007-frontend/src/store/actions/persistenceActions.ts
git commit -m "feat(boosts): save/load boosts, apply income multiplier to passive income"
```

---

### Task 8: Применить мультипликатор бустов в handleClick

**Files:**
- Modify: `garage-2007-frontend/src/store/actions/clickActions.ts`

**Step 1: Добавить мультипликатор**

Найти строку:
```typescript
    const income = isCritical ? clickValue * CRITICAL_CLICK_MULTIPLIER : clickValue
```

Заменить на:
```typescript
    const boostMultiplier = get().getActiveMultiplier('click')
    const income = (isCritical ? clickValue * CRITICAL_CLICK_MULTIPLIER : clickValue) * boostMultiplier
```

**Step 2: Проверить типы**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

Ожидание: 0 ошибок.

**Step 3: Коммит**

```bash
git add garage-2007-frontend/src/store/actions/clickActions.ts
git commit -m "feat(boosts): apply click multiplier in handleClick"
```

---

### Task 9: Новые селекторы и запуск тика

**Files:**
- Modify: `garage-2007-frontend/src/store/selectors.ts`
- Modify: `garage-2007-frontend/src/hooks/useGameLifecycle.ts`

**Step 1: Добавить селекторы в `selectors.ts`**

В конец файла:
```typescript
export const useBoosts            = () => useGameStore((s) => s.boosts.active)
export const useActivateBoost     = () => useGameStore((s) => s.activateBoost)
export const useHasActiveBoost    = (type: import('./types').BoostType) =>
  useGameStore((s) => s.boosts.active.some(b => b.type === type))
export const useHasAnyActiveBoost = () => useGameStore((s) => s.boosts.active.length > 0)
```

**Step 2: Добавить `startBoostTick` в `useGameLifecycle.ts`**

Добавить импорт:
```typescript
  useGameStore,   // уже есть
```

Добавить переменную (рядом с `startPassiveIncome`):
```typescript
  const startBoostTick  = useGameStore((s) => s.startBoostTick)
```

Добавить новый `useEffect` после эффекта запуска пассивного дохода:
```typescript
  // 3. Запуск тика бустов (очистка протухших)
  useEffect(() => {
    const cleanup = startBoostTick()
    return cleanup
  }, [startBoostTick])
```

Сдвинуть нумерацию последующих комментариев (4, 5, 6, 7).

**Step 3: Проверить типы**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

Ожидание: 0 ошибок.

**Step 4: Коммит**

```bash
git add garage-2007-frontend/src/store/selectors.ts garage-2007-frontend/src/hooks/useGameLifecycle.ts
git commit -m "feat(boosts): add boost selectors, start boost tick in lifecycle"
```

---

### Task 10: UI — компонент BoostsBar

**Files:**
- Create: `garage-2007-frontend/src/components/BoostsBar.tsx`

**Step 1: Создать компонент**

```tsx
// src/components/BoostsBar.tsx
import { useState, useEffect, useCallback } from 'react'
import { useGameStore, useNuts, useBoosts, BOOST_DEFINITIONS, BOOST_CONFLICT_GROUPS } from '../store/gameStore'
import type { BoostType } from '../store/gameStore'
import NutsPromptModal from './NutsPromptModal'

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const BOOST_ORDER: BoostType[] = ['income_2x', 'income_3x', 'turbo']

export default function BoostsBar() {
  const nuts = useNuts()
  const activeBoosts = useBoosts()
  const activateBoost = useGameStore((s) => s.activateBoost)
  const [now, setNow] = useState(Date.now())
  const [promptDeficit, setPromptDeficit] = useState<number | null>(null)

  // Обновляем таймер каждую секунду
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const getStatus = useCallback((type: BoostType): 'can_buy' | 'active' | 'blocked_conflict' | 'blocked_nuts' => {
    const activeBoost = activeBoosts.find(b => b.type === type && b.expiresAt > now)
    if (activeBoost) return 'active'

    const conflictGroup = BOOST_CONFLICT_GROUPS.find(g => g.includes(type))
    if (conflictGroup) {
      const conflictActive = activeBoosts.some(b => conflictGroup.includes(b.type) && b.type !== type && b.expiresAt > now)
      if (conflictActive) return 'blocked_conflict'
    }

    if (nuts < BOOST_DEFINITIONS[type].costNuts) return 'blocked_nuts'
    return 'can_buy'
  }, [activeBoosts, nuts, now])

  const handleBoostClick = useCallback((type: BoostType) => {
    const status = getStatus(type)
    if (status === 'blocked_nuts') {
      const deficit = BOOST_DEFINITIONS[type].costNuts - nuts
      setPromptDeficit(deficit)
      return
    }
    if (status === 'can_buy') {
      activateBoost(type)
    }
  }, [getStatus, activateBoost, nuts])

  return (
    <>
      <div className="px-2 py-1 bg-gray-900/80 border-t border-gray-700">
        <div className="flex gap-1 justify-center">
          {BOOST_ORDER.map(type => {
            const def = BOOST_DEFINITIONS[type]
            const status = getStatus(type)
            const activeBoost = activeBoosts.find(b => b.type === type && b.expiresAt > now)
            const remaining = activeBoost ? activeBoost.expiresAt - now : 0
            const deficit = def.costNuts - nuts

            return (
              <button
                key={type}
                onClick={() => handleBoostClick(type)}
                disabled={status === 'active' || status === 'blocked_conflict'}
                className={[
                  'flex-1 rounded px-1 py-1.5 text-center transition-colors min-h-[44px]',
                  'font-mono text-[7px] leading-tight flex flex-col items-center justify-center gap-0.5',
                  status === 'active'            && 'bg-green-800/80 border border-green-500 cursor-default',
                  status === 'can_buy'           && 'bg-garage-yellow/20 border border-garage-yellow/60 hover:bg-garage-yellow/30 cursor-pointer',
                  status === 'blocked_conflict'  && 'bg-gray-800/60 border border-gray-600 cursor-default opacity-50',
                  status === 'blocked_nuts'      && 'bg-gray-800/60 border border-gray-600 cursor-pointer',
                ].filter(Boolean).join(' ')}
              >
                {status === 'active' ? (
                  <>
                    <span className="text-green-400">⚡ {def.label.toUpperCase()}</span>
                    <span className="text-green-300">⏱ {formatTime(remaining)}</span>
                  </>
                ) : (
                  <>
                    <span className={status === 'blocked_nuts' ? 'text-gray-400' : 'text-garage-yellow'}>
                      {def.label}
                    </span>
                    <span className={status === 'blocked_nuts' ? 'text-red-400' : 'text-gray-300'}>
                      {status === 'blocked_nuts' ? `-${deficit} 🔩` : `${def.costNuts} 🔩`}
                    </span>
                    {status === 'blocked_conflict' && (
                      <span className="text-gray-500">Уже активен</span>
                    )}
                  </>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {promptDeficit !== null && (
        <NutsPromptModal
          isOpen
          deficit={promptDeficit}
          onClose={() => setPromptDeficit(null)}
        />
      )}
    </>
  )
}
```

**Step 2: Проверить типы**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

Ожидание: ошибка «Cannot find module './NutsPromptModal'» — создадим в следующей задаче.

**Step 3: Не коммитить** — ждём NutsPromptModal.

---

### Task 11: UI — компонент NutsPromptModal

**Files:**
- Create: `garage-2007-frontend/src/components/NutsPromptModal.tsx`

**Step 1: Создать компонент**

```tsx
// src/components/NutsPromptModal.tsx
import { useCallback } from 'react'
import { useGameStore } from '../store/gameStore'

interface NutsPromptModalProps {
  isOpen: boolean
  deficit: number
  onClose: () => void
}

export default function NutsPromptModal({ isOpen, deficit, onClose }: NutsPromptModalProps) {
  const watchRewardedVideo = useGameStore((s) => s.watchRewardedVideo)
  const canWatchVideo = useGameStore((s) => s.canWatchRewardedVideo())

  const handleWatchAd = useCallback(async () => {
    const success = await watchRewardedVideo()
    if (success) onClose()
  }, [watchRewardedVideo, onClose])

  // Заглушка для покупки гаек (Stage 14)
  const handleBuyNuts = useCallback(() => {
    console.log('[Stage 14] purchaseNuts — не реализовано')
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative bg-gray-900 border border-garage-yellow/50 rounded-lg p-5 mx-4 max-w-xs w-full font-mono">

        {/* Крестик закрытия */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-white text-lg leading-none p-1"
          aria-label="Закрыть"
        >
          ×
        </button>

        <h2 className="text-garage-yellow text-xs font-bold mb-3 text-center">
          НЕДОСТАТОЧНО ГАЕК
        </h2>

        <p className="text-gray-300 text-[10px] text-center mb-4">
          Нужно ещё <span className="text-garage-yellow font-bold">{deficit} 🔩</span> для активации буста
        </p>

        <div className="flex flex-col gap-2">
          {canWatchVideo && (
            <button
              onClick={handleWatchAd}
              className="w-full py-2.5 bg-blue-700 hover:bg-blue-600 text-white text-[10px] font-bold rounded transition-colors"
            >
              📺 Смотреть рекламу
            </button>
          )}

          <button
            onClick={handleBuyNuts}
            className="w-full py-2.5 bg-garage-yellow/20 hover:bg-garage-yellow/30 border border-garage-yellow/50 text-garage-yellow text-[10px] font-bold rounded transition-colors"
          >
            💎 Купить гайки
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Проверить типы**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

Ожидание: 0 ошибок.

**Step 3: Коммит**

```bash
git add garage-2007-frontend/src/components/BoostsBar.tsx garage-2007-frontend/src/components/NutsPromptModal.tsx
git commit -m "feat(boosts): add BoostsBar and NutsPromptModal components"
```

---

### Task 12: Вставить BoostsBar в App.tsx

**Files:**
- Modify: `garage-2007-frontend/src/App.tsx`

**Step 1: Импортировать компонент**

```typescript
import BoostsBar from './components/BoostsBar'
```

**Step 2: Вставить между `<GameCanvas>` и `<GameFooter />`**

Найти в game tab блоке:
```tsx
          <GameCanvas ... />
          <GameFooter />
```

Заменить на:
```tsx
          <GameCanvas ... />
          <BoostsBar />
          <GameFooter />
```

**Step 3: Проверить типы**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

Ожидание: 0 ошибок.

**Step 4: Проверить в браузере**

```bash
cd garage-2007-frontend && npm run dev
```

Убедиться: BoostsBar видна между канвасом и footer на игровом экране. Нажать кнопку буста с достаточным балансом гаек — должен активироваться, появиться таймер.

**Step 5: Коммит**

```bash
git add garage-2007-frontend/src/App.tsx
git commit -m "feat(boosts): integrate BoostsBar into game tab"
```

---

### Task 13: Phaser — визуальный эффект свечения

**Files:**
- Modify: `garage-2007-frontend/src/game/MainScene.ts`

**Step 1: Добавить поле и метод**

Добавить приватное поле рядом с другими полями:
```typescript
  private boostGlow: Phaser.GameObjects.Graphics | null = null
```

Добавить публичный метод после `syncGameData`:
```typescript
  /**
   * Включает/выключает визуальный индикатор активного буста.
   * Вызывается из PhaserGame.tsx при изменении hasAnyActiveBoost.
   */
  public setBoostActive(isActive: boolean): void {
    if (isActive) {
      if (!this.boostGlow) {
        this.boostGlow = this.add.graphics()
        this.boostGlow.setDepth(15) // между GARAGE(10) и EFFECTS(20)
      }
      // Пульсирующая аура: перерисовываем каждый кадр через tween на alpha
      this.boostGlow.clear()
      this.boostGlow.lineStyle(4, 0xFFAA00, 0.8)
      this.boostGlow.strokeRect(
        this.scale.width * 0.05,
        this.scale.height * 0.05,
        this.scale.width * 0.9,
        this.scale.height * 0.55,
      )
      this.tweens.add({
        targets: this.boostGlow,
        alpha: { from: 0.3, to: 0.9 },
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    } else {
      if (this.boostGlow) {
        this.tweens.killTweensOf(this.boostGlow)
        this.boostGlow.destroy()
        this.boostGlow = null
      }
    }
  }
```

**Step 2: Очистить в `shutdown`**

В методе `shutdown()` добавить:
```typescript
    if (this.boostGlow) {
      this.boostGlow.destroy()
      this.boostGlow = null
    }
```

**Step 3: Проверить типы**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

Ожидание: 0 ошибок.

**Step 4: Коммит**

```bash
git add garage-2007-frontend/src/game/MainScene.ts
git commit -m "feat(boosts): add setBoostActive visual glow to MainScene"
```

---

### Task 14: Синхронизировать буст-гlow с React

**Files:**
- Modify: `garage-2007-frontend/src/game/PhaserGame.tsx`
- Modify: `garage-2007-frontend/src/components/GameCanvas.tsx`
- Modify: `garage-2007-frontend/src/App.tsx`

**Step 1: Добавить prop в `PhaserGame`**

В `PhaserGameProps`:
```typescript
  /** Активен ли хотя бы один буст (для свечения в Phaser) */
  hasAnyActiveBoost: boolean
```

Добавить ref (рядом с `isActiveRef`):
```typescript
  const hasAnyActiveBoostRef = useRef(hasAnyActiveBoost)
  hasAnyActiveBoostRef.current = hasAnyActiveBoost
```

Добавить `useEffect` для синхронизации (после эффекта `garageLevel`):
```typescript
  useEffect(() => {
    sceneRef.current?.setBoostActive(hasAnyActiveBoost)
  }, [hasAnyActiveBoost])
```

Обновить сигнатуру компонента:
```typescript
const PhaserGame: React.FC<PhaserGameProps> = ({ onGarageClick, garageLevel, isActive, hasAnyActiveBoost }) => {
```

**Step 2: Добавить prop в `GameCanvas`**

В `GameCanvasProps`:
```typescript
  hasAnyActiveBoost: boolean
```

В деструктуризации:
```typescript
export function GameCanvas({ ..., hasAnyActiveBoost }: GameCanvasProps) {
```

Передать в `<PhaserGame>`:
```tsx
          <PhaserGame
            onGarageClick={onGarageClick}
            garageLevel={garageLevel}
            isActive={isActive}
            hasAnyActiveBoost={hasAnyActiveBoost}
          />
```

**Step 3: Передать из `App.tsx`**

Добавить импорт селектора:
```typescript
import { useHasAnyActiveBoost } from './store/gameStore'
```

> Примечание: `useHasAnyActiveBoost` экспортируется через `selectors.ts` → `gameStore.ts`.

Добавить:
```typescript
  const hasAnyActiveBoost = useHasAnyActiveBoost()
```

В `<GameCanvas>`:
```tsx
          <GameCanvas
            garageLevel={garageLevel}
            isActive={isGameTabActive}
            onGarageClick={handleClick}
            dailyRewardStreak={dailyRewards.currentStreak}
            canClaimDaily={canClaimToday}
            onOpenDailyRewards={openDailyRewardsModal}
            hasAnyActiveBoost={hasAnyActiveBoost}
          />
```

**Step 4: Проверить типы**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

Ожидание: 0 ошибок.

**Step 5: Проверить в браузере**

```bash
cd garage-2007-frontend && npm run dev
```

Убедиться: при активном бусте вокруг гаража появляется пульсирующая золотая рамка; при истечении буста — рамка исчезает.

**Step 6: Коммит**

```bash
git add garage-2007-frontend/src/game/PhaserGame.tsx garage-2007-frontend/src/components/GameCanvas.tsx garage-2007-frontend/src/App.tsx
git commit -m "feat(boosts): sync boost glow from React to Phaser"
```

---

### Task 15: Финальная проверка и production build

**Step 1: TypeScript**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

Ожидание: 0 ошибок.

**Step 2: ESLint**

```bash
cd garage-2007-frontend && npm run lint
```

Ожидание: 0 предупреждений/ошибок.

**Step 3: Production build**

```bash
cd garage-2007-frontend && npm run build
```

Ожидание: `dist/` создан без ошибок.

**Step 4: Ручное smoke-тестирование**

```bash
cd garage-2007-frontend && npm run preview
```

Проверить сценарии:
- [ ] BoostsBar видна на game tab между canvas и footer
- [ ] Три кнопки: «Двойной доход 50🔩», «Тройной доход 80🔩», «Суперклик 30🔩»
- [ ] При нехватке гаек — кнопка серая с дефицитом `-X 🔩`, тап → NutsPromptModal с крестиком
- [ ] После активации `income_2x` → кнопка становится зелёной с таймером, кнопка `income_3x` блокируется «Уже активен»
- [ ] Клики умножаются на активный буст (проверить через `window.__store.getState().getActiveMultiplier('click')` в консоли)
- [ ] Пассивный доход умножается (наблюдать за балансом)
- [ ] Phaser: золотая пульсирующая рамка при активном бусте, исчезает по истечении
- [ ] После перезагрузки страницы — активные бусты восстанавливаются (если не истекли)
- [ ] Истёкшие бусты при загрузке не восстанавливаются
- [ ] Оффлайн-доход НЕ умножается на бусты (проверить `calculateOfflineEarnings` — без изменений)

**Step 5: Финальный коммит**

```bash
git add -A
git commit -m "feat(stage-8): complete boost system implementation"
```
