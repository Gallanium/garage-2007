# Stage 8 — Система бустов: Design Doc

**Дата:** 2026-03-07
**Приоритет:** P0
**GDD:** раздел 2.3
**ROADMAP:** Stage 8
**Зависимости:** нет

---

## 1. Цель

Реализовать систему временных бустов — основной sink для гаек (премиум-валюта) и ключевую F2P-монетизационную механику. Игрок тратит гайки на временные множители дохода.

---

## 2. Бусты по GDD v3.0

| Тип          | Цена    | Эффект                          | Длительность |
|---|---|---|---|
| `income_2x`  | 50 🔩   | ×2 ко всему доходу (клики + пассив) | 1 час    |
| `income_3x`  | 80 🔩   | ×3 ко всему доходу               | 30 минут  |
| `turbo`      | 30 🔩   | ×5 к доходу за клик (только клики) | 15 минут |

---

## 3. Архитектурное решение: Подход B — отдельный слайс

Выбран Подход B: `boostActions.ts` — отдельный `StateCreator` с собственным `setInterval` для тика. Аналогичен паттерну остальных слайсов.

### Обоснование

- Чистое разделение ответственности (не усложняет `persistenceActions.ts`)
- Паттерн совпадает с остальными слайсами проекта
- Изолированная тестируемость
- `startPassiveIncome` не усложняется

---

## 4. Типы и константы

### Типы (`src/store/types.ts`) — расширение существующих

Типы `BoostType`, `BoostDefinition`, `ActiveBoost`, `BoostsState` уже определены в `types.ts`. Необходимо:

**Добавить в `GameState`:**
```typescript
boosts: BoostsState  // { active: ActiveBoost[] }
```

**Добавить в `GameActions`:**
```typescript
activateBoost: (type: BoostType) => boolean
tickBoosts: () => void
getActiveMultiplier: (scope: 'income' | 'click') => number
startBoostTick: () => () => void
```

### Константы (`src/store/constants/boosts.ts`) — новый файл

```typescript
export const BOOST_DEFINITIONS: Record<BoostType, BoostDefinition> = {
  income_2x: { label: 'Двойной доход', costNuts: 50,  durationMs: 3_600_000, multiplier: 2, description: '×2 ко всему доходу 1 час'  },
  income_3x: { label: 'Тройной доход', costNuts: 80,  durationMs: 1_800_000, multiplier: 3, description: '×3 ко всему доходу 30 мин' },
  turbo:     { label: 'Суперклик',    costNuts: 30,  durationMs:   900_000, multiplier: 5, description: '×5 к кликам 15 мин'         },
}

// Группы взаимоисключающих бустов (нельзя активировать одновременно)
export const BOOST_CONFLICT_GROUPS: BoostType[][] = [
  ['income_2x', 'income_3x'],
]
```

---

## 5. Store slice

### `src/store/actions/boostActions.ts` — новый файл

**`activateBoost(type: BoostType) → boolean`**
1. Проверить `nuts >= costNuts` → вернуть `false` если нет
2. Проверить конфликты: если в `boosts.active` есть буст из той же группы — вернуть `false`
3. `_set`: списать гайки, добавить `{ type, activatedAt: now, expiresAt: now + durationMs }` в `boosts.active`
4. Вызвать `saveProgress()`
5. Вернуть `true`

**`tickBoosts()`**
- Фильтрует `boosts.active` — удаляет записи где `Date.now() > expiresAt`
- Вызывается каждую секунду из `startBoostTick()`

**`getActiveMultiplier(scope: 'income' | 'click') → number`**
- Чистая функция над `get().boosts.active`
- `'income'` → произведение `multiplier` бустов `income_2x` / `income_3x` (или `1` если нет)
- `'click'` → `turbo.multiplier` (если активен, иначе `1`) × `getActiveMultiplier('income')`
- Таким образом `turbo` получает оба множителя: `×5 × incomeMultiplier`

**`startBoostTick() → () => void`**
- `setInterval(get().tickBoosts, 1000)`
- Возвращает cleanup функцию

### Пример стекания

| Активные бусты       | `getActiveMultiplier('income')` | `getActiveMultiplier('click')` |
|---|---|---|
| Нет                  | ×1                              | ×1                             |
| `income_2x`          | ×2                              | ×2                             |
| `turbo`              | ×1                              | ×5                             |
| `income_2x` + `turbo`| ×2                              | ×10                            |

---

## 6. Интеграция в существующий код

### `src/store/actions/clickActions.ts`

```typescript
handleClick: () => {
  const multiplier = get().getActiveMultiplier('click')
  const income = (isCritical ? clickValue * CRITICAL_CLICK_MULTIPLIER : clickValue) * multiplier
  // остальная логика без изменений
}
```

### `src/store/actions/persistenceActions.ts` — `startPassiveIncome`

```typescript
if (passiveIncomePerSecond > 0) {
  const multiplier = get().getActiveMultiplier('income')
  const earned = roundCurrency(passiveIncomePerSecond * multiplier)
  // использовать earned вместо passiveIncomePerSecond
}
```

> **Важно:** оффлайн-доход бусты НЕ учитывают (GDD 2.5). `calculateOfflineEarnings` остаётся без изменений.

### `src/store/gameStore.ts`

