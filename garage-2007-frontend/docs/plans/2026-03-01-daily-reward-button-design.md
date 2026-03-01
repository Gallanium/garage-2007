# Daily Reward Button - Design Document

## Summary

Add a round floating button to the game canvas area that shows the current daily streak and provides quick access to the daily rewards modal at any time.

## Requirements

- Round button in top-right corner of the canvas zone (game tab only)
- Shows fire emoji + current streak number
- Two visual states: reward available (bright, pulsing) vs claimed (gray, static)
- Red badge with `!` when unclaimed reward exists
- Opens the same `DailyRewardsModal` used at startup

## Architecture

```
App.tsx (game tab)
  <main> (canvas zone, position: relative)
    PhaserGame
    Click hint overlay (absolute bottom-4)
    DailyRewardButton (absolute top-3 right-3) <-- NEW
```

## Component: `DailyRewardButton.tsx`

**Props:**
- `streak: number` - current streak from `dailyRewards.currentStreak`
- `canClaim: boolean` - whether an unclaimed reward is available
- `onClick: () => void` - opens the modal

**Visual states:**

| State | Background | Border | Icon | Effects |
|-------|-----------|--------|------|---------|
| canClaim=true | bg-amber-900/80 | border-amber-400/50 | bright fire + number | pulsing ring, amber shadow, red `!` badge |
| canClaim=false | bg-gray-800/80 | border-gray-600/50 | gray fire + number | none |

**Size:** `w-11 h-11` (44x44px), `rounded-full`, `backdrop-blur-sm`

## Store change: `openDailyRewardsModal`

One new action in `gameStore.ts`:
```ts
openDailyRewardsModal: () => set({ showDailyRewardsModal: true }),
```

## canClaim derivation (in App.tsx)

```ts
const DAILY_CLAIM_INTERVAL_MS = 24 * 60 * 60 * 1000
const canClaimToday = dailyRewards.lastClaimTimestamp === 0
  || (Date.now() - dailyRewards.lastClaimTimestamp) >= DAILY_CLAIM_INTERVAL_MS
```

## Files affected

| File | Change |
|------|--------|
| `src/components/DailyRewardButton.tsx` | NEW component |
| `src/store/gameStore.ts` | +1 action `openDailyRewardsModal` |
| `src/App.tsx` | +import, +canClaim logic, +render button in game tab |
| `src/index.css` | +pulse-ring keyframe animation |
