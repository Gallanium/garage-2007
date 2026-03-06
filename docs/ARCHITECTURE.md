# Architecture Reference — «Гараж 2007»

> Читай вместе с `AGENT_INSTRUCTIONS.md`.

---

## Слоёная архитектура

```
┌──────────────────────────────────────────────────────┐
│                    UI Layer (React)                    │
│  App.tsx → TabNavigation, Panels, Modals, Buttons     │
│  Правило: ТОЛЬКО рендер + обработка кликов            │
├──────────────────────────────────────────────────────┤
│                 Visual Layer (Phaser 3)               │
│  MainScene.ts → Гараж, эффекты, анимации              │
│  Правило: ТОЛЬКО отрисовка, НЕ хранит состояние      │
├──────────────────────────────────────────────────────┤
│               State Layer (Zustand)                   │
│  gameStore.ts → Единый источник истины                 │
│  Правило: ВСЯ бизнес-логика, формулы, валидации      │
├──────────────────────────────────────────────────────┤
│              Persistence Layer (Utils)                 │
│  storageService.ts → localStorage (→ HTTP API)        │
│  math.ts → Чистые функции                             │
│  Правило: Абстрагирован от хранилища                  │
└──────────────────────────────────────────────────────┘
```

## Zustand Store — структура слайсов

`gameStore.ts` содержит один монолитный store. Логически он разделён на слайсы:

| Слайс | Поля | Описание |
|---|---|---|
| Player | balance, clickValue, totalClicks, garageLevel, nuts | Основные данные игрока |
| Upgrades | upgrades.clickPower, upgrades.workSpeed | Уровни и стоимости апгрейдов |
| Workers | workers.{type}.count/cost, passiveIncomePerSecond | Работники и пассивный доход |
| Milestones | milestonesPurchased, showMilestoneModal, pendingMilestoneLevel | Гейты прогрессии |
| Achievements | achievements, hasNewAchievements | 15 достижений |
| DailyRewards | dailyRewards, showDailyRewardsModal | Ежедневные награды |
| Stats | totalEarned, sessionCount, peakClickIncome, totalPlayTimeSeconds, bestStreak | Аналитика |
| Session | momentaryClickIncome, _clickIncomeThisTick | Сессионные данные (не сохраняются) |
| Offline | lastOfflineEarnings, lastOfflineTimeAway | Данные оффлайн-дохода |
| Meta | isLoaded, lastSessionDate | Служебные поля |

### Правила добавления нового слайса

1. Добавь поля в `interface GameState` с JSDoc.
2. Добавь actions в `interface GameActions`.
3. Добавь начальные значения в `initialState`.
4. Реализуй actions внутри `create<GameStore>()`.
5. Создай селекторы `export const useXxx = () => useGameStore(...)`.
6. Обнови `saveProgress()` и `loadProgress()` если данные должны персиститься.
7. Обнови `SaveData` в `storageService.ts` и инкрементируй `SAVE_VERSION`.
8. Добавь миграцию в `loadGame()` для backward compat.

## Phaser ↔ React интеграция

```
React (PhaserGame.tsx)                    Phaser (MainScene.ts)
─────────────────────                    ─────────────────────
                                         
  containerRef ──────── parent ────────→ Phaser.Game({parent})
                                         
  garageLevel prop ──── useEffect ─────→ scene.updateGarageLevel(n)
                                         
  isActive prop ─────── useEffect ─────→ scene.input.enabled = bool
                                         
  onGarageClick ref ←── events.on ─────← scene.events.emit('garageClicked')
```

### Контракт MainScene

```typescript
// Публичные методы (вызываются из React):
updateGarageLevel(level: number): void   // Обновить визуал уровня
syncGameData(data: SceneData): void      // Синхронизировать произвольные данные

// Emitted events (подписка в PhaserGame.tsx):
'garageClicked' → GarageClickEvent { x, y, timestamp }
'levelTransitionComplete' → LevelTransitionEvent { level }
```

## Система сохранения

### Формат SaveData (v4)

```typescript
{
  version: 4,
  timestamp: number,           // Date.now() момента сохранения
  playerData: {
    balance, nuts, totalClicks, garageLevel,
    milestonesPurchased: number[]
  },
  upgrades: {
    clickPower: { level, cost },
    workSpeed: { level, cost }
  },
  workers: {
    apprentice: { count, cost },
    mechanic: { count, cost },
    master: { count, cost },
    brigadier: { count, cost },
    director: { count, cost }
  },
  stats: {
    totalEarned, sessionCount, lastSessionDate,
    peakClickIncome, totalPlayTimeSeconds, bestStreak
  },
  achievements: Record<string, { unlocked, claimed, unlockedAt? }>,
  dailyRewards: { lastClaimTimestamp, currentStreak }
}
```

### Миграции

При добавлении полей в SaveData:
1. Инкрементируй `SAVE_VERSION`.
2. Добавь блок `if (merged.version < N)` в `loadGame()`.
3. Новые поля должны мерджиться через `deepMerge` с `DEFAULT_SAVE_DATA`.

### Триггеры сохранения

| Триггер | Механизм |
|---|---|
| Автосохранение | setInterval 30 сек |
| Изменение balance/garageLevel | debounce 5 сек |
| Повышение уровня | немедленно |
| Покупка апгрейда/работника/milestone | немедленно |
| Закрытие вкладки | beforeunload event |

## Экономические формулы (быстрая справка)

```
Cost(n)       = floor(BaseCost × 1.15^n)
ClickIncome(n)= n + 1
WorkSpeed(n)  = 1.0 + n × 0.1
PassiveIncome = Σ(worker.count × WORKER_INCOME[type]) × WorkSpeed
OfflineIncome = PassiveIncome × min(timeAway, 86400) с двухступ. эфф.
CritChance    = 5%, CritMultiplier = 2.0
```

Полный справочник: см. `ECONOMY_REFERENCE.md`.

## Навигация табов

Табы реализованы через `visibility: hidden/visible` вместо условного рендера. Phaser canvas остаётся в DOM-дереве при переключении, что предотвращает его пересоздание.

```
activeTab === 'game'         → visible
activeTab === 'upgrades'     → visible (absolute overlay)
activeTab === 'achievements' → visible (absolute overlay)
activeTab === 'stats'        → visible (absolute overlay)
```

## Модальные окна

Все модалки следуют паттерну:
1. Controlled через boolean в store (`showXxxModal`).
2. Закрытие: overlay click + Escape key + крестик.
3. Анимации: `fadeIn` 300ms (overlay) + `slideUp` 400ms (карточка).
4. При открытии модалки — Phaser input отключается (`isActive=false`).