```typescript
import { createBoostSlice } from './actions/boostActions'

export const useGameStore = create<GameStore>((...a) => ({
  ...initialState,
  ...createBoostSlice(...a),    // ← добавить
  // остальные слайсы без изменений
}))

export * from './constants/boosts'  // ← добавить
```

### `src/store/initialState.ts`

```typescript
boosts: { active: [] },
```

### `src/App.tsx` — запуск тика

```typescript
// В useGameLifecycle или напрямую в App useEffect:
useEffect(() => {
  const cleanup = startBoostTick()
  return cleanup
}, [])
```

---

## 7. Persistence

### `src/utils/storageService.ts`

**`SAVE_VERSION`** → **5**

**Расширение `SaveData`:**
```typescript
boosts?: {
  active: Array<{ type: string; activatedAt: number; expiresAt: number }>
}
```

**Миграция v4 → v5 в `loadGame()`:**
```typescript
if (merged.version < 5) {
  merged.boosts = { active: [] }
  merged.version = 5
}
```

**При загрузке (`loadProgress`)** — фильтровать протухшие бусты:
```typescript
const now = Date.now()
const restoredBoosts = (saveData.boosts?.active ?? [])
  .filter(b => b.expiresAt > now)
_set({ boosts: { active: restoredBoosts }, ... })
```

**При сохранении (`saveProgress`)** — добавить поле:
```typescript
boosts: {
  active: s.boosts.active.map(b => ({
    type: b.type, activatedAt: b.activatedAt, expiresAt: b.expiresAt,
  }))
}
```

---

## 8. UI компоненты

### `src/components/BoostsBar.tsx` — новый файл

**Расположение:** game tab, между Phaser-канвасом и stats-footer (всегда видим).

**Три кнопки — по одной на каждый буст. Состояния:**

| Состояние          | Визуал                                     | Поведение при тапе      |
|---|---|---|
| `can_buy`          | Жёлтая кнопка, цена в гайках              | `activateBoost(type)`   |
| `active`           | Зелёная, таймер `MM:SS` из `expiresAt`    | Ничего                  |
| `blocked_conflict` | Серая, текст «Уже активен»                 | Ничего                  |
| `blocked_nuts`     | Серая, красный дефицит «-X 🔩»            | Открыть `NutsPromptModal` |

**Таймер:** `useEffect` + `setInterval(1000)` внутри компонента, читает `expiresAt` из store.

**Селекторы:**
```typescript
const activeBoosts = useGameStore(s => s.boosts.active)
const nuts = useNuts()
const activateBoost = useGameStore(s => s.activateBoost)
```

### `src/components/NutsPromptModal.tsx` — новый файл

Лёгкая (не fullscreen) модалка — монетизационный промпт при нехватке гаек.

**Содержимое:**
- Крестик (×) в правом верхнем углу для закрытия
- «Нужно ещё X 🔩» (показывает дефицит)
- Кнопка «📺 Смотреть рекламу» → `watchRewardedVideo()` (уже реализовано)
- Кнопка «💎 Купить гайки» → заглушка `purchaseNuts()` (реализуется в Stage 14)

**Props:**
```typescript
interface NutsPromptModalProps {
  isOpen: boolean
  deficit: number        // сколько не хватает гаек
  onClose: () => void
}
```

---

## 9. Phaser — визуальный индикатор

### `src/game/MainScene.ts`

Новый публичный метод `setBoostActive(isActive: boolean)`:
- `true` → создаёт/показывает Phaser Graphics с pulse-анимацией поверх гаража (низкий alpha, цвет `EFFECT_COLORS` из `types.ts`)
- `false` → скрывает/уничтожает эффект

### `src/game/PhaserGame.tsx`

```typescript
// Новый prop:
hasAnyActiveBoost: boolean

// В useEffect при изменении prop:
sceneRef.current?.setBoostActive(hasAnyActiveBoost)
```

**Селектор в `App.tsx`:**
```typescript
const hasAnyActiveBoost = useGameStore(s => s.boosts.active.length > 0)
```

---

## 10. Новые селекторы (`src/store/selectors.ts`)

```typescript
export const useBoosts      = () => useGameStore(s => s.boosts.active)
export const useActivateBoost = () => useGameStore(s => s.activateBoost)
export const useHasActiveBoost = (type: BoostType) =>
  useGameStore(s => s.boosts.active.some(b => b.type === type))
```

---

## 11. Порядок реализации (для плана)

1. Константы: `src/store/constants/boosts.ts`
2. Типы: расширить `GameState` и `GameActions` в `types.ts`
3. `initialState.ts`: добавить `boosts`
4. Store slice: `src/store/actions/boostActions.ts`
5. `gameStore.ts`: подключить слайс, экспортировать константы
6. Persistence: `storageService.ts` (SAVE_VERSION=5, миграция, SaveData)
7. `persistenceActions.ts`: save/load + интеграция множителя в `startPassiveIncome`
8. `clickActions.ts`: интеграция множителя в `handleClick`
9. `selectors.ts`: новые селекторы
10. `App.tsx`: запуск `startBoostTick`
11. UI: `BoostsBar.tsx`
12. UI: `NutsPromptModal.tsx`
13. Phaser: `MainScene.ts` метод `setBoostActive`
14. Phaser: `PhaserGame.tsx` prop + синк
15. TypeScript: `npx tsc --noEmit` — убедиться что нет ошибок
