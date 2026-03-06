# Refactoring Phases 1–2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split monolithic `MainScene.ts` into manager classes and `gameStore.ts` (~2100 lines) into typed slices — no behavior changes, no component import changes.

**Architecture:** Phase 1 extracts Phaser game-object logic into three manager classes with a shared `spawnParticles` utility. Phase 2 splits the store into constants / formulas / actions / selectors directories using the Zustand `StateCreator` slice pattern; `gameStore.ts` becomes a thin assembler that re-exports everything so component imports don't change.

**Tech Stack:** TypeScript 5.9 strict, Phaser 3.90, Zustand 5, Vite 7. Verification: `cd garage-2007-frontend && npx tsc --noEmit` (must pass after every task).

---

## PHASE 1: MainScene → Managers

---

### Task 1: Extract LEVEL_COLORS to config file

**Files:**
- Create: `garage-2007-frontend/src/game/config/garageColors.ts`

**Step 1: Create the file**

```typescript
// src/game/config/garageColors.ts

/** Цвет прямоугольника-плейсхолдера для каждого уровня гаража (1–20). */
export const LEVEL_COLORS: Record<number, number> = {
  1:  0x8B4513, // Ржавая ракушка — тёмно-коричневый
  2:  0xA0522D, // Начало пути — сиена
  3:  0xCD853F, // Базовый ремонт — перу
  4:  0xDEB887, // Мастерская — бурливуд
  5:  0xF4A460, // Гараж механика — песочно-коричневый
  6:  0xD2691E, // Расширение — шоколадный
  7:  0xB8860B, // Специализация — тёмно-золотистый
  8:  0xDAA520, // Растущий бизнес — золотистый
  9:  0x808000, // Автосервис — оливковый
  10: 0x556B2F, // Профи-уровень — тёмно-оливковый
  11: 0x2E8B57, // Модернизация — морской зелёный
  12: 0x20B2AA, // Техцентр — светлый морской
  13: 0x4682B4, // Расширение услуг — стальной синий
  14: 0x4169E1, // Премиум сервис — королевский синий
  15: 0x6A5ACD, // Окрасочная камера — грифельно-синий
  16: 0x7B68EE, // Детейлинг центр — средне-грифельный
  17: 0x9370DB, // Тюнинг ателье — средне-пурпурный
  18: 0xBA55D3, // Дилерский центр — средне-орхидейный
  19: 0xFFD700, // Элитный комплекс — золотой
  20: 0xFFA500, // Автомобильная империя — оранжевый
}
```

**Step 2: Verify**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

Expected: no errors.

**Step 3: Commit**

```bash
git add garage-2007-frontend/src/game/config/garageColors.ts
git commit -m "refactor: extract LEVEL_COLORS to src/game/config/garageColors.ts"
```

---

### Task 2: Create shared spawnParticles utility

**Files:**
- Create: `garage-2007-frontend/src/game/utils/particles.ts`

**Step 1: Create the file**

```typescript
// src/game/utils/particles.ts
import Phaser from 'phaser'
import { DEPTH_LAYERS } from '../types'

export interface ParticleConfig {
  scene: Phaser.Scene
  container: Phaser.GameObjects.Container
  x: number
  y: number
  count: number
  color: number
  /** [min, max] радиус круга в px */
  radiusRange: [number, number]
  /** [min, max] дальность разлёта от точки клика в px */
  distanceRange: [number, number]
  /** [min, max] длительность tween в мс */
  durationRange: [number, number]
  /** Смещение вверх при движении (для click particles). По умолчанию 0. */
  riseY?: number
  /**
   * Расстояние начального кольца от центра (для level-up radial burst).
   * Если указан — частицы стартуют по кругу, а не из точки клика.
   */
  startDistance?: number
}

/**
 * Создаёт n кружков-частиц, анимирует их разлёт и уничтожает по завершении.
 * Используется в ClickEffectManager и LevelUpEffectManager.
 */
export function spawnParticles(config: ParticleConfig): void {
  const {
    scene,
    container,
    x,
    y,
    count,
    color,
    radiusRange,
    distanceRange,
    durationRange,
    riseY = 0,
    startDistance,
  } = config

  for (let i = 0; i < count; i++) {
    const angle = startDistance !== undefined
      ? (360 / count) * i          // равномерно по кольцу (level-up)
      : Phaser.Math.Between(0, 360) // случайный (click)

    const startX = startDistance !== undefined
      ? x + Math.cos(Phaser.Math.DegToRad(angle)) * startDistance
      : x
    const startY = startDistance !== undefined
      ? y + Math.sin(Phaser.Math.DegToRad(angle)) * startDistance
      : y

    const radius = Phaser.Math.Between(radiusRange[0], radiusRange[1])
    const distance = Phaser.Math.Between(distanceRange[0], distanceRange[1])
    const duration = Phaser.Math.Between(durationRange[0], durationRange[1])

    const particle = scene.add.circle(startX, startY, radius, color, 1.0)
    particle.setDepth(DEPTH_LAYERS.EFFECTS)
    container.add(particle)

    const endX = x + Math.cos(Phaser.Math.DegToRad(angle)) * distance
    const endY = y + Math.sin(Phaser.Math.DegToRad(angle)) * distance

    scene.tweens.add({
      targets: particle,
      x: endX,
      y: endY - riseY,
      alpha: 0,
      scale: 0.2,
      duration,
      ease: 'Cubic.easeOut',
      onComplete: () => particle.destroy(),
    })
  }
}
```

**Step 2: Verify**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

Expected: no errors.

**Step 3: Commit**

```bash
git add garage-2007-frontend/src/game/utils/particles.ts
git commit -m "refactor: add shared spawnParticles utility"
```

---

### Task 3: Create GarageVisualManager

**Files:**
- Create: `garage-2007-frontend/src/game/managers/GarageVisualManager.ts`

**Step 1: Create the file**

```typescript
// src/game/managers/GarageVisualManager.ts
import Phaser from 'phaser'
import { DEPTH_LAYERS, ANIMATION_CONFIG } from '../types'
import type { LevelTransitionEvent } from '../types'
import { LEVEL_COLORS } from '../config/garageColors'

/**
 * Управляет визуальным представлением гаража:
 * прямоугольник-плейсхолдер, текст уровня, цвет по уровню,
 * анимация перехода уровня.
 */
export class GarageVisualManager {
  private scene: Phaser.Scene
  private sprite: Phaser.GameObjects.Rectangle
  private levelText: Phaser.GameObjects.Text
  private currentLevel: number = 1

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    const cx = scene.scale.width / 2
    const cy = scene.scale.height / 2

    this.sprite = scene.add.rectangle(cx, cy, 300, 200, LEVEL_COLORS[1], 1.0)
    this.sprite.setDepth(DEPTH_LAYERS.GARAGE)
    this.sprite.setStrokeStyle(3, 0x000000, 0.5)
    this.sprite.setInteractive({ useHandCursor: true })

    this.sprite.on('pointerover', () => this.sprite.setAlpha(0.9))
    this.sprite.on('pointerout',  () => this.sprite.setAlpha(1.0))

    this.levelText = scene.add.text(cx, cy, 'Ур. 1', {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: '"Press Start 2P", cursive',
      align: 'center',
      stroke: '#000000',
      strokeThickness: 3,
    })
    this.levelText.setOrigin(0.5)
    this.levelText.setDepth(DEPTH_LAYERS.UI)
  }

  /** Регистрирует обработчик нажатия на спрайт гаража. */
  onPointerDown(callback: (x: number, y: number) => void): void {
    this.sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      callback(pointer.x, pointer.y)
    })
  }

  /** Обновляет уровень: меняет цвет и текст, воспроизводит tween перехода. */
  setLevel(level: number): void {
    if (level < 1) {
      console.warn('[GarageVisualManager] Недопустимый уровень:', level)
      return
    }
    this.currentLevel = level

    const maxDefined = Math.max(...Object.keys(LEVEL_COLORS).map(Number))
    const colorKey = Math.min(level, maxDefined)
    const newColor = LEVEL_COLORS[colorKey]

    this.scene.tweens.add({
      targets: this.sprite,
      scale: 1.1,
      duration: ANIMATION_CONFIG.DEFAULT_DURATION,
      ease: ANIMATION_CONFIG.EASING.SMOOTH,
      yoyo: true,
      onStart: () => this.sprite.setFillStyle(newColor),
      onComplete: () => {
        const event: LevelTransitionEvent = { level }
        this.scene.events.emit('levelTransitionComplete', event)
      },
    })

    this.levelText.setText(`Ур. ${level}`)
  }

  /** Анимация "нажатия" спрайта при клике. */
  playClickBounce(): void {
    this.scene.tweens.add({
      targets: this.sprite,
      scale: 0.95,
      duration: 100,
      yoyo: true,
      ease: 'Power2',
    })
  }

  /** Центр спрайта — нужен LevelUpEffectManager для радиального взрыва. */
  get center(): { x: number; y: number } {
    return { x: this.sprite.x, y: this.sprite.y }
  }

  destroy(): void {
    this.sprite.removeAllListeners()
    this.sprite.destroy()
    this.levelText.destroy()
  }
}
```

**Step 2: Verify**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

Expected: no errors.

**Step 3: Commit**

```bash
git add garage-2007-frontend/src/game/managers/GarageVisualManager.ts
git commit -m "refactor: add GarageVisualManager"
```

