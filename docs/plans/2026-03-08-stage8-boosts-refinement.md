# Stage 8 — Рефайн бустов: Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Привести систему бустов в соответствие с GDD v3.0 + GBD v1.1: новые цены/условия разблокировки, правило «один буст одновременно», и переход от горизонтальной полоски к круглой кнопке + модалке.

**Architecture:** Три независимые группы изменений: (1) данные в store/constants, (2) логика в boostActions, (3) UI — удаление BoostsBar + создание BoostButton/BoostModal. BoostModal содержит внутреннее состояние подтверждения замены; store добавляет `replaceBoost`.

**Tech Stack:** React 19, TypeScript, Zustand 5, Tailwind CSS 3

**Авторитет:** GDD v3.0 раздел 2.9 → GBD v1.1 раздел 6 (при конфликте — GDD приоритет)

**Рабочая директория:** все `npx`/`npm` команды — из `garage-2007-frontend/`

---

## Итоговые значения из GDD v3.0 + GBD v1.1

| BoostType   | Новый label   | costNuts | durationMs  | multiplier | unlockLevel (milestone) |
|-------------|---------------|----------|-------------|------------|-------------------------|
| `income_2x` | X2 Доход      | 30       | 3_600_000   | 2          | 5 (milestonesPurchased) |
| `income_3x` | X3 Доход      | 50       | 1_800_000   | 3          | 10 (milestonesPurchased)|
| `turbo`     | Суперклик     | 15       | 900_000     | 5          | 1 (garageLevel ≥ 1)     |

**Правила:**
- Только один буст активен одновременно
- Замена активного буста требует подтверждения (потерянное время не компенсируется)
- `turbo` влияет только на клики; `income_2x`/`income_3x` влияют на всё

---

### Task 1: Обновить BoostDefinition тип — добавить unlockLevel

**Files:**
- Modify: `garage-2007-frontend/src/store/types.ts`

**Step 1: Добавить поле в интерфейс**

Найти интерфейс `BoostDefinition` (строки ~78-84) и добавить новое поле:

```typescript
export interface BoostDefinition {
  label: string
  costNuts: number
  durationMs: number
  multiplier: number
  description: string
  /** Уровень milestone, необходимый для разблокировки (0 = всегда доступен) */
  unlockLevel: number
}
```

**Step 2: Добавить replaceBoost в GameActions**

В интерфейс `GameActions` после `activateBoost`:
```typescript
  replaceBoost: (type: BoostType) => boolean
```

**Step 3: Проверить типы**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

Ожидание: ошибки типа «Property 'unlockLevel' is missing» — нормально, исправляем в Task 2.

**Step 4: Коммит**

```bash
git add garage-2007-frontend/src/store/types.ts
git commit -m "feat(boosts): add unlockLevel to BoostDefinition, replaceBoost to GameActions"
```

---

### Task 2: Обновить BOOST_DEFINITIONS — новые цены, labels, unlock

**Files:**
- Modify: `garage-2007-frontend/src/store/constants/boosts.ts`

**Step 1: Заменить весь файл**

```typescript
// src/store/constants/boosts.ts
import type { BoostType, BoostDefinition } from '../types'

export const BOOST_DEFINITIONS: Record<BoostType, BoostDefinition> = {
  income_2x: {
    label: 'X2 Доход',
    costNuts: 30,
    durationMs: 3_600_000,
    multiplier: 2,
    description: 'Пассив + клики ×2',
    unlockLevel: 5,   // requires milestonesPurchased.includes(5)
  },
  income_3x: {
    label: 'X3 Доход',
    costNuts: 50,
    durationMs: 1_800_000,
    multiplier: 3,
    description: 'Пассив + клики ×3',
    unlockLevel: 10,  // requires milestonesPurchased.includes(10)
  },
  turbo: {
    label: 'Суперклик',
    costNuts: 15,
    durationMs: 900_000,
    multiplier: 5,
    description: 'Клики ×5',
    unlockLevel: 0,   // always available (garageLevel >= 1)
  },
}

// Оставить экспорт пустым — группы конфликтов убраны (все взаимоисключающие)
// Логика «один буст» — в boostActions через boosts.active.length > 0
```

**Step 2: Проверить типы**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

Ожидание: ошибки о `BOOST_CONFLICT_GROUPS` — исправляем в Task 3.

**Step 3: Коммит**

```bash
git add garage-2007-frontend/src/store/constants/boosts.ts
git commit -m "feat(boosts): update BOOST_DEFINITIONS — new costs, labels, unlockLevel per GDD v3.0"
```

