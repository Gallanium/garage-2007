# Daily Reward Button Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a round floating button to the game canvas showing streak count and providing quick access to the daily rewards modal.

**Architecture:** New `DailyRewardButton` component placed absolutely in the canvas `<main>` of App.tsx. One new store action `openDailyRewardsModal`. The `canClaim` state is derived in App.tsx from `dailyRewards.lastClaimTimestamp`. CSS pulse-ring animation added to `index.css`.

**Tech Stack:** React, TypeScript, Zustand, Tailwind CSS, Press Start 2P font

**Design doc:** `docs/plans/2026-03-01-daily-reward-button-design.md`

---

### Task 1: Add CSS pulse-ring animation

**Files:**
- Modify: `src/index.css` (append after line 27)

**Step 1: Add the keyframe and utility class**

Append to the end of `src/index.css`:

```css
@keyframes pulse-ring {
  0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.6); }
  70% { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0); }
  100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
}
.animate-pulse-ring {
  animation: pulse-ring 2s ease-out infinite;
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: No errors (CSS-only change, no TS impact).

**Step 3: Commit**

```bash
git add src/index.css
git commit -m "style: add pulse-ring animation for daily reward button"
```

---

### Task 2: Add `openDailyRewardsModal` action to store

**Files:**
- Modify: `src/store/gameStore.ts`
  - Interface `GameActions` (~line 498, before closing `}`)
  - Implementation (after `closeDailyRewardsModal` action, ~line 1770)

**Step 1: Add type to GameActions interface**

In `src/store/gameStore.ts`, find the line:

```ts
  /** Закрыть модалку Daily Rewards (отложить) */
  closeDailyRewardsModal: () => void
}
```

Insert before the closing `}`:

```ts
  /** Открыть модалку Daily Rewards вручную (кнопка на экране) */
  openDailyRewardsModal: () => void
```

**Step 2: Add implementation**

Find the `closeDailyRewardsModal` implementation:

```ts
  closeDailyRewardsModal: () => {
    set({ showDailyRewardsModal: false })
  },
```

Add right after it:

```ts
  openDailyRewardsModal: () => {
    set({ showDailyRewardsModal: true })
  },
```

**Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/store/gameStore.ts
git commit -m "feat: add openDailyRewardsModal action to game store"
```

---

### Task 3: Create `DailyRewardButton` component

**Files:**
- Create: `src/components/DailyRewardButton.tsx`

**Step 1: Create the component file**

Create `src/components/DailyRewardButton.tsx` with this content:

```tsx
// ============================================
// КНОПКА ЕЖЕДНЕВНОЙ НАГРАДЫ (на игровом экране)
// ============================================

interface DailyRewardButtonProps {
  /** Текущая серия дней */
  streak: number
  /** Доступна ли награда для получения */
  canClaim: boolean
  /** Открыть модалку ежедневных наград */
  onClick: () => void
}

/**
 * Круглая кнопка в правом верхнем углу canvas-зоны.
 * Показывает стрик дней и сигнализирует о доступной награде.
 */
const DailyRewardButton: React.FC<DailyRewardButtonProps> = ({
  streak,
  canClaim,
  onClick,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        absolute top-3 right-3 z-20
        w-11 h-11 rounded-full
        flex flex-col items-center justify-center
        backdrop-blur-sm
        border-2
        transition-all duration-300
        active:scale-90 transform
        font-mono
        ${canClaim
          ? 'bg-amber-900/80 border-amber-400/50 shadow-lg shadow-amber-400/30 animate-pulse-ring'
          : 'bg-gray-800/80 border-gray-600/50'
        }
      `}
      aria-label={canClaim ? 'Забрать ежедневную награду' : 'Ежедневные награды'}
    >
      {/* Иконка огня */}
      <span className={`text-sm leading-none ${canClaim ? '' : 'grayscale opacity-50'}`}>
        🔥
      </span>

      {/* Число стрика */}
      <span className={`text-[7px] sm:text-[8px] font-bold leading-none mt-0.5 ${
        canClaim ? 'text-amber-300' : 'text-gray-500'
      }`}>
        {streak}
      </span>

      {/* Красный бейдж ! — только когда награда доступна */}
      {canClaim && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full
                         flex items-center justify-center
                         text-[7px] font-bold text-white
                         border border-red-400
                         animate-bounce">
          !
        </span>
      )}
    </button>
  )
}

export default DailyRewardButton
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/DailyRewardButton.tsx
git commit -m "feat: create DailyRewardButton component"
```

---

### Task 4: Integrate button into App.tsx

**Files:**
- Modify: `src/App.tsx`
  - Imports (~line 33)
  - Store selector for `openDailyRewardsModal` (~line 103)
  - Derived `canClaimToday` constant (after store selectors section)
  - Render inside `<main>` (between PhaserGame and click hint, ~line 324)

**Step 1: Add import**

In `src/App.tsx`, after line 33 (`import DailyRewardsModal from './components/DailyRewardsModal'`), add:

```tsx
import DailyRewardButton from './components/DailyRewardButton'
```

**Step 2: Add store selector for openDailyRewardsModal**

Find the line:
```tsx
  const closeDailyRewardsModal = useGameStore((s) => s.closeDailyRewardsModal)
```

Add right after it:
```tsx
  const openDailyRewardsModal = useGameStore((s) => s.openDailyRewardsModal)
```

**Step 3: Add canClaimToday derived constant**

Find the line:
```tsx
  // --- Ref для debounce сохранения при изменении данных ---
```

Insert BEFORE it:
```tsx
  // --- Вычисление доступности ежедневной награды ---
  const DAILY_CLAIM_INTERVAL_MS = 24 * 60 * 60 * 1000
  const canClaimToday = dailyRewards.lastClaimTimestamp === 0
    || (Date.now() - dailyRewards.lastClaimTimestamp) >= DAILY_CLAIM_INTERVAL_MS

```

**Step 4: Render button in canvas zone**

Find the click hint overlay in the game tab (inside `<main>`):

```tsx
            {/* Оверлей: подсказка клика */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2
```

Insert BEFORE it:

```tsx
            {/* Кнопка ежедневных наград */}
            <DailyRewardButton
              streak={dailyRewards.currentStreak}
              canClaim={canClaimToday}
              onClick={openDailyRewardsModal}
            />

```

**Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: integrate DailyRewardButton into game canvas"
```

---

### Task 5: Final verification

**Step 1: Full TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 2: Visual verification checklist**

- [ ] Button visible in top-right of canvas on Game tab
- [ ] Button hidden when switching to other tabs (Upgrades, Achievements, Stats)
- [ ] Shows 🔥 + streak number
- [ ] When canClaim=true: amber glow, pulsing ring, red `!` badge
- [ ] When canClaim=false: gray, no effects
- [ ] Clicking opens DailyRewardsModal
- [ ] After claiming reward, button switches to gray state
- [ ] Button does not overlap garage click area