---

### Task 4: Create ClickEffectManager

**Files:**
- Create: `garage-2007-frontend/src/game/managers/ClickEffectManager.ts`

**Step 1: Create the file**

```typescript
// src/game/managers/ClickEffectManager.ts
import Phaser from 'phaser'
import { DEPTH_LAYERS, EFFECT_COLORS } from '../types'
import { spawnParticles } from '../utils/particles'

/**
 * Создаёт визуальный эффект частиц при каждом клике по гаражу.
 * Инкапсулирует логику, ранее находившуюся в MainScene.createClickEffect().
 */
export class ClickEffectManager {
  private container: Phaser.GameObjects.Container

  constructor(scene: Phaser.Scene) {
    this.container = scene.add.container(0, 0)
    this.container.setDepth(DEPTH_LAYERS.EFFECTS)
  }

  /** Воспроизводит взрыв частиц в точке клика (x, y). */
  spawn(scene: Phaser.Scene, x: number, y: number): void {
    spawnParticles({
      scene,
      container: this.container,
      x,
      y,
      count: Phaser.Math.Between(8, 12),
      color: EFFECT_COLORS.money,
      radiusRange: [3, 6],
      distanceRange: [40, 80],
      durationRange: [400, 600],
      riseY: 30,
    })
  }

  destroy(): void {
    this.container.destroy()
  }
}
```

**Step 2: Verify**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

Expected: no errors.

**Step 3: Commit**

```bash
git add garage-2007-frontend/src/game/managers/ClickEffectManager.ts
git commit -m "refactor: add ClickEffectManager"
```

---

### Task 5: Create LevelUpEffectManager

**Files:**
- Create: `garage-2007-frontend/src/game/managers/LevelUpEffectManager.ts`

**Step 1: Create the file**

```typescript
// src/game/managers/LevelUpEffectManager.ts
import Phaser from 'phaser'
import { DEPTH_LAYERS, EFFECT_COLORS } from '../types'
import { spawnParticles } from '../utils/particles'

/**
 * Создаёт вспышку и радиальный взрыв частиц при повышении уровня гаража.
 * Инкапсулирует логику, ранее находившуюся в MainScene.createLevelUpEffect().
 */
export class LevelUpEffectManager {
  private container: Phaser.GameObjects.Container

  constructor(scene: Phaser.Scene) {
    this.container = scene.add.container(0, 0)
    this.container.setDepth(DEPTH_LAYERS.EFFECTS)
  }

  /** Воспроизводит вспышку + радиальный разлёт частиц из точки center. */
  play(scene: Phaser.Scene, center: { x: number; y: number }): void {
    this.spawnFlash(scene, center)
    spawnParticles({
      scene,
      container: this.container,
      x: center.x,
      y: center.y,
      count: 20,
      color: 0xFFD700,
      radiusRange: [4, 4],
      distanceRange: [120, 120],
      durationRange: [800, 800],
      startDistance: 50,
    })
  }

  private spawnFlash(scene: Phaser.Scene, center: { x: number; y: number }): void {
    const flash = scene.add.circle(center.x, center.y, 150, EFFECT_COLORS.levelUp, 0.0)
    flash.setDepth(DEPTH_LAYERS.EFFECTS)
    scene.tweens.add({
      targets: flash,
      alpha: 0.7,
      scale: 1.5,
      duration: 200,
      yoyo: true,
      onComplete: () => flash.destroy(),
    })
  }

  destroy(): void {
    this.container.destroy()
  }
}
```

**Step 2: Verify**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

Expected: no errors.

**Step 3: Commit**

```bash
git add garage-2007-frontend/src/game/managers/LevelUpEffectManager.ts
git commit -m "refactor: add LevelUpEffectManager"
```

---

### Task 6: Refactor MainScene to use managers

**Files:**
- Modify: `garage-2007-frontend/src/game/MainScene.ts`

**Step 1: Replace entire file content**

```typescript
// src/game/MainScene.ts
import Phaser from 'phaser'
import type { SceneData, GarageClickEvent } from './types'
import { GarageVisualManager } from './managers/GarageVisualManager'
import { ClickEffectManager } from './managers/ClickEffectManager'
import { LevelUpEffectManager } from './managers/LevelUpEffectManager'

/**
 * Главная игровая сцена «Гараж 2007».
 * Оркестратор: создаёт и соединяет менеджеры, пробрасывает события.
 * Вся логика визуала делегирована managers/*.
 */
export default class MainScene extends Phaser.Scene {
  private garageVisual!: GarageVisualManager
  private clickEffect!: ClickEffectManager
  private levelUpEffect!: LevelUpEffectManager

  constructor() {
    super({ key: 'MainScene' })
  }

  preload(): void {
    // TODO: Загрузка спрайтов гаража (Stage: Pixel Art Pipeline)
    // TODO: Загрузка звуковых эффектов (Stage 11)
  }

  create(): void {
    this.garageVisual = new GarageVisualManager(this)
    this.clickEffect = new ClickEffectManager(this)
    this.levelUpEffect = new LevelUpEffectManager(this)

    this.garageVisual.onPointerDown((x, y) => {
      this.garageVisual.playClickBounce()
      this.clickEffect.spawn(this, x, y)
      const event: GarageClickEvent = { x, y, timestamp: Date.now() }
      this.events.emit('garageClicked', event)
    })

    this.events.on('playSpecialEffect', () => {
      // TODO: Обработка специальных эффектов (Stage 8)
    })
  }

  update(_time: number, _delta: number): void {
    // Пока пусто — анимации управляются tweens
  }

  /**
   * Обновляет визуал гаража при смене уровня.
   * Вызывается из PhaserGame.tsx.
   */
  public updateGarageLevel(level: number): void {
    this.garageVisual.setLevel(level)
    this.levelUpEffect.play(this, this.garageVisual.center)
  }

  /**
   * Синхронизирует произвольные данные из React.
   * Вызывается из PhaserGame.tsx.
   */
  public syncGameData(data: SceneData): void {
    if (data.garageLevel !== undefined) {
      this.updateGarageLevel(data.garageLevel)
    }
  }

  shutdown(): void {
    this.events.off('garageClicked')
    this.events.off('playSpecialEffect')
    this.garageVisual.destroy()
    this.clickEffect.destroy()
    this.levelUpEffect.destroy()
  }
}
```

**Step 2: Verify**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

Expected: no errors. The public API (`updateGarageLevel`, `syncGameData`, events) is unchanged — `PhaserGame.tsx` needs no edits.

**Step 3: Commit**

```bash
git add garage-2007-frontend/src/game/MainScene.ts
git commit -m "refactor: MainScene → orchestrator using GarageVisualManager, ClickEffectManager, LevelUpEffectManager"
```

---

## PHASE 2: gameStore → Slices

The strategy: create all new files first (tasks 7–22), then slim down `gameStore.ts` (task 23). At every step `tsc --noEmit` passes because the old `gameStore.ts` still exports everything — the new files add alongside it. Only in task 23 does the old content get replaced.

**Import path reminder:** all new store files sit in `src/store/constants/`, `src/store/formulas/`, `src/store/actions/`, so:
- `../../utils/math` → the roundCurrency import
- `../../utils/storageService` → storage functions
- `../types` → GameStore, GameState, WorkerType, etc.
- `../constants/economy` → BASE_COSTS, WORKER_INCOME, etc.
- `../formulas/income` → calculateTotalPassiveIncome, etc.

---

### Task 7: Create src/store/types.ts

**Files:**
- Create: `garage-2007-frontend/src/store/types.ts`

Move all interfaces and type definitions here. This file has **no imports from other store files** — only from `zustand`.

**Step 1: Create the file**