---

### Task 3: Обновить boostActions — новая логика одного буста

**Files:**
- Modify: `garage-2007-frontend/src/store/actions/boostActions.ts`

**Step 1: Заменить весь файл**

```typescript
// src/store/actions/boostActions.ts
import type { StateCreator } from 'zustand'
import type { GameStore, BoostType } from '../types'
import { BOOST_DEFINITIONS } from '../constants/boosts'

type Slice = Pick<GameStore,
  | 'activateBoost' | 'replaceBoost' | 'tickBoosts'
  | 'getActiveMultiplier' | 'startBoostTick'
>

export const createBoostSlice: StateCreator<GameStore, [], [], Slice> = (_set, get) => ({
  activateBoost: (type: BoostType): boolean => {
    const state = get()
    const def = BOOST_DEFINITIONS[type]

    // Проверить баланс гаек
    if (state.nuts < def.costNuts) return false

    // Проверить разблокировку по milestone
    if (def.unlockLevel > 0 && !state.milestonesPurchased.includes(def.unlockLevel)) return false

    // Проверить: нельзя активировать если уже есть активный буст
    // (для замены использовать replaceBoost)
    const now = Date.now()
    const hasActive = state.boosts.active.some(b => b.expiresAt > now)
    if (hasActive) return false

    _set(s => ({
      nuts: s.nuts - def.costNuts,
      boosts: {
        active: [{ type, activatedAt: now, expiresAt: now + def.durationMs }],
      },
    }))

    get().saveProgress()
    return true
  },

  replaceBoost: (type: BoostType): boolean => {
    const state = get()
    const def = BOOST_DEFINITIONS[type]

    // Проверить баланс гаек
    if (state.nuts < def.costNuts) return false

    // Проверить разблокировку
    if (def.unlockLevel > 0 && !state.milestonesPurchased.includes(def.unlockLevel)) return false

    const now = Date.now()
    // Заменяем текущий буст (потерянное время не компенсируется)
    _set(s => ({
      nuts: s.nuts - def.costNuts,
      boosts: {
        active: [{ type, activatedAt: now, expiresAt: now + def.durationMs }],
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
    const active = boosts.active.find(b => b.expiresAt > now)

    if (!active) return 1

    // turbo влияет только на клики
    if (active.type === 'turbo') {
      return scope === 'click' ? BOOST_DEFINITIONS.turbo.multiplier : 1
    }

    // income_2x / income_3x влияют на всё (и клики, и пассив)
    return BOOST_DEFINITIONS[active.type].multiplier
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

Ожидание: 0 ошибок.

**Step 3: Коммит**

```bash
git add garage-2007-frontend/src/store/actions/boostActions.ts
git commit -m "feat(boosts): one-boost-at-a-time rule, unlockLevel check, replaceBoost action"
```

---

### Task 4: Удалить BoostsBar, добавить boost-селектор unlockLevel

**Files:**
- Delete: `garage-2007-frontend/src/components/BoostsBar.tsx`
- Modify: `garage-2007-frontend/src/store/selectors.ts`
- Modify: `garage-2007-frontend/src/App.tsx`

**Step 1: Удалить BoostsBar.tsx**

```bash
rm garage-2007-frontend/src/components/BoostsBar.tsx
```

**Step 2: Добавить селектор milestonesPurchased в selectors.ts**

`useMilestonesPurchased` уже экспортируется — проверить что он есть в `selectors.ts` (строка ~33). Если есть — ничего не делать.

**Step 3: Убрать BoostsBar из App.tsx**

Найти и удалить:
```typescript
import BoostsBar from './components/BoostsBar'
```

Найти в JSX между `<GameCanvas ... />` и `<GameFooter />`:
```tsx
<BoostsBar />
```
Удалить эту строку.

**Step 4: Проверить типы**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

Ожидание: 0 ошибок.

**Step 5: Коммит**

```bash
git add garage-2007-frontend/src/components/ garage-2007-frontend/src/App.tsx
git commit -m "feat(boosts): remove BoostsBar strip from game tab"
```

---

### Task 5: Создать BoostButton — круглая кнопка на canvas

**Files:**
- Create: `garage-2007-frontend/src/components/BoostButton.tsx`

**Step 1: Создать файл**

```tsx
// src/components/BoostButton.tsx
// Круглая кнопка «БУСТ» — абсолютно позиционирована на GameCanvas,
// под кнопкой DailyRewardButton (top-3 right-3).
// При активном бусте показывает таймер обратного отсчёта.

