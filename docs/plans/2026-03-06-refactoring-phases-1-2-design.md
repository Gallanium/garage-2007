# Design: Refactoring Phases 1–2 — «Гараж 2007»

> Date: 2026-03-06 | Status: Approved

## Scope

Problems 1–4 from `REFACTORING_NEEDED.md`:
- **Phase 1** (Critical): MainScene.ts → manager classes + config + particle abstraction
- **Phase 2** (High Priority): gameStore.ts → constants / formulas / actions / selectors slices

No new functionality. No changes to public APIs consumed by components or PhaserGame.tsx.

---

## Phase 1: MainScene → Managers

### File structure

```
src/game/
├── MainScene.ts              # orchestrator only: create/update/shutdown
├── managers/
│   ├── GarageVisualManager.ts   # sprite, level colors, level text, transition tween
│   ├── ClickEffectManager.ts    # particle effect on click
│   └── LevelUpEffectManager.ts  # flash + radial particles on level-up
├── config/
│   └── garageColors.ts          # LEVEL_COLORS extracted from MainScene class
├── utils/
│   └── particles.ts             # shared spawnParticles(config) utility
├── gameConfig.ts               # unchanged
├── types.ts                    # unchanged
└── PhaserGame.tsx              # unchanged
```

### MainScene contract after refactoring

```typescript
export default class MainScene extends Phaser.Scene {
  private garageVisual!: GarageVisualManager
  private clickEffect!: ClickEffectManager
  private levelUpEffect!: LevelUpEffectManager

  create(): void {
    this.garageVisual = new GarageVisualManager(this)
    this.clickEffect = new ClickEffectManager(this)
    this.levelUpEffect = new LevelUpEffectManager(this)
    this.garageVisual.onPointerDown((x, y) => {
      this.clickEffect.spawn(x, y)
      this.events.emit('garageClicked', { x, y, timestamp: Date.now() })
    })
  }

  public updateGarageLevel(level: number): void {
    this.garageVisual.setLevel(level)
    this.levelUpEffect.play(this.garageVisual.center)
  }

  shutdown(): void {
    this.garageVisual.destroy()
    this.clickEffect.destroy()
    this.levelUpEffect.destroy()
  }
}
```

### spawnParticles interface

```typescript
// src/game/utils/particles.ts
interface ParticleConfig {
  scene: Phaser.Scene
  container: Phaser.GameObjects.Container
  x: number; y: number
  count: number
  color: number
  radiusRange: [number, number]
  distanceRange: [number, number]
  durationRange: [number, number]
  riseY?: number           // upward shift for click particles
  startDistance?: number   // ring offset for level-up radial burst
}
export function spawnParticles(config: ParticleConfig): void
```

### Invariants

- `PhaserGame.tsx` public API unchanged: `updateGarageLevel()`, `syncGameData()`, events
- `tsc --noEmit` passes after each file created
- Existing behavior identical (same colors, same animation timings, same particle counts)

---

## Phase 2: gameStore → Slices

### File structure

```
src/store/
├── gameStore.ts          # thin: create<GameStore>() + re-exports for components
├── types.ts              # GameState, GameActions, GameStore, all interfaces
├── selectors.ts          # all useXxx() hooks + constants re-exported for components
├── constants/
│   ├── economy.ts        # BASE_COSTS, WORKER_INCOME, WORKER_LIMITS, COST_MULTIPLIER, CRITICAL_*
│   ├── garageLevels.ts   # GARAGE_LEVEL_THRESHOLDS, GARAGE_LEVEL_NAMES, MILESTONE_UPGRADES, MILESTONE_LEVELS
│   ├── achievements.ts   # ACHIEVEMENTS, AchievementId, AchievementDefinition, PlayerAchievement
│   └── dailyRewards.ts   # DAILY_REWARDS, DAILY_STREAK_GRACE_PERIOD_MS, REWARDED_VIDEO_*, BOOSTS
├── formulas/
│   ├── costs.ts          # calculateUpgradeCost, calculateWorkerCost
│   ├── income.ts         # calculateClickIncome, calculateTotalPassiveIncome, calculateWorkSpeedMultiplier
│   └── progression.ts    # checkAutoLevel, formatLargeNumber
└── actions/
    ├── clickActions.ts
    ├── upgradeActions.ts
    ├── workerActions.ts
    ├── milestoneActions.ts
    ├── achievementActions.ts
    ├── dailyRewardActions.ts
    ├── rewardedVideoActions.ts
    └── persistenceActions.ts  # saveProgress, loadProgress, startPassiveIncome, resetGame, offline
```

### Slice pattern

```typescript
// actions/clickActions.ts
import type { StateCreator } from 'zustand'
import type { GameStore } from '../types'

type ClickSlice = Pick<GameStore, 'handleClick'>

export const createClickSlice: StateCreator<GameStore, [], [], ClickSlice> =
  (set, get) => ({
    handleClick: () => { /* moved from gameStore.ts */ }
  })

// gameStore.ts (final shape)
export const useGameStore = create<GameStore>((...a) => ({
  ...initialState,
  ...createClickSlice(...a),
  ...createUpgradeSlice(...a),
  // ...
}))
```

### Zero-change import strategy for components

`gameStore.ts` re-exports everything from `selectors.ts` and constants. Components keep importing from `'../store/gameStore'` — no component file changes required.

### Also removed in Phase 2

- Deprecated `saveGame()` function from `storageService.ts` (Problem 8 from REFACTORING_NEEDED.md) — confirmed unused outside the deprecated default export object.

### Invariants

- `tsc --noEmit` passes after each step
- Component imports unchanged
- Game behavior identical
- `SAVE_VERSION` and SaveData structure unchanged

---

## Execution order

### Phase 1 steps
1. `src/game/config/garageColors.ts` — extract LEVEL_COLORS
2. `src/game/utils/particles.ts` — spawnParticles utility
3. `src/game/managers/GarageVisualManager.ts`
4. `src/game/managers/ClickEffectManager.ts`
5. `src/game/managers/LevelUpEffectManager.ts`
6. Refactor `MainScene.ts` to use managers
7. `tsc --noEmit` — verify

### Phase 2 steps
1. `src/store/types.ts` — interfaces only
2. `src/store/constants/economy.ts`
3. `src/store/constants/garageLevels.ts`
4. `src/store/constants/achievements.ts`
5. `src/store/constants/dailyRewards.ts`
6. `src/store/formulas/costs.ts`
7. `src/store/formulas/income.ts`
8. `src/store/formulas/progression.ts`
9. `src/store/actions/clickActions.ts`
10. `src/store/actions/upgradeActions.ts`
11. `src/store/actions/workerActions.ts`
12. `src/store/actions/milestoneActions.ts`
13. `src/store/actions/achievementActions.ts`
14. `src/store/actions/dailyRewardActions.ts`
15. `src/store/actions/rewardedVideoActions.ts`
16. `src/store/actions/persistenceActions.ts`
17. `src/store/selectors.ts`
18. Slim `src/store/gameStore.ts`
19. Remove deprecated `saveGame()` from `storageService.ts`
20. `tsc --noEmit` — verify