```typescript
// src/store/types.ts
// All interfaces and type aliases for the game store.
// No imports from other store/* files to avoid circular deps.

// ── Workers ──────────────────────────────────────────────────────────────────

export type WorkerType = 'apprentice' | 'mechanic' | 'master' | 'brigadier' | 'director'
export type UpgradeType = 'clickPower' | 'workSpeed'

export interface UpgradeData {
  level: number
  cost: number
  baseCost: number
}

export interface WorkerData {
  count: number
  cost: number
}

export interface UpgradesState {
  clickPower: UpgradeData
  workSpeed: UpgradeData
}

export interface WorkersState {
  apprentice: WorkerData
  mechanic:   WorkerData
  master:     WorkerData
  brigadier:  WorkerData
  director:   WorkerData
}

// ── Achievements ─────────────────────────────────────────────────────────────

export type AchievementCategory = 'progression' | 'earnings' | 'clicks' | 'workers' | 'special'

export type AchievementId =
  | 'garage_level_2' | 'garage_level_5' | 'garage_level_10'
  | 'garage_level_15' | 'garage_level_20'
  | 'earned_10k' | 'earned_1m' | 'earned_1b'
  | 'clicks_100' | 'clicks_1000' | 'clicks_10000'
  | 'workers_1' | 'workers_5' | 'workers_10'
  | 'all_milestones'

export interface AchievementDefinition {
  id: AchievementId
  category: AchievementCategory
  title: string
  description: string
  icon: string
  targetValue: number
  nutsReward: number
  progressGetter: (state: GameState) => number
}

export interface PlayerAchievement {
  unlocked: boolean
  claimed: boolean
  unlockedAt?: number
}

// ── Daily / Video / Boosts ────────────────────────────────────────────────────

export interface DailyRewardsState {
  lastClaimTimestamp: number
  currentStreak: number
}

export interface RewardedVideoState {
  lastWatchedTimestamp: number
  totalWatches: number
  isWatching: boolean
}

export type BoostType = 'income_2x' | 'income_3x' | 'turbo'

export interface BoostDefinition {
  label: string
  costNuts: number
  durationMs: number
  multiplier: number
  description: string
}

export interface ActiveBoost {
  type: BoostType
  activatedAt: number
  expiresAt: number
}

export interface BoostsState {
  active: ActiveBoost[]
}

// ── GameState ─────────────────────────────────────────────────────────────────

export interface GameState {
  balance: number
  clickValue: number
  totalClicks: number
  garageLevel: number
  milestonesPurchased: number[]
  showMilestoneModal: boolean
  pendingMilestoneLevel: number | null
  dismissedMilestoneLevel: number | null
  passiveIncomePerSecond: number
  upgrades: UpgradesState
  workers: WorkersState
  nuts: number
  totalEarned: number
  sessionCount: number
  lastSessionDate: string
  isLoaded: boolean
  lastOfflineEarnings: number
  lastOfflineTimeAway: number
  momentaryClickIncome: number
  _clickIncomeThisTick: number
  peakClickIncome: number
  totalPlayTimeSeconds: number
  bestStreak: number
  achievements: Record<AchievementId, PlayerAchievement>
  hasNewAchievements: boolean
  dailyRewards: DailyRewardsState
  showDailyRewardsModal: boolean
  rewardedVideo: RewardedVideoState
}

// ── GameActions ───────────────────────────────────────────────────────────────

export interface GameActions {
  handleClick: () => boolean
  purchaseClickUpgrade: () => boolean
  purchaseWorkSpeedUpgrade: () => void
  hireWorker: (workerType: WorkerType) => void
  startPassiveIncome: () => () => void
  resetGame: () => void
  saveProgress: () => void
  loadProgress: () => void
  addOfflineEarnings: (amount: number) => void
  clearOfflineEarnings: () => void
  purchaseMilestone: (level: number) => boolean
  checkForMilestone: () => void
  closeMilestoneModal: () => void
  checkAchievements: () => AchievementId[]
  claimAchievement: (achievementId: AchievementId) => boolean
  clearNewAchievementsFlag: () => void
  checkDailyReward: () => void
  claimDailyReward: () => void
  closeDailyRewardsModal: () => void
  openDailyRewardsModal: () => void
  canWatchRewardedVideo: () => boolean
  watchRewardedVideo: () => Promise<boolean>
}

export type GameStore = GameState & GameActions
```

**Step 2: Verify**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add garage-2007-frontend/src/store/types.ts
git commit -m "refactor: add src/store/types.ts with all interfaces"
```

---

### Task 8: Create src/store/constants/economy.ts

**Files:**
- Create: `garage-2007-frontend/src/store/constants/economy.ts`

**Step 1: Create the file**

```typescript
// src/store/constants/economy.ts
// Economic constants from GBD v1.1.

export const BASE_COSTS = {
  clickUpgrade: 100,
  apprentice:   500,
  mechanic:     5_000,
  master:       50_000,
  brigadier:    500_000,
  director:     5_000_000,
  workSpeed:    500,
} as const

export const WORKER_INCOME = {
  apprentice: 2,
  mechanic:   20,
  master:     200,
  brigadier:  2_000,
  director:   20_000,
} as const

export const WORKER_LIMITS = {
  apprentice: 3,
  mechanic:   5,
  master:     3,
  brigadier:  2,
  director:   1,
} as const

export const COST_MULTIPLIER = 1.15
export const CLICK_UPGRADE_MAX_LEVEL = 200
export const WORK_SPEED_BONUS_PER_LEVEL = 0.1

/** GDD 4.1: шанс критического клика */
export const CRITICAL_CLICK_CHANCE = 0.05
/** GDD 4.1: множитель критического клика */
export const CRITICAL_CLICK_MULTIPLIER = 2
```

**Step 2: Verify**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add garage-2007-frontend/src/store/constants/economy.ts
git commit -m "refactor: add src/store/constants/economy.ts"
```

---

### Task 9: Create src/store/constants/garageLevels.ts

**Files:**
- Create: `garage-2007-frontend/src/store/constants/garageLevels.ts`

**Step 1: Create the file**

```typescript
// src/store/constants/garageLevels.ts
import type { WorkerType } from '../types'

export const GARAGE_LEVEL_THRESHOLDS: Record<number, number> = {
  1:  0,
  2:  10_000,
  3:  50_000,
  4:  200_000,
  5:  1_000_000,
  6:  5_000_000,
  7:  25_000_000,
  8:  100_000_000,
  9:  300_000_000,
  10: 1_000_000_000,
  11: 5_000_000_000,
  12: 25_000_000_000,
  13: 100_000_000_000,
  14: 300_000_000_000,
  15: 1_000_000_000_000,
  16: 5_000_000_000_000,
  17: 25_000_000_000_000,
  18: 100_000_000_000_000,
  19: 300_000_000_000_000,
  20: 1_000_000_000_000_000,
} as const

export const GARAGE_LEVEL_NAMES = {
  1:  'Ржавая ракушка',
  2:  'Начало пути',
  3:  'Базовый ремонт',
  4:  'Мастерская',
  5:  'Гараж механика',
  6:  'Расширение',
  7:  'Специализация',
  8:  'Растущий бизнес',
  9:  'Автосервис',
  10: 'Профи-уровень',
  11: 'Модернизация',
  12: 'Техцентр',
  13: 'Расширение услуг',
  14: 'Премиум сервис',
  15: 'Окрасочная камера',
  16: 'Детейлинг центр',
  17: 'Тюнинг ателье',
  18: 'Дилерский центр',
  19: 'Элитный комплекс',
  20: 'Автоимперия',
} as const

export const MILESTONE_LEVELS = [5, 10, 15, 20] as const
export type MilestoneLevel = typeof MILESTONE_LEVELS[number]

export const MILESTONE_UPGRADES: Record<MilestoneLevel, {
  cost: number
  workerTypes: WorkerType[]
  workerNames: string[]
  unlocks: {
    workers: string[]
    upgrades: string[]
    decorations: string[]
    visual: string
  }
}> = {
  5: {
    cost: 1_000_000,
    workerTypes: ['mechanic'],
    workerNames: ['Механик'],
    unlocks: {
      workers: ['Механик (20 ₽/сек, макс. 5)'],
      upgrades: ['Энергетики (+10% к доходу работников)'],
      decorations: [],
      visual: '',
    },
  },
  10: {
    cost: 1_000_000_000,
    workerTypes: ['master'],
    workerNames: ['Мастер'],
    unlocks: {
      workers: ['Мастер (200 ₽/сек, макс. 3)'],
      upgrades: [],
      decorations: [],
      visual: '',
    },
  },
  15: {
    cost: 1_000_000_000_000,
    workerTypes: ['brigadier'],
    workerNames: ['Бригадир'],
    unlocks: {
      workers: ['Бригадир (2 000 ₽/сек, макс. 2)'],
      upgrades: [],
      decorations: [],
      visual: '',
    },
  },
  20: {
    cost: 1_000_000_000_000_000,
    workerTypes: ['director'],
    workerNames: ['Директор'],
    unlocks: {
      workers: ['Директор (20 000 ₽/сек, макс. 1)'],
      upgrades: [],
      decorations: [],
      visual: '',
    },
  },
}
```

**Step 2: Verify**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add garage-2007-frontend/src/store/constants/garageLevels.ts
git commit -m "refactor: add src/store/constants/garageLevels.ts"
```

---

### Task 10: Create src/store/constants/achievements.ts

**Files:**
- Create: `garage-2007-frontend/src/store/constants/achievements.ts`

**Step 1: Create the file**

```typescript
// src/store/constants/achievements.ts
import type { AchievementId, AchievementDefinition, WorkersState, GameState } from '../types'

export function getTotalWorkerCount(workers: WorkersState): number {
  return (
    workers.apprentice.count +
    workers.mechanic.count +
    workers.master.count +
    workers.brigadier.count +
    workers.director.count
  )
}