import { useState, useEffect } from 'react'
import { useBoosts } from '../store/gameStore'

interface BoostButtonProps {
  onClick: () => void
}

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const BoostButton: React.FC<BoostButtonProps> = ({ onClick }) => {
  const activeBoosts = useBoosts()
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const activeBoost = activeBoosts.find(b => b.expiresAt > now)
  const remaining = activeBoost ? activeBoost.expiresAt - now : 0
  const isActive = !!activeBoost

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        absolute top-[84px] right-3 z-20
        w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full
        flex flex-col items-center justify-center
        backdrop-blur-sm border-2
        transition-colors duration-300
        active:scale-90 transform
        font-mono
        ${isActive
          ? 'bg-orange-900/80 border-orange-400 shadow-lg shadow-orange-500/40 animate-pulse-ring'
          : 'bg-gray-800/80 border-orange-600/60 hover:border-orange-500'
        }
      `}
      aria-label="Бусты"
    >
      <span className="text-xl sm:text-2xl leading-none">🚀</span>

      {isActive ? (
        <span className="text-[8px] sm:text-[9px] font-bold leading-none mt-0.5 text-orange-300">
          {formatTime(remaining)}
        </span>
      ) : (
        <span className="text-[8px] sm:text-[9px] font-bold leading-none mt-0.5 text-orange-400">
          БУСТ
        </span>
      )}
    </button>
  )
}

export default BoostButton
```

**Step 2: Проверить типы**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

Ожидание: 0 ошибок.

**Step 3: Коммит**

```bash
git add garage-2007-frontend/src/components/BoostButton.tsx
git commit -m "feat(boosts): add BoostButton floating round button component"
```

---

### Task 6: Создать BoostModal — модалка с карточками бустов

**Files:**
- Create: `garage-2007-frontend/src/components/BoostModal.tsx`

**Step 1: Создать файл**

```tsx
// src/components/BoostModal.tsx
// Модалка «БУСТЫ» с тремя карточками. Открывается по BoostButton.
// Состояния карточки: active (таймер), can_buy, locked, blocked (другой активен — с заменой), blocked_nuts.

import { useState, useEffect, useCallback } from 'react'
import {
  useGameStore, useNuts, useBoosts, useMilestonesPurchased,
  BOOST_DEFINITIONS,
} from '../store/gameStore'
import type { BoostType } from '../store/gameStore'
import NutsPromptModal from './NutsPromptModal'

interface BoostModalProps {
  isOpen: boolean
  onClose: () => void
}

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const BOOST_ORDER: BoostType[] = ['income_2x', 'income_3x', 'turbo']

// Визуальные темы для карточек по референсу
const BOOST_THEMES: Record<BoostType, {
  cardBg: string
  iconBg: string
  icon: string
  btnGradient: string
  timerColor: string
}> = {
  income_2x: {
    cardBg: 'bg-gradient-to-br from-orange-950/80 to-amber-950/60 border-orange-700/60',
    iconBg: 'bg-orange-600',
    icon: '⚡',
    btnGradient: 'from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400',
    timerColor: 'text-amber-300',
  },
  income_3x: {
    cardBg: 'bg-gradient-to-br from-red-950/80 to-rose-950/60 border-red-700/60',
    iconBg: 'bg-red-700',
    icon: '⚡',
    btnGradient: 'from-red-700 to-rose-600 hover:from-red-600 hover:to-rose-500',
    timerColor: 'text-red-300',
  },
  turbo: {
    cardBg: 'bg-gradient-to-br from-purple-950/80 to-violet-950/60 border-purple-700/60',
    iconBg: 'bg-purple-700',
    icon: '✦',
    btnGradient: 'from-purple-700 to-violet-600 hover:from-purple-600 hover:to-violet-500',
    timerColor: 'text-purple-300',
  },
}

export default function BoostModal({ isOpen, onClose }: BoostModalProps) {
  const nuts = useNuts()
  const activeBoosts = useBoosts()
  const milestonesPurchased = useMilestonesPurchased()
  const activateBoost = useGameStore(s => s.activateBoost)
  const replaceBoost = useGameStore(s => s.replaceBoost)

  const [now, setNow] = useState(Date.now())
  const [confirmType, setConfirmType] = useState<BoostType | null>(null)  // pending replace
  const [nutsDeficit, setNutsDeficit] = useState<number | null>(null)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const getStatus = useCallback((type: BoostType) => {
    const def = BOOST_DEFINITIONS[type]
    const isThisActive = activeBoosts.some(b => b.type === type && b.expiresAt > now)
    if (isThisActive) return 'active' as const

    const isLocked = def.unlockLevel > 0 && !milestonesPurchased.includes(def.unlockLevel)
    if (isLocked) return 'locked' as const

    const hasOtherActive = activeBoosts.some(b => b.type !== type && b.expiresAt > now)
    if (hasOtherActive) return 'blocked' as const  // can replace with confirmation

    if (nuts < def.costNuts) return 'blocked_nuts' as const
    return 'can_buy' as const
  }, [activeBoosts, milestonesPurchased, nuts, now])

  const handleBuyClick = useCallback((type: BoostType) => {
    const status = getStatus(type)
    if (status === 'active' || status === 'locked') return

    if (status === 'blocked_nuts') {
      setNutsDeficit(BOOST_DEFINITIONS[type].costNuts - nuts)
      return
    }

    if (status === 'blocked') {
      setConfirmType(type)   // показать подтверждение замены
      return
    }

    if (status === 'can_buy') {
      activateBoost(type)
    }
  }, [getStatus, activateBoost, nuts])

  const handleConfirmReplace = useCallback(() => {
    if (!confirmType) return
    replaceBoost(confirmType)
    setConfirmType(null)
  }, [confirmType, replaceBoost])

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="relative bg-gray-950 border-2 border-orange-700/70 rounded-xl p-4 mx-3 w-full max-w-sm font-mono shadow-2xl shadow-orange-900/30">

          {/* Крестик */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-gray-400 hover:text-white text-xl leading-none p-1"
            aria-label="Закрыть"
          >
            ×
          </button>

          {/* Заголовок */}
          <div className="text-center mb-4">
            <h2 className="text-garage-yellow text-sm font-bold tracking-widest">
              🚀 БУСТЫ
            </h2>
            <p className="text-gray-500 text-[9px] mt-1 tracking-wide">
              Временные усиления за гайки
            </p>
          </div>

          {/* Диалог подтверждения замены */}
          {confirmType && (
            <div className="mb-3 p-3 bg-orange-950/60 border border-orange-600/50 rounded-lg text-center">
              <p className="text-orange-300 text-[9px] mb-2">
                Заменить активный буст?<br/>
                <span className="text-gray-400">Оставшееся время будет потеряно</span>
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmType(null)}
                  className="flex-1 py-1.5 bg-gray-800 text-gray-300 text-[9px] font-bold rounded"
                >
                  ОТМЕНА
                </button>
                <button
                  onClick={handleConfirmReplace}
                  className="flex-1 py-1.5 bg-orange-700 hover:bg-orange-600 text-white text-[9px] font-bold rounded"
                >
                  ЗАМЕНИТЬ
                </button>
              </div>
            </div>
          )}

          {/* Карточки бустов */}
          <div className="flex flex-col gap-2">
            {BOOST_ORDER.map(type => {
              const def = BOOST_DEFINITIONS[type]
              const theme = BOOST_THEMES[type]
              const status = getStatus(type)
              const activeBoost = activeBoosts.find(b => b.type === type && b.expiresAt > now)
              const remaining = activeBoost ? activeBoost.expiresAt - now : 0
              const durationLabel = type === 'income_2x' ? '60 мин' : type === 'income_3x' ? '30 мин' : '15 мин'

              return (
                <div
                  key={type}
                  className={`rounded-lg border p-3 ${theme.cardBg} ${status === 'locked' ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    {/* Иконка */}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg flex-shrink-0 ${theme.iconBg}`}>
                      {theme.icon}
                    </div>

                    {/* Название + описание */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${status === 'active' ? theme.timerColor : 'text-white'}`}>
                          {def.label}
                        </span>
                        <span className="text-cyan-400 text-xs font-bold">
                          {def.costNuts} 🔩
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-gray-400 text-[9px]">{def.description}</span>
                        <span className="text-gray-500 text-[9px]">⏱ {durationLabel}</span>
                      </div>
                    </div>
                  </div>

                  {/* Кнопка / таймер */}
                  {status === 'active' ? (
                    <div className={`w-full py-2 rounded text-center text-[10px] font-bold ${theme.timerColor} bg-black/30`}>
                      ⏱ АКТИВЕН — {formatTime(remaining)}
                    </div>
                  ) : status === 'locked' ? (
                    <div className="w-full py-2 rounded text-center text-[10px] font-bold text-gray-500 bg-black/30">
                      🔒 MILESTONE {def.unlockLevel}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleBuyClick(type)}
                      className={`w-full py-2 rounded text-[10px] font-bold text-white bg-gradient-to-r transition-colors ${theme.btnGradient} ${
                        status === 'blocked_nuts' ? 'opacity-60' : ''
                      }`}
                    >
                      {status === 'blocked_nuts'
                        ? `КУПИТЬ — не хватает ${def.costNuts - nuts} 🔩`
                        : status === 'blocked'
                        ? 'ЗАМЕНИТЬ'
                        : 'КУПИТЬ'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {nutsDeficit !== null && (
        <NutsPromptModal
          isOpen
          deficit={nutsDeficit}
          onClose={() => setNutsDeficit(null)}
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

Ожидание: 0 ошибок.

**Step 3: Коммит**

```bash
git add garage-2007-frontend/src/components/BoostModal.tsx
git commit -m "feat(boosts): add BoostModal with card UI, replace confirmation, lock state"
```

---

### Task 7: Встроить BoostButton + BoostModal в GameCanvas

**Files:**
- Modify: `garage-2007-frontend/src/components/GameCanvas.tsx`

**Step 1: Добавить импорты**

```typescript
import BoostButton from './BoostButton'
import BoostModal from './BoostModal'
```

**Step 2: Добавить локальное состояние видимости модалки**

Компонент `GameCanvas` сейчас функциональный без хуков. Добавить:

```typescript
import { useState } from 'react'
```

Внутри компонента `GameCanvas`:
```typescript
  const [showBoostModal, setShowBoostModal] = useState(false)
```

**Step 3: Добавить BoostButton и BoostModal в JSX**

После `<DailyRewardButton ... />` добавить:
```tsx
      <BoostButton onClick={() => setShowBoostModal(true)} />

      <BoostModal
        isOpen={showBoostModal}
        onClose={() => setShowBoostModal(false)}
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

Проверить:
- [ ] Круглая кнопка 🚀 БУСТ видна на game tab под кнопкой 🔥
- [ ] Клик открывает модалку с тремя карточками
- [ ] × закрывает модалку
- [ ] Суперклик (turbo): доступен, кнопка «КУПИТЬ»
- [ ] X2 Доход (income_2x): заблокирован 🔒 MILESTONE 5 (если milestone 5 не куплен)
- [ ] X3 Доход (income_3x): заблокирован 🔒 MILESTONE 10
- [ ] После покупки буста — кнопка 🚀 показывает таймер, карточка в модалке показывает «АКТИВЕН»

**Step 6: Коммит**

```bash
git add garage-2007-frontend/src/components/GameCanvas.tsx
git commit -m "feat(boosts): integrate BoostButton and BoostModal into GameCanvas"
```

---

### Task 8: Финальная проверка

**Step 1: TypeScript**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

Ожидание: 0 ошибок.

**Step 2: Lint**

```bash
cd garage-2007-frontend && npm run lint 2>&1 | grep -v ".claude/worktrees"
```

Ожидание: те же 16 pre-existing ошибок, новых нет.

**Step 3: Production build**

```bash
cd garage-2007-frontend && npm run build
```

Ожидание: `✓ built` без TypeScript ошибок.

**Step 4: Smoke-тест сценарии**

```bash
cd garage-2007-frontend && npm run preview
```

- [ ] BoostsBar полоска между canvas и footer — **отсутствует**
- [ ] Кнопка 🚀 БУСТ видна на game tab, справа ниже 🔥
- [ ] Модалка открывается по клику, закрывается по ×
- [ ] `turbo` (Суперклик, 15 🔩) — всегда доступен, «КУПИТЬ» работает
- [ ] После покупки `turbo` — кнопка 🚀 показывает таймер `M:SS`
- [ ] `income_2x` — заблокирован до Milestone 5
- [ ] При нехватке гаек кнопка «КУПИТЬ» показывает «не хватает X 🔩» и открывает NutsPromptModal
- [ ] Если `turbo` активен и нажать «КУПИТЬ» другого — появляется блок подтверждения замены
- [ ] «ЗАМЕНИТЬ» — заменяет буст, «ОТМЕНА» — закрывает подтверждение
- [ ] Клики умножаются при активном `turbo` (×5 к кликам)
- [ ] При `income_2x` активен — пассивный доход и клики удваиваются
- [ ] Офлайн-доход бустами не умножается (GDD 2.9)
- [ ] После перезагрузки — активный буст восстанавливается (если не истёк)
- [ ] Phaser: золотая рамка при активном бусте

**Step 5: Коммит**

```bash
git add -A
git commit -m "feat(stage-8-refinement): complete boost system refinement per GDD v3.0"
```
