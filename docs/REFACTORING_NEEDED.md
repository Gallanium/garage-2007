# Refactoring Needed — «Гараж 2007»

> Анализ текущей кодовой базы на предмет спагетти-кода,
> архитектурных нарушений и технического долга.

---

## КРИТИЧЕСКИЕ: Phaser сцена (MainScene.ts)

### Проблема 1: Монолитная сцена — логика, визуал и данные в одном файле

**Файл:** `src/game/MainScene.ts` (~310 строк)

MainScene содержит ВСЁ в одном классе:
- Данные уровневых цветов (20 записей в `LEVEL_COLORS`)
- Создание gameObjects (placeholder прямоугольник + текст)
- Обработку кликов (pointerdown → emit)
- Создание particle эффектов (click effects, level-up effects)
- Управление tweens (анимации нажатия, перехода уровня, вспышки)
- Синхронизацию данных из React (`syncGameData`)

Это классический «God Object» паттерн. При добавлении декораций, событий, бустов, рабочих-спрайтов файл вырастет до 1000+ строк.

**Рекомендуемый рефакторинг:**

```
src/game/
├── MainScene.ts              # Оркестратор: create/update/shutdown
├── managers/
│   ├── GarageVisualManager.ts   # Спрайт гаража, цвета, уровни
│   ├── ClickEffectManager.ts    # Particle effects при кликах
│   ├── LevelUpEffectManager.ts  # Вспышка + партиклы при апгрейде
│   ├── EventEffectManager.ts    # Визуалы случайных событий (Stage 9)
│   ├── BoostEffectManager.ts    # Аура/свечение бустов (Stage 8)
│   └── DecorationManager.ts     # Размещение декораций (Stage 10)
├── config/
│   └── garageColors.ts          # LEVEL_COLORS вынесено
├── gameConfig.ts
├── types.ts
└── PhaserGame.tsx
```

Каждый manager получает ссылку на `scene` и управляет своим набором game objects:

```typescript
// Пример: ClickEffectManager.ts
export class ClickEffectManager {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.container = scene.add.container(0, 0)
    this.container.setDepth(DEPTH_LAYERS.EFFECTS)
  }

  createClickEffect(x: number, y: number): void {
    // вся логика particle effects из MainScene
  }

  destroy(): void {
    this.container.destroy()
  }
}
```

**Влияние:** Средне-высокое. Без этого рефакторинга Stage 8-10 создадут неуправляемый файл.

---

### Проблема 2: Хардкод LEVEL_COLORS внутри класса

**Строки:** 22-42 в `MainScene.ts`

20 цветовых значений захардкожены как `private readonly` поле класса. При переходе на реальные спрайты эта таблица будет бесполезна, но пока мешает читаемости.

**Решение:** Вынести в `src/game/config/garageColors.ts`:

```typescript
export const LEVEL_COLORS: Record<number, number> = { 1: 0x8B4513, ... }
```

---

### Проблема 3: Дублирование particle-логики

`createClickEffect` и `createLevelUpEffect` — два метода с почти идентичным паттерном: создание circles → tween → destroy. Различия: количество частиц, радиус разлёта, цвет, траектория.

**Решение:** Общий `spawnParticles(config: ParticleConfig)` utility:

```typescript
interface ParticleConfig {
  x: number; y: number
  count: number
  color: number
  radiusRange: [number, number]
  distanceRange: [number, number]
  durationRange: [number, number]
  fadeUp?: number        // смещение вверх при движении
  startDistance?: number  // для кругового разлёта (level-up)
}
```

---

## ВЫСОКИЙ ПРИОРИТЕТ: gameStore.ts — монолитный файл ~1800 строк

### Проблема 4: Всё в одном файле

`gameStore.ts` содержит:
- ~100 строк констант экономики
- ~100 строк типов
- ~200 строк каталога достижений
- ~50 строк ежедневных наград
- ~100 строк формул расчёта
- ~800 строк store (state + actions)
- ~100 строк селекторов

При добавлении бустов, событий, декораций, лиг файл вырастет до 3000+ строк.

**Рекомендуемый рефакторинг:**