export const ACHIEVEMENTS: Record<AchievementId, AchievementDefinition> = {
  garage_level_2:  { id: 'garage_level_2',  category: 'progression', title: 'Первые шаги',          description: 'Достигните 2 уровня гаража',          icon: '🏗️', targetValue: 2,           nutsReward: 5,   progressGetter: (s: GameState) => s.garageLevel },
  garage_level_5:  { id: 'garage_level_5',  category: 'progression', title: 'Любительская мастерская', description: 'Достигните 5 уровня гаража',          icon: '🔧', targetValue: 5,           nutsReward: 20,  progressGetter: (s: GameState) => s.garageLevel },
  garage_level_10: { id: 'garage_level_10', category: 'progression', title: 'Профессионал',           description: 'Достигните 10 уровня гаража',         icon: '⚙️', targetValue: 10,          nutsReward: 50,  progressGetter: (s: GameState) => s.garageLevel },
  garage_level_15: { id: 'garage_level_15', category: 'progression', title: 'Элитный сервис',         description: 'Достигните 15 уровня гаража',         icon: '🏢', targetValue: 15,          nutsReward: 80,  progressGetter: (s: GameState) => s.garageLevel },
  garage_level_20: { id: 'garage_level_20', category: 'progression', title: 'Автомобильная империя',  description: 'Достигните 20 уровня гаража',         icon: '👑', targetValue: 20,          nutsReward: 50,  progressGetter: (s: GameState) => s.garageLevel },
  earned_10k:      { id: 'earned_10k',      category: 'earnings',    title: 'Первые деньги',          description: 'Заработайте 10,000₽',                 icon: '💵', targetValue: 10_000,       nutsReward: 10,  progressGetter: (s: GameState) => s.totalEarned },
  earned_1m:       { id: 'earned_1m',       category: 'earnings',    title: 'Миллионер',              description: 'Заработайте 1,000,000₽',              icon: '💰', targetValue: 1_000_000,    nutsReward: 25,  progressGetter: (s: GameState) => s.totalEarned },
  earned_1b:       { id: 'earned_1b',       category: 'earnings',    title: 'Миллиардер',             description: 'Заработайте 1,000,000,000₽',          icon: '💎', targetValue: 1_000_000_000, nutsReward: 40,  progressGetter: (s: GameState) => s.totalEarned },
  clicks_100:      { id: 'clicks_100',      category: 'clicks',      title: 'Кликер-новичок',         description: 'Совершите 100 кликов',                icon: '👆', targetValue: 100,          nutsReward: 10,  progressGetter: (s: GameState) => s.totalClicks },
  clicks_1000:     { id: 'clicks_1000',     category: 'clicks',      title: 'Кликер-мастер',          description: 'Совершите 1,000 кликов',              icon: '🖱️', targetValue: 1_000,         nutsReward: 20,  progressGetter: (s: GameState) => s.totalClicks },
  clicks_10000:    { id: 'clicks_10000',    category: 'clicks',      title: 'Кликер-легенда',         description: 'Совершите 10,000 кликов',             icon: '⚡', targetValue: 10_000,       nutsReward: 30,  progressGetter: (s: GameState) => s.totalClicks },
  workers_1:       { id: 'workers_1',       category: 'workers',     title: 'Первый сотрудник',       description: 'Наймите первого работника',           icon: '👷', targetValue: 1,            nutsReward: 10,  progressGetter: (s: GameState) => getTotalWorkerCount(s.workers) },
  workers_5:       { id: 'workers_5',       category: 'workers',     title: 'Маленькая команда',      description: 'Наймите 5 работников',               icon: '👥', targetValue: 5,            nutsReward: 20,  progressGetter: (s: GameState) => getTotalWorkerCount(s.workers) },
  workers_10:      { id: 'workers_10',      category: 'workers',     title: 'Большая команда',        description: 'Наймите 10 работников',              icon: '👨‍👩‍👧‍👦', targetValue: 10,           nutsReward: 30,  progressGetter: (s: GameState) => getTotalWorkerCount(s.workers) },
  all_milestones:  { id: 'all_milestones',  category: 'special',     title: 'Покоритель вершин',      description: 'Купите все доступные апгрейды',      icon: '🏆', targetValue: 4,            nutsReward: 100, progressGetter: (s: GameState) => s.milestonesPurchased.length },
} as const

export const TOTAL_ACHIEVEMENT_NUTS =
  Object.values(ACHIEVEMENTS).reduce((sum, a) => sum + a.nutsReward, 0)
```

**Step 2: Verify**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add garage-2007-frontend/src/store/constants/achievements.ts
git commit -m "refactor: add src/store/constants/achievements.ts"
```

---

### Task 11: Create src/store/constants/dailyRewards.ts

**Files:**
- Create: `garage-2007-frontend/src/store/constants/dailyRewards.ts`

**Step 1: Create the file**

```typescript
// src/store/constants/dailyRewards.ts
import type { BoostType, BoostDefinition } from '../types'

// ── Daily rewards ─────────────────────────────────────────────────────────────

export const DAILY_REWARDS = [5, 5, 5, 5, 5, 5, 50] as const
export const DAILY_REWARDS_TOTAL = DAILY_REWARDS.reduce((s, r) => s + r, 0) // 80
export const DAILY_STREAK_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000

// ── Rewarded video ────────────────────────────────────────────────────────────

export const REWARDED_VIDEO_NUTS = 5
export const REWARDED_VIDEO_COOLDOWN_MS = 60 * 60 * 1000
export const REWARDED_VIDEO_FAKE_DURATION_MS = 3000

// ── Boosts ────────────────────────────────────────────────────────────────────

export const BOOSTS: Record<BoostType, BoostDefinition> = {
  income_2x: {
    label: 'Двойной доход',
    costNuts: 50,
    durationMs: 60 * 60 * 1000,
    multiplier: 2,
    description: '×2 к доходу на 1 час',
  },
  income_3x: {
    label: 'Тройной доход',
    costNuts: 80,
    durationMs: 30 * 60 * 1000,
    multiplier: 3,
    description: '×3 к доходу на 30 мин',
  },
  turbo: {
    label: 'Турбо-клик',
    costNuts: 30,
    durationMs: 15 * 60 * 1000,
    multiplier: 5,
    description: '×5 к клику на 15 мин',
  },
} as const

export const MAX_ACTIVE_BOOSTS = 3
```

**Step 2: Verify**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add garage-2007-frontend/src/store/constants/dailyRewards.ts
git commit -m "refactor: add src/store/constants/dailyRewards.ts"
```

---

### Task 12: Create src/store/formulas/costs.ts

**Files:**
- Create: `garage-2007-frontend/src/store/formulas/costs.ts`

**Step 1: Create the file**

```typescript
// src/store/formulas/costs.ts
import { COST_MULTIPLIER } from '../constants/economy'

/**
 * Cost(n) = floor(BaseCost × 1.15^n)
 */
export function calculateUpgradeCost(baseCost: number, level: number): number {
  return Math.floor(baseCost * Math.pow(COST_MULTIPLIER, level))
}

/**
 * Cost(n) = floor(BaseCost × 1.15^count)
 */
export function calculateWorkerCost(baseCost: number, count: number): number {
  return Math.floor(baseCost * Math.pow(COST_MULTIPLIER, count))
}
```

**Step 2: Verify**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add garage-2007-frontend/src/store/formulas/costs.ts
git commit -m "refactor: add src/store/formulas/costs.ts"
```

---

### Task 13: Create src/store/formulas/income.ts

**Files:**
- Create: `garage-2007-frontend/src/store/formulas/income.ts`

**Step 1: Create the file**

```typescript
// src/store/formulas/income.ts
import { WORKER_INCOME, WORK_SPEED_BONUS_PER_LEVEL } from '../constants/economy'
import { roundCurrency } from '../../utils/math'

/** Income(n) = n + 1 (GBD v1.1 упрощённая формула) */
export function calculateClickIncome(level: number): number {
  return level + 1
}

/** Multiplier = 1.0 + level × 0.1 */
export function calculateWorkSpeedMultiplier(level: number): number {
  return 1.0 + level * WORK_SPEED_BONUS_PER_LEVEL
}

/**
 * BasePassive = Σ(count × income)
 * Total = BasePassive × WorkSpeedMultiplier
 */
export function calculateTotalPassiveIncome(
  workers: Record<string, { count: number }>,
  workSpeedLevel: number,
): number {
  let base = 0
  for (const [type, data] of Object.entries(workers)) {
    base += data.count * (WORKER_INCOME[type as keyof typeof WORKER_INCOME] ?? 0)
  }
  return roundCurrency(base * calculateWorkSpeedMultiplier(workSpeedLevel))
}
```

**Step 2: Verify**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add garage-2007-frontend/src/store/formulas/income.ts
git commit -m "refactor: add src/store/formulas/income.ts"
```

---

### Task 14: Create src/store/formulas/progression.ts

**Files:**
- Create: `garage-2007-frontend/src/store/formulas/progression.ts`

**Step 1: Create the file**

```typescript
// src/store/formulas/progression.ts
import { GARAGE_LEVEL_THRESHOLDS, MILESTONE_LEVELS } from '../constants/garageLevels'
import type { WorkerType } from '../types'

const WORKER_UNLOCK_LEVELS: Record<WorkerType, number | null> = {
  apprentice: null,
  mechanic:   5,
  master:     10,
  brigadier:  15,
  director:   20,
}

export function isWorkerUnlocked(workerType: WorkerType, purchasedMilestones: number[]): boolean {
  const required = WORKER_UNLOCK_LEVELS[workerType]
  if (required === null) return true
  return purchasedMilestones.includes(required)
}

/**
 * Автоматический левелинг гаража по балансу.
 * Останавливается перед непокупленными milestone (5/10/15/20).
 */
export function checkAutoLevel(
  balance: number,
  currentLevel: number,
  milestonesPurchased: number[],
): number {
  let level = currentLevel
  while (level < 20) {
    const next = level + 1
    const threshold = GARAGE_LEVEL_THRESHOLDS[next]
    if (threshold === undefined || balance < threshold) break
    if (
      (MILESTONE_LEVELS as readonly number[]).includes(next) &&
      !milestonesPurchased.includes(next)
    ) break
    level = next
  }
  return level
}