```
src/store/
├── gameStore.ts               # create<GameStore>() — склейка всех слайсов
├── types.ts                   # GameState, GameActions, все интерфейсы
├── constants/
│   ├── economy.ts             # BASE_COSTS, WORKER_INCOME, WORKER_LIMITS, COST_MULTIPLIER
│   ├── garageLevels.ts        # GARAGE_LEVEL_THRESHOLDS, GARAGE_LEVEL_NAMES, MILESTONE_*
│   ├── achievements.ts        # ACHIEVEMENTS, AchievementId, AchievementDefinition
│   └── dailyRewards.ts        # DAILY_REWARDS, DAILY_STREAK_GRACE_PERIOD_MS
├── formulas/
│   ├── upgradeCost.ts         # calculateUpgradeCost, calculateWorkerCost
│   ├── income.ts              # calculateClickIncome, calculateTotalPassiveIncome
│   └── progression.ts         # checkAutoLevel, calculateWorkSpeedMultiplier
├── actions/
│   ├── clickActions.ts        # handleClick
│   ├── upgradeActions.ts      # purchaseClickUpgrade, purchaseWorkSpeedUpgrade
│   ├── workerActions.ts       # hireWorker
│   ├── milestoneActions.ts    # purchaseMilestone, checkForMilestone, closeMilestoneModal
│   ├── achievementActions.ts  # checkAchievements, claimAchievement
│   ├── dailyRewardActions.ts  # checkDailyReward, claimDailyReward
│   ├── persistenceActions.ts  # saveProgress, loadProgress, addOfflineEarnings
│   └── passiveIncomeActions.ts# startPassiveIncome
└── selectors.ts               # Все useXxx() хуки
```

**Подход:** Использовать паттерн Zustand slices:

```typescript
// actions/clickActions.ts
import type { StateCreator } from 'zustand'
import type { GameStore } from '../types'

export const createClickSlice: StateCreator<GameStore, [], [], Pick<GameStore, 'handleClick'>> = (set, get) => ({
  handleClick: () => { /* ... */ }
})
```

**Влияние:** Критическое для поддерживаемости. Каждая новая фича добавляет ~100-200 строк.

---

## СРЕДНИЙ ПРИОРИТЕТ

### Проблема 5: App.tsx — overloaded корневой компонент (~400 строк)

App.tsx содержит:
- 12 useEffect хуков
- Логику canClaimToday (derived state)
- Весь рендер включая header, tabs, game footer, modals
- Debug overlay

**Решение:** Извлечь в кастомные хуки и компоненты:

```typescript
// hooks/useGameLifecycle.ts — загрузка, автосохранение, beforeunload
// hooks/useOfflineEarnings.ts — модалка welcome back
// components/GameHeader.tsx — верхняя панель
// components/GameFooter.tsx — нижняя панель со статами
// components/GameCanvas.tsx — main с Phaser + overlay + DailyRewardButton
```

---

### Проблема 6: PhaserGame.tsx — inline styles

**Строки:** 148-175 в `PhaserGame.tsx`

Loader и error state используют inline `style={{}}` вместо Tailwind:

```tsx
// ❌ Текущее
<div style={{ position: 'absolute', color: '#E6B800', fontSize: '14px', ... }}>

// ✅ Должно быть
<div className="absolute text-garage-yellow text-sm font-bold font-mono">
```

---

### Проблема 7: Отсутствие error boundaries

Если Phaser крашится или store выбрасывает исключение — приложение белый экран. Нужен `ErrorBoundary` компонент для graceful degradation.

---

## НИЗКИЙ ПРИОРИТЕТ

### Проблема 8: storageService.ts — deprecated `saveGame()`

Функция `saveGame()` помечена как `@deprecated`, но не удалена. Удалить после подтверждения, что нигде не используется (кроме `storageService` default export).

### Проблема 9: DEV-консоль в main.tsx

~200 строк DEV-кода в `main.tsx`. Вынести в `src/dev/devConsole.ts` и импортировать условно:

```typescript
if (import.meta.env.DEV) {
  import('./dev/devConsole').then((m) => m.initDevConsole())
}
```

### Проблема 10: Magic numbers в UI

В компонентах используются магические значения: `text-[8px]`, `text-[10px]`, `bottom-4`, `top-3 right-3`. Создать Tailwind-пресеты для типичных размеров UI:

```javascript
// tailwind.config.js extend
fontSize: {
  'game-xs': ['8px', { lineHeight: '10px' }],
  'game-sm': ['10px', { lineHeight: '12px' }],
  'game-base': ['12px', { lineHeight: '16px' }],
}
```

---

## Порядок рефакторинга

| # | Что | Когда | Почему |
|---|---|---|---|
| 1 | MainScene.ts → managers | **Перед Stage 8** | Каждая новая фича добавляет визуалы в сцену |
| 2 | LEVEL_COLORS → config | Вместе с #1 | Тривиально, часть того же PR |
| 3 | gameStore.ts → slices | **Перед Stage 9** | Events + Boosts + Decorations утроят размер файла |
| 4 | App.tsx → hooks + components | Перед Stage 12 | Telegram SDK добавит ещё логику в App |
| 5 | PhaserGame inline styles | Любой момент | 5 минут работы |
| 6 | Error boundaries | Перед публичным релизом | Crash protection |
| 7-10 | Остальное | По мере необходимости | Tech debt cleanup |