/** Форматирование больших чисел для UI. */
export function formatLargeNumber(num: number): string {
  if (num >= 1e15) return `${(num / 1e15).toFixed(1)}Q`
  if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`
  if (num >= 1e9)  return `${(num / 1e9).toFixed(1)}B`
  if (num >= 1e6)  return `${(num / 1e6).toFixed(1)}M`
  if (num >= 1e3)  return `${(num / 1e3).toFixed(1)}K`
  return num.toLocaleString()
}
```

**Step 2: Verify**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add garage-2007-frontend/src/store/formulas/progression.ts
git commit -m "refactor: add src/store/formulas/progression.ts"
```

---

### Task 15: Create src/store/initialState.ts

**Files:**
- Create: `garage-2007-frontend/src/store/initialState.ts`

This file is needed by `persistenceActions.ts` and the thin `gameStore.ts`.

**Step 1: Create the file**

```typescript
// src/store/initialState.ts
import { BASE_COSTS } from './constants/economy'
import { ACHIEVEMENTS } from './constants/achievements'
import type { GameState, AchievementId, PlayerAchievement } from './types'

export const initialState: GameState = {
  balance: 0,
  clickValue: 1,
  totalClicks: 0,
  garageLevel: 1,
  passiveIncomePerSecond: 0,

  upgrades: {
    clickPower: { level: 0, cost: BASE_COSTS.clickUpgrade, baseCost: BASE_COSTS.clickUpgrade },
    workSpeed:  { level: 0, cost: BASE_COSTS.workSpeed,    baseCost: BASE_COSTS.workSpeed    },
  },

  milestonesPurchased: [],
  showMilestoneModal: false,
  pendingMilestoneLevel: null,
  dismissedMilestoneLevel: null,

  workers: {
    apprentice: { count: 0, cost: BASE_COSTS.apprentice },
    mechanic:   { count: 0, cost: BASE_COSTS.mechanic   },
    master:     { count: 0, cost: BASE_COSTS.master      },
    brigadier:  { count: 0, cost: BASE_COSTS.brigadier  },
    director:   { count: 0, cost: BASE_COSTS.director   },
  },

  nuts: 0,
  totalEarned: 0,
  sessionCount: 0,
  lastSessionDate: new Date().toISOString(),
  isLoaded: false,

  lastOfflineEarnings: 0,
  lastOfflineTimeAway: 0,

  momentaryClickIncome: 0,
  _clickIncomeThisTick: 0,

  peakClickIncome: 0,
  totalPlayTimeSeconds: 0,
  bestStreak: 0,

  achievements: Object.keys(ACHIEVEMENTS).reduce((acc, id) => {
    acc[id as AchievementId] = { unlocked: false, claimed: false }
    return acc
  }, {} as Record<AchievementId, PlayerAchievement>),
  hasNewAchievements: false,

  dailyRewards: { lastClaimTimestamp: 0, currentStreak: 0 },
  showDailyRewardsModal: false,

  rewardedVideo: { lastWatchedTimestamp: 0, totalWatches: 0, isWatching: false },
}
```

**Step 2: Verify**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add garage-2007-frontend/src/store/initialState.ts
git commit -m "refactor: add src/store/initialState.ts"
```

---

### Task 16: Create action slices (clickActions through rewardedVideoActions)

**Files:**
- Create: `garage-2007-frontend/src/store/actions/clickActions.ts`
- Create: `garage-2007-frontend/src/store/actions/upgradeActions.ts`
- Create: `garage-2007-frontend/src/store/actions/workerActions.ts`
- Create: `garage-2007-frontend/src/store/actions/milestoneActions.ts`
- Create: `garage-2007-frontend/src/store/actions/achievementActions.ts`
- Create: `garage-2007-frontend/src/store/actions/dailyRewardActions.ts`
- Create: `garage-2007-frontend/src/store/actions/rewardedVideoActions.ts`

**Step 1: Create clickActions.ts**

```typescript
// src/store/actions/clickActions.ts
import type { StateCreator } from 'zustand'
import type { GameStore, GameState } from '../types'
import { CRITICAL_CLICK_CHANCE, CRITICAL_CLICK_MULTIPLIER } from '../constants/economy'
import { checkAutoLevel } from '../formulas/progression'

type Slice = Pick<GameStore, 'handleClick'>

export const createClickSlice: StateCreator<GameStore, [], [], Slice> = (_set, get) => ({
  handleClick: () => {
    const { clickValue, garageLevel: prevLevel } = get()
    const isCritical = Math.random() < CRITICAL_CLICK_CHANCE
    const income = isCritical ? clickValue * CRITICAL_CLICK_MULTIPLIER : clickValue

    _set((state: GameState) => {
      const newBalance = state.balance + income
      const newLevel = checkAutoLevel(newBalance, state.garageLevel, state.milestonesPurchased)
      const result: Partial<GameState> = {
        balance: newBalance,
        totalClicks: state.totalClicks + 1,
        totalEarned: state.totalEarned + income,
        _clickIncomeThisTick: state._clickIncomeThisTick + income,
      }
      if (newLevel !== state.garageLevel) result.garageLevel = newLevel
      return result
    })

    get().checkForMilestone()
    if (get().garageLevel !== prevLevel) get().saveProgress()
    get().checkAchievements()
    return isCritical
  },
})
```

**Step 2: Create upgradeActions.ts**

```typescript
// src/store/actions/upgradeActions.ts
import type { StateCreator } from 'zustand'
import type { GameStore, GameState } from '../types'
import { BASE_COSTS, CLICK_UPGRADE_MAX_LEVEL } from '../constants/economy'
import { calculateUpgradeCost } from '../formulas/costs'
import { calculateClickIncome, calculateTotalPassiveIncome } from '../formulas/income'
import { formatLargeNumber } from '../formulas/progression'

type Slice = Pick<GameStore, 'purchaseClickUpgrade' | 'purchaseWorkSpeedUpgrade'>

export const createUpgradeSlice: StateCreator<GameStore, [], [], Slice> = (_set, get) => ({
  purchaseClickUpgrade: () => {
    const { balance, upgrades } = get()
    const { clickPower } = upgrades
    if (clickPower.level >= CLICK_UPGRADE_MAX_LEVEL) {
      console.warn(`[ClickUpgrade] Максимальный уровень: ${CLICK_UPGRADE_MAX_LEVEL}`)
      return false
    }
    if (balance < clickPower.cost) {
      console.warn(`[ClickUpgrade] Недостаточно средств: нужно ${formatLargeNumber(clickPower.cost)} ₽`)
      return false
    }
    const newLevel = clickPower.level + 1
    _set((s: GameState) => ({
      balance: s.balance - clickPower.cost,
      clickValue: calculateClickIncome(newLevel),
      upgrades: {
        ...s.upgrades,
        clickPower: { ...s.upgrades.clickPower, level: newLevel, cost: calculateUpgradeCost(BASE_COSTS.clickUpgrade, newLevel) },
      },
    }))
    get().saveProgress()
    return true
  },

  purchaseWorkSpeedUpgrade: () => {
    const state = get()
    const { workSpeed } = state.upgrades
    if (!state.milestonesPurchased.includes(5)) {
      console.warn('[Purchase] 🔒 Апгрейд скорости не разблокирован (milestone 5)')
      return
    }
    if (state.balance < workSpeed.cost) {
      console.warn(`[Purchase] 💰 Недостаточно средств: нужно ${formatLargeNumber(workSpeed.cost)}₽`)
      return
    }
    const newLevel = workSpeed.level + 1
    _set((s: GameState) => ({
      balance: s.balance - workSpeed.cost,
      passiveIncomePerSecond: calculateTotalPassiveIncome(s.workers, newLevel),
      upgrades: {
        ...s.upgrades,
        workSpeed: { ...s.upgrades.workSpeed, level: newLevel, cost: calculateUpgradeCost(BASE_COSTS.workSpeed, newLevel) },
      },
    }))
    get().saveProgress()
  },
})
```

**Step 3: Create workerActions.ts**

```typescript
// src/store/actions/workerActions.ts
import type { StateCreator } from 'zustand'
import type { GameStore, GameState, WorkerType } from '../types'
import { BASE_COSTS, WORKER_LIMITS } from '../constants/economy'
import { calculateWorkerCost } from '../formulas/costs'
import { calculateTotalPassiveIncome } from '../formulas/income'
import { formatLargeNumber } from '../formulas/progression'

type Slice = Pick<GameStore, 'hireWorker'>

export const createWorkerSlice: StateCreator<GameStore, [], [], Slice> = (_set, get) => ({
  hireWorker: (workerType: WorkerType) => {
    const state = get()
    const worker = state.workers[workerType]
    const limit = WORKER_LIMITS[workerType]

    if (worker.count >= limit) {
      console.warn(`[Hire] 🚫 Лимит для ${workerType}: ${worker.count}/${limit}`)
      return
    }

    const requiredMilestone: Record<WorkerType, number> = {
      apprentice: 0, mechanic: 5, master: 10, brigadier: 15, director: 20,
    }
    const milestone = requiredMilestone[workerType]
    if (milestone > 0 && !state.milestonesPurchased.includes(milestone)) {
      console.warn(`[Hire] 🔒 ${workerType} не разблокирован (milestone ${milestone})`)
      return
    }

    if (state.balance < worker.cost) {
      console.warn(`[Hire] 💰 Недостаточно средств для ${workerType}: нужно ${formatLargeNumber(worker.cost)}₽`)
      return
    }

    const newCount = worker.count + 1
    const newCost = calculateWorkerCost(BASE_COSTS[workerType as keyof typeof BASE_COSTS] as number, newCount)
    const workersAfter = { ...state.workers, [workerType]: { count: newCount, cost: newCost } }
    const newPassive = calculateTotalPassiveIncome(workersAfter, state.upgrades.workSpeed.level)

    _set((s: GameState) => ({
      balance: s.balance - worker.cost,
      passiveIncomePerSecond: newPassive,
      workers: { ...s.workers, [workerType]: { count: newCount, cost: newCost } },
    }))

    get().saveProgress()
    get().checkAchievements()
  },
})
```

**Step 4: Create milestoneActions.ts**

```typescript
// src/store/actions/milestoneActions.ts
import type { StateCreator } from 'zustand'
import type { GameStore, GameState } from '../types'
import { MILESTONE_LEVELS, MILESTONE_UPGRADES, GARAGE_LEVEL_THRESHOLDS } from '../constants/garageLevels'
import type { MilestoneLevel } from '../constants/garageLevels'
import { checkAutoLevel } from '../formulas/progression'

type Slice = Pick<GameStore, 'purchaseMilestone' | 'checkForMilestone' | 'closeMilestoneModal'>

export const createMilestoneSlice: StateCreator<GameStore, [], [], Slice> = (_set, get) => ({
  purchaseMilestone: (level: number) => {
    const { balance, milestonesPurchased } = get()
    const upgrade = MILESTONE_UPGRADES[level as MilestoneLevel]
    if (!upgrade) { console.warn(`[Milestone] Неизвестный уровень: ${level}`); return false }
    if (milestonesPurchased.includes(level)) { console.warn(`[Milestone] Уровень ${level} уже куплен`); return false }
    if (balance < upgrade.cost) { console.warn(`[Milestone] Недостаточно средств`); return false }

    _set((s: GameState) => {
      const newBalance = s.balance - upgrade.cost
      const newPurchased = [...s.milestonesPurchased, level]
      const baseLevel = Math.max(s.garageLevel, level)
      return {
        balance: newBalance,
        milestonesPurchased: newPurchased,
        garageLevel: checkAutoLevel(newBalance, baseLevel, newPurchased),
        showMilestoneModal: false,
        pendingMilestoneLevel: null,
        dismissedMilestoneLevel: null,
      }
    })

    get().saveProgress()
    get().checkAchievements()
    return true
  },

  checkForMilestone: () => {
    const state = get()
    if (state.showMilestoneModal) return
    for (const level of MILESTONE_LEVELS) {
      if (!state.milestonesPurchased.includes(level)) {
        if (state.dismissedMilestoneLevel === level) return
        const threshold = GARAGE_LEVEL_THRESHOLDS[level]
        if (threshold !== undefined && state.balance >= threshold) {
          _set({ showMilestoneModal: true, pendingMilestoneLevel: level })
        }
        return
      }
    }
  },

  closeMilestoneModal: () => {
    _set((s: GameState) => ({
      showMilestoneModal: false,
      dismissedMilestoneLevel: s.pendingMilestoneLevel,
      pendingMilestoneLevel: null,
    }))
  },
})
```

**Step 5: Create achievementActions.ts**

```typescript
// src/store/actions/achievementActions.ts
import type { StateCreator } from 'zustand'
import type { GameStore, GameState, AchievementId } from '../types'
import { ACHIEVEMENTS } from '../constants/achievements'

type Slice = Pick<GameStore, 'checkAchievements' | 'claimAchievement' | 'clearNewAchievementsFlag'>

export const createAchievementSlice: StateCreator<GameStore, [], [], Slice> = (_set, get) => ({
  checkAchievements: () => {
    const state = get()
    const newlyUnlocked: AchievementId[] = []

    for (const [id, def] of Object.entries(ACHIEVEMENTS)) {
      const aid = id as AchievementId
      if (state.achievements[aid].unlocked) continue
      if (def.progressGetter(state) >= def.targetValue) {
        newlyUnlocked.push(aid)
        console.log(`[Achievement] 🏆 Разблокировано: "${def.title}"`)
      }
    }

    if (newlyUnlocked.length > 0) {
      _set((s: GameState) => {
        const updated = { ...s.achievements }
        for (const id of newlyUnlocked) {
          updated[id] = { ...updated[id], unlocked: true, unlockedAt: Date.now() }
        }
        return { achievements: updated, hasNewAchievements: true }
      })
      get().saveProgress()
    }

    return newlyUnlocked
  },

  claimAchievement: (achievementId: AchievementId) => {
    const state = get()
    const playerAch = state.achievements[achievementId]
    const def = ACHIEVEMENTS[achievementId]
    if (!def) { console.error(`[Achievement] Неизвестное: ${achievementId}`); return false }
    if (!playerAch.unlocked) { console.warn(`[Achievement] Не разблокировано`); return false }
    if (playerAch.claimed)   { console.warn(`[Achievement] Уже забрано`); return false }

    _set((s: GameState) => ({
      nuts: s.nuts + def.nutsReward,
      achievements: { ...s.achievements, [achievementId]: { ...s.achievements[achievementId], claimed: true } },
    }))

    get().saveProgress()
    return true
  },

  clearNewAchievementsFlag: () => _set({ hasNewAchievements: false }),
})
```

**Step 6: Create dailyRewardActions.ts**

```typescript
// src/store/actions/dailyRewardActions.ts
import type { StateCreator } from 'zustand'
import type { GameStore, GameState } from '../types'
import { DAILY_REWARDS, DAILY_STREAK_GRACE_PERIOD_MS } from '../constants/dailyRewards'

type Slice = Pick<GameStore,
  'checkDailyReward' | 'claimDailyReward' | 'closeDailyRewardsModal' | 'openDailyRewardsModal'>

export const createDailyRewardSlice: StateCreator<GameStore, [], [], Slice> = (_set, get) => ({
  checkDailyReward: () => {
    const state = get()
    const now = Date.now()
    const elapsed = now - state.dailyRewards.lastClaimTimestamp

    if (state.dailyRewards.lastClaimTimestamp === 0) {
      _set({ showDailyRewardsModal: true })
      return
    }
    if (elapsed < DAILY_STREAK_GRACE_PERIOD_MS) {
      console.log('[Daily] Награда уже забрана сегодня')
      return
    }
    if (elapsed >= DAILY_STREAK_GRACE_PERIOD_MS * 2) {
      console.log('[Daily] Streak сброшен')
      _set({ dailyRewards: { lastClaimTimestamp: 0, currentStreak: 0 }, showDailyRewardsModal: true })
      return
    }
    _set({ showDailyRewardsModal: true })
  },

  claimDailyReward: () => {
    const state = get()
    const now = Date.now()
    if (
      state.dailyRewards.lastClaimTimestamp !== 0 &&
      now - state.dailyRewards.lastClaimTimestamp < DAILY_STREAK_GRACE_PERIOD_MS
    ) {
      const h = Math.ceil((DAILY_STREAK_GRACE_PERIOD_MS - (now - state.dailyRewards.lastClaimTimestamp)) / 3600000)
      console.warn(`[Daily] ⛔ Следующая через ${h} ч`)
      return
    }
    const reward = DAILY_REWARDS[state.dailyRewards.currentStreak % 7]
    const newStreak = state.dailyRewards.currentStreak + 1
    _set((s: GameState) => ({
      nuts: s.nuts + reward,
      dailyRewards: { lastClaimTimestamp: now, currentStreak: newStreak },
      bestStreak: Math.max(s.bestStreak, newStreak),
    }))
    get().saveProgress()
  },

  closeDailyRewardsModal: () => _set({ showDailyRewardsModal: false }),
  openDailyRewardsModal:  () => _set({ showDailyRewardsModal: true }),
})
```

**Step 7: Create rewardedVideoActions.ts**

```typescript
// src/store/actions/rewardedVideoActions.ts
import type { StateCreator } from 'zustand'
import type { GameStore, GameState } from '../types'
import {
  REWARDED_VIDEO_NUTS,
  REWARDED_VIDEO_COOLDOWN_MS,
  REWARDED_VIDEO_FAKE_DURATION_MS,
} from '../constants/dailyRewards'

type Slice = Pick<GameStore, 'canWatchRewardedVideo' | 'watchRewardedVideo'>

export const createRewardedVideoSlice: StateCreator<GameStore, [], [], Slice> = (_set, get) => ({
  canWatchRewardedVideo: () => {
    const { rewardedVideo } = get()
    return rewardedVideo.lastWatchedTimestamp === 0 ||
           Date.now() - rewardedVideo.lastWatchedTimestamp >= REWARDED_VIDEO_COOLDOWN_MS
  },

  watchRewardedVideo: async () => {
    const state = get()
    if (!state.canWatchRewardedVideo()) { console.warn('[RewardedVideo] Cooldown'); return false }
    if (state.rewardedVideo.isWatching) { console.warn('[RewardedVideo] Уже идёт'); return false }

    _set((s: GameState) => ({ rewardedVideo: { ...s.rewardedVideo, isWatching: true } }))
    await new Promise((resolve) => setTimeout(resolve, REWARDED_VIDEO_FAKE_DURATION_MS))

    const now = Date.now()
    _set((s: GameState) => ({
      nuts: s.nuts + REWARDED_VIDEO_NUTS,
      rewardedVideo: { lastWatchedTimestamp: now, totalWatches: s.rewardedVideo.totalWatches + 1, isWatching: false },
    }))
    get().saveProgress()
    return true
  },
})
```

**Step 8: Verify**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

Expected: no errors. (Old `gameStore.ts` still defines these — duplicates are OK at this stage since the new files aren't wired yet.)

**Step 9: Commit**

```bash
git add garage-2007-frontend/src/store/actions/
git commit -m "refactor: add all action slice files"
```

---

### Task 17: Create src/store/actions/persistenceActions.ts

**Files:**
- Create: `garage-2007-frontend/src/store/actions/persistenceActions.ts`

**Step 1: Create the file**

```typescript
// src/store/actions/persistenceActions.ts
import type { StateCreator } from 'zustand'
import type { GameStore, GameState, UpgradesState, WorkersState, AchievementId, PlayerAchievement } from '../types'
import { saveGameFull, loadGame, calculateOfflineEarnings, clearSave, SAVE_VERSION } from '../../utils/storageService'
import { roundCurrency } from '../../utils/math'
import { BASE_COSTS } from '../constants/economy'
import { ACHIEVEMENTS } from '../constants/achievements'
import { checkAutoLevel, formatLargeNumber } from '../formulas/progression'
import { calculateClickIncome, calculateTotalPassiveIncome } from '../formulas/income'
import { initialState } from '../initialState'
import { checkAutoLevel as _checkAutoLevel } from '../formulas/progression'

type Slice = Pick<GameStore,
  | 'saveProgress' | 'loadProgress' | 'addOfflineEarnings'
  | 'clearOfflineEarnings' | 'startPassiveIncome' | 'resetGame'>

export const createPersistenceSlice: StateCreator<GameStore, [], [], Slice> = (_set, get) => ({
  saveProgress: () => {
    const s = get()
    const ok = saveGameFull({
      version: SAVE_VERSION,
      timestamp: 0,
      playerData: {
        balance: s.balance,
        nuts: s.nuts,
        totalClicks: s.totalClicks,
        garageLevel: s.garageLevel,
        milestonesPurchased: s.milestonesPurchased,
      },
      upgrades: {
        clickPower: { level: s.upgrades.clickPower.level, cost: s.upgrades.clickPower.cost },
        workSpeed:  { level: s.upgrades.workSpeed.level,  cost: s.upgrades.workSpeed.cost  },
      },
      workers: {
        apprentice: { count: s.workers.apprentice.count, cost: s.workers.apprentice.cost },
        mechanic:   { count: s.workers.mechanic.count,   cost: s.workers.mechanic.cost   },
        master:     { count: s.workers.master.count,     cost: s.workers.master.cost     },
        brigadier:  { count: s.workers.brigadier.count,  cost: s.workers.brigadier.cost  },
        director:   { count: s.workers.director.count,   cost: s.workers.director.cost   },
      },
      stats: {
        totalEarned: s.totalEarned,
        sessionCount: s.sessionCount,
        lastSessionDate: s.lastSessionDate,
        peakClickIncome: s.peakClickIncome,
        totalPlayTimeSeconds: s.totalPlayTimeSeconds,
        bestStreak: s.bestStreak,
      },
      achievements: s.achievements as Record<string, { unlocked: boolean; claimed: boolean; unlockedAt?: number }>,
      dailyRewards: s.dailyRewards,
      rewardedVideo: {
        lastWatchedTimestamp: s.rewardedVideo.lastWatchedTimestamp,
        totalWatches: s.rewardedVideo.totalWatches,
      },
    })
    if (!ok) console.error('[Save] Ошибка сохранения')
  },

  loadProgress: () => {
    const saveData = loadGame()
    if (!saveData) {
      _set({ isLoaded: true, sessionCount: 1, lastSessionDate: new Date().toISOString() })
      return
    }

    const playerDataAny = saveData.playerData as unknown as Record<string, unknown>
    const restoredPurchased: number[] =
      Array.isArray(playerDataAny.milestonesPurchased)
        ? (playerDataAny.milestonesPurchased as number[])
        : []

    const mechanicSave = saveData.workers.mechanic
    const shouldResetMechanics = mechanicSave?.count > 0 && !restoredPurchased.includes(5)
    const savedWorkers = saveData.workers as unknown as Record<string, { count?: number; cost?: number }>
    const savedBrigadier = savedWorkers.brigadier ?? savedWorkers.foreman

    const restoredWorkers: WorkersState = {
      apprentice: { count: saveData.workers.apprentice.count, cost: saveData.workers.apprentice.cost },
      mechanic:   {
        count: shouldResetMechanics ? 0 : (mechanicSave?.count ?? 0),
        cost:  shouldResetMechanics ? BASE_COSTS.mechanic : (mechanicSave?.cost ?? BASE_COSTS.mechanic),
      },
      master:    { count: savedWorkers.master?.count    ?? 0, cost: savedWorkers.master?.cost    ?? BASE_COSTS.master    },
      brigadier: { count: savedBrigadier?.count         ?? 0, cost: savedBrigadier?.cost         ?? BASE_COSTS.brigadier },
      director:  { count: savedWorkers.director?.count  ?? 0, cost: savedWorkers.director?.cost  ?? BASE_COSTS.director  },
    }

    const restoredUpgrades: UpgradesState = {
      clickPower: { ...initialState.upgrades.clickPower, level: saveData.upgrades.clickPower.level, cost: saveData.upgrades.clickPower.cost },
      workSpeed:  { ...initialState.upgrades.workSpeed,  level: saveData.upgrades.workSpeed.level,  cost: saveData.upgrades.workSpeed.cost  },
    }

    const passiveIncome = calculateTotalPassiveIncome(restoredWorkers, restoredUpgrades.workSpeed.level)
    const offlineEarnings = calculateOfflineEarnings(passiveIncome, saveData.timestamp, 24)
    const now = Date.now()
    const offlineTimeAway = saveData.timestamp > 0 ? Math.floor((now - saveData.timestamp) / 1000) : 0

    const savedAchievements = (saveData.achievements ?? {}) as Record<string, PlayerAchievement>
    const restoredAchievements: Record<AchievementId, PlayerAchievement> = { ...initialState.achievements }
    for (const key of Object.keys(savedAchievements)) {
      if (key in restoredAchievements) restoredAchievements[key as AchievementId] = savedAchievements[key]
    }

    _set({
      balance: saveData.playerData.balance,
      nuts: saveData.playerData.nuts ?? 0,
      totalClicks: saveData.playerData.totalClicks,
      garageLevel: _checkAutoLevel(saveData.playerData.balance, 1, restoredPurchased),
      milestonesPurchased: restoredPurchased,
      clickValue: calculateClickIncome(restoredUpgrades.clickPower.level),
      upgrades: restoredUpgrades,
      workers: restoredWorkers,
      totalEarned: saveData.stats.totalEarned ?? 0,
      sessionCount: (saveData.stats.sessionCount ?? 0) + 1,
      lastSessionDate: new Date().toISOString(),
      passiveIncomePerSecond: passiveIncome,
      isLoaded: true,
      lastOfflineEarnings: offlineEarnings,
      lastOfflineTimeAway: offlineTimeAway,
      peakClickIncome: saveData.stats.peakClickIncome ?? 0,
      totalPlayTimeSeconds: saveData.stats.totalPlayTimeSeconds ?? 0,
      bestStreak: saveData.stats.bestStreak ?? 0,
      achievements: restoredAchievements,
      dailyRewards: saveData.dailyRewards ?? initialState.dailyRewards,
      rewardedVideo: saveData.rewardedVideo
        ? { ...initialState.rewardedVideo, ...saveData.rewardedVideo }
        : initialState.rewardedVideo,
    })

    get().checkForMilestone()
    get().checkAchievements()
    get().checkDailyReward()
  },

  addOfflineEarnings: (amount: number) => {
    _set((s: GameState) => {
      const newBalance = roundCurrency(s.balance + amount)
      const newLevel = checkAutoLevel(newBalance, s.garageLevel, s.milestonesPurchased)
      const result: Partial<GameState> = {
        balance: newBalance,
        totalEarned: roundCurrency(s.totalEarned + amount),
      }
      if (newLevel !== s.garageLevel) result.garageLevel = newLevel
      return result
    })
    get().checkForMilestone()
  },

  clearOfflineEarnings: () => _set({ lastOfflineEarnings: 0, lastOfflineTimeAway: 0 }),

  startPassiveIncome: () => {
    let tick = 0
    const id = setInterval(() => {
      tick++
      const { passiveIncomePerSecond, garageLevel: prevLevel } = get()
      _set((s: GameState) => {
        const result: Partial<GameState> = {
          momentaryClickIncome: s._clickIncomeThisTick,
          _clickIncomeThisTick: 0,
          peakClickIncome: Math.max(s.peakClickIncome, s._clickIncomeThisTick),
          totalPlayTimeSeconds: s.totalPlayTimeSeconds + 1,
        }
        if (passiveIncomePerSecond > 0) {
          const newBalance = roundCurrency(s.balance + passiveIncomePerSecond)
          const newLevel = checkAutoLevel(newBalance, s.garageLevel, s.milestonesPurchased)
          result.balance = newBalance
          result.totalEarned = roundCurrency(s.totalEarned + passiveIncomePerSecond)
          if (newLevel !== s.garageLevel) result.garageLevel = newLevel
        }
        return result
      })
      if (passiveIncomePerSecond > 0) get().checkForMilestone()
      if (get().garageLevel !== prevLevel) get().saveProgress()
      if (tick % 60 === 0) get().checkAchievements()
    }, 1000)
    return () => clearInterval(id)
  },

  resetGame: () => {
    clearSave()
    _set({ ...initialState, isLoaded: true })
  },
})
```

**Step 2: Verify**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add garage-2007-frontend/src/store/actions/persistenceActions.ts
git commit -m "refactor: add src/store/actions/persistenceActions.ts"
```

---

### Task 18: Create src/store/selectors.ts

**Files:**
- Create: `garage-2007-frontend/src/store/selectors.ts`

**Step 1: Create the file**

```typescript
// src/store/selectors.ts
// All useXxx() selector hooks. Imported by gameStore.ts and re-exported
// so components keep importing from '../store/gameStore'.
import { useShallow } from 'zustand/react/shallow'
import { useGameStore } from './gameStore'
import { GARAGE_LEVEL_THRESHOLDS, MILESTONE_LEVELS, MILESTONE_UPGRADES } from './constants/garageLevels'
import { calculateWorkSpeedMultiplier } from './formulas/income'

export const useBalance               = () => useGameStore((s) => s.balance)
export const useClickValue            = () => useGameStore((s) => s.clickValue)
export const useTotalClicks           = () => useGameStore((s) => s.totalClicks)
export const useGarageLevel           = () => useGameStore((s) => s.garageLevel)
export const usePassiveIncome         = () => useGameStore((s) => s.passiveIncomePerSecond)
export const useMomentaryClickIncome  = () => useGameStore((s) => s.momentaryClickIncome)
export const useUpgrades              = () => useGameStore((s) => s.upgrades)
export const useWorkers               = () => useGameStore((s) => s.workers)
export const useNuts                  = () => useGameStore((s) => s.nuts)
export const useTotalEarned           = () => useGameStore((s) => s.totalEarned)
export const useIsLoaded              = () => useGameStore((s) => s.isLoaded)
export const useSessionCount          = () => useGameStore((s) => s.sessionCount)
export const useLastOfflineEarnings   = () => useGameStore((s) => s.lastOfflineEarnings)
export const useLastOfflineTimeAway   = () => useGameStore((s) => s.lastOfflineTimeAway)
export const usePeakClickIncome       = () => useGameStore((s) => s.peakClickIncome)
export const useTotalPlayTime         = () => useGameStore((s) => s.totalPlayTimeSeconds)
export const useBestStreak            = () => useGameStore((s) => s.bestStreak)
export const useAchievements          = () => useGameStore((s) => s.achievements)
export const useHasNewAchievements    = () => useGameStore((s) => s.hasNewAchievements)
export const useClaimAchievement      = () => useGameStore((s) => s.claimAchievement)
export const useClearNewAchievementsFlag = () => useGameStore((s) => s.clearNewAchievementsFlag)
export const useRewardedVideo         = () => useGameStore((s) => s.rewardedVideo)
export const useCanWatchRewardedVideo = () => useGameStore((s) => s.canWatchRewardedVideo())
export const useWatchRewardedVideo    = () => useGameStore((s) => s.watchRewardedVideo)
export const useMilestonesPurchased   = () => useGameStore((s) => s.milestonesPurchased)
export const useShowMilestoneModal    = () => useGameStore((s) => s.showMilestoneModal)
export const usePendingMilestoneLevel = () => useGameStore((s) => s.pendingMilestoneLevel)
export const useCheckForMilestone     = () => useGameStore((s) => s.checkForMilestone)
export const usePurchaseMilestone     = () => useGameStore((s) => s.purchaseMilestone)
export const useCloseMilestoneModal   = () => useGameStore((s) => s.closeMilestoneModal)
export const usePurchaseWorkSpeedUpgrade = () => useGameStore((s) => s.purchaseWorkSpeedUpgrade)
export const useWorkSpeedLevel        = () => useGameStore((s) => s.upgrades.workSpeed.level)
export const useWorkSpeedMultiplier   = () => useGameStore((s) => calculateWorkSpeedMultiplier(s.upgrades.workSpeed.level))

export const useNextLevelCost = () =>
  useGameStore((s) => {
    if (s.garageLevel >= 20) return null
    return GARAGE_LEVEL_THRESHOLDS[s.garageLevel + 1] ?? null
  })

export const useGarageProgress = () =>
  useGameStore((s) => {
    if (s.garageLevel >= 20) return 1
    const next = GARAGE_LEVEL_THRESHOLDS[s.garageLevel + 1]
    if (!next) return 1
    const curr = GARAGE_LEVEL_THRESHOLDS[s.garageLevel] ?? 0
    const range = next - curr
    if (range <= 0) return 1
    return Math.min(Math.max((s.balance - curr) / range, 0), 1)
  })

export const usePendingMilestoneInfo = () =>
  useGameStore(
    useShallow((s) => {
      for (const level of MILESTONE_LEVELS) {
        if (!s.milestonesPurchased.includes(level)) {
          const threshold = GARAGE_LEVEL_THRESHOLDS[level]
          if (threshold !== undefined && s.balance >= threshold) {
            return { level, upgrade: MILESTONE_UPGRADES[level] }
          }
          return null
        }
      }
      return null
    })
  )
```

**Note:** `selectors.ts` imports from `./gameStore` which creates a circular-looking dependency. Vite/Node handles this fine because `gameStore` is imported for its `useGameStore` export, and by the time selectors run, the store is initialized. This is the standard pattern for Zustand selectors.

**Step 2: Verify**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add garage-2007-frontend/src/store/selectors.ts
git commit -m "refactor: add src/store/selectors.ts"
```

---

### Task 19: Replace gameStore.ts with thin assembler

This is the final, highest-impact step. The old ~2100-line file is replaced with a ~60-line assembler. All component imports from `'../store/gameStore'` continue to work via re-exports.

**Files:**
- Modify: `garage-2007-frontend/src/store/gameStore.ts`

**Step 1: Replace entire file content**

```typescript
// src/store/gameStore.ts
// Thin assembler: creates the Zustand store from slices and re-exports
// everything that components import from this path.
import { create } from 'zustand'
import type { GameStore } from './types'
import { initialState } from './initialState'
import { createClickSlice }         from './actions/clickActions'
import { createUpgradeSlice }       from './actions/upgradeActions'
import { createWorkerSlice }        from './actions/workerActions'
import { createMilestoneSlice }     from './actions/milestoneActions'
import { createAchievementSlice }   from './actions/achievementActions'
import { createDailyRewardSlice }   from './actions/dailyRewardActions'
import { createRewardedVideoSlice } from './actions/rewardedVideoActions'
import { createPersistenceSlice }   from './actions/persistenceActions'

export const useGameStore = create<GameStore>((...a) => ({
  ...initialState,
  ...createClickSlice(...a),
  ...createUpgradeSlice(...a),
  ...createWorkerSlice(...a),
  ...createMilestoneSlice(...a),
  ...createAchievementSlice(...a),
  ...createDailyRewardSlice(...a),
  ...createRewardedVideoSlice(...a),
  ...createPersistenceSlice(...a),
}))

// ── Re-exports so components keep importing from '../store/gameStore' ─────────
export * from './selectors'
export * from './types'
export * from './constants/economy'
export * from './constants/garageLevels'
export * from './constants/achievements'
export * from './constants/dailyRewards'
export * from './formulas/progression'
export * from './initialState'
```

**Step 2: Verify — this is the critical check**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

Expected: no errors. If errors appear, check which export is missing from the re-export list and add it.

**Step 3: Run lint**

```bash
cd garage-2007-frontend && npm run lint
```

**Step 4: Commit**

```bash
git add garage-2007-frontend/src/store/gameStore.ts
git commit -m "refactor: replace monolithic gameStore.ts with thin slice assembler"
```

---

### Task 20: Remove deprecated saveGame() from storageService.ts

**Files:**
- Modify: `garage-2007-frontend/src/utils/storageService.ts`

**Step 1: Remove the deprecated function and its entry in the default export**

Remove lines containing:
1. The `@deprecated` JSDoc block and `saveGame` function body (currently lines ~306–325)
2. The `saveGame,` entry from the default export object at the bottom

The default export object should become:
```typescript
const storageService = {
  saveGameFull,
  loadGame,
  clearSave,
  hasSave,
  getLastSaveTime,
  calculateOfflineEarnings,
} as const
```

**Step 2: Verify**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add garage-2007-frontend/src/utils/storageService.ts
git commit -m "refactor: remove deprecated saveGame() from storageService"
```

---

### Task 21: Final verification

**Step 1: Full type check**

```bash
cd garage-2007-frontend && npx tsc --noEmit
```

Expected: zero errors.

**Step 2: Lint**

```bash
cd garage-2007-frontend && npm run lint
```

**Step 3: Dev build smoke test**

```bash
cd garage-2007-frontend && npm run build 2>&1 | tail -20
```

Expected: build succeeds, no TypeScript errors.

**Step 4: Final commit**

```bash
git add -A
git commit -m "refactor: complete Phase 2 — gameStore split into slices (Problems 1-4 from REFACTORING_NEEDED.md)"
```
