import { type Page } from '@playwright/test'

interface E2EWorkerState {
  count: number
  cost: number
}

interface E2EUpgradeState {
  level: number
  cost: number
}

interface E2EAchievementState {
  unlocked: boolean
  claimed: boolean
}

interface E2EDailyRewardsState {
  lastClaimTimestamp: number
  currentStreak: number
}

interface E2EStoreState {
  isLoaded: boolean
  balance: number
  nuts: number
  garageLevel: number
  totalClicks: number
  totalEarned: number
  sessionCount: number
  totalPlayTimeSeconds: number
  showDailyRewardsModal: boolean
  hasNewAchievements: boolean
  achievements: Record<string, E2EAchievementState>
  dailyRewards: E2EDailyRewardsState
  workers: Record<string, E2EWorkerState>
  upgrades: Record<string, E2EUpgradeState>
  saveProgress: () => void
  openDailyRewardsModal: () => void
  claimDailyReward: () => Promise<void> | void
}

type E2EStorePatch = Partial<Omit<
  E2EStoreState,
  'saveProgress' | 'openDailyRewardsModal' | 'claimDailyReward'
>>

/** Wait for the game to finish loading (loading screen disappears) */
export async function waitForGameLoaded(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      interface StoreWindow extends Window {
        __store?: { getState(): { isLoaded?: boolean } }
      }
      const currentWindow = window as StoreWindow
      const store = currentWindow.__store
      return store != null && store.getState().isLoaded === true
    },
    { timeout: 10_000 }
  )
}

/** Switch to a tab by its Russian label */
export async function switchTab(page: Page, label: string): Promise<void> {
  await page.getByText(label, { exact: false }).first().click()
  await page.waitForTimeout(300)
}

/** Get the current balance displayed in the header */
export async function getDisplayedBalance(page: Page): Promise<string> {
  // DEV overlay shows balance as "B: <value>"
  const devOverlay = page.locator('text=/B: /').first()
  const text = await devOverlay.textContent()
  return text?.replace('B: ', '').trim() ?? '0'
}

/** Click the Phaser canvas at center (game area) multiple times */
export async function clickGarage(page: Page, times = 1): Promise<void> {
  const canvas = page.locator('canvas').first()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas not found')
  for (let i = 0; i < times; i++) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await page.waitForTimeout(50)
  }
}

/** Read any serializable value from Zustand store by dot-separated path */
export async function getStoreValue<T>(page: Page, path: string, fallback: T): Promise<T> {
  return await page.evaluate(({ path: rawPath, fallback: rawFallback }) => {
    interface StoreWindow extends Window {
      __store?: { getState(): Record<string, unknown> }
    }

    const currentWindow = window as StoreWindow
    let current: unknown = currentWindow.__store?.getState()

    for (const segment of rawPath.split('.')) {
      if (!current || typeof current !== 'object') {
        return rawFallback as T
      }

      const record = current as Record<string, unknown>
      if (!(segment in record)) {
        return rawFallback as T
      }

      current = record[segment]
    }

    return (current as T | undefined) ?? rawFallback
  }, { path, fallback })
}

/** Patch top-level Zustand store state in DEV/E2E environment */
export async function patchStore(page: Page, partial: E2EStorePatch): Promise<void> {
  await page.evaluate((nextState) => {
    interface StoreWindow extends Window {
      __store?: { setState(patch: Record<string, unknown>): void }
    }

    const currentWindow = window as StoreWindow
    currentWindow.__store?.setState(nextState)
  }, partial)
}

/** Call a store action by name if it exists */
export async function callStoreAction(
  page: Page,
  actionName: 'saveProgress' | 'openDailyRewardsModal' | 'claimDailyReward',
): Promise<void> {
  await page.evaluate(async (name) => {
    interface StoreWindow extends Window {
      __store?: { getState(): Record<string, unknown> }
    }

    const currentWindow = window as StoreWindow
    const action = currentWindow.__store?.getState()[name]
    if (typeof action === 'function') {
      await Promise.resolve(action())
    }
  }, actionName)
}

/** Merge a single achievement into the store without using any */
export async function setAchievementState(
  page: Page,
  achievementId: string,
  nextAchievement: E2EAchievementState,
  hasNewAchievements?: boolean,
): Promise<void> {
  await page.evaluate(({ achievementId: nextAchievementId, nextAchievement: achievementState, hasNewAchievements: nextHasNewAchievements }) => {
    interface StoreWindow extends Window {
      __store?: {
        getState(): {
          achievements?: Record<string, { unlocked: boolean; claimed: boolean }>
        }
        setState(patch: Record<string, unknown>): void
      }
    }

    const currentWindow = window as StoreWindow
    const store = currentWindow.__store
    if (!store) return

    const state = store.getState()
    const patch: Record<string, unknown> = {
      achievements: {
        ...(state.achievements ?? {}),
        [nextAchievementId]: achievementState,
      },
    }

    if (typeof nextHasNewAchievements === 'boolean') {
      patch.hasNewAchievements = nextHasNewAchievements
    }

    store.setState(patch)
  }, { achievementId, nextAchievement, hasNewAchievements })
}

/** Inject balance via window.__store (DEV mode only) */
export async function injectBalance(page: Page, amount: number): Promise<void> {
  await patchStore(page, { balance: amount })
  await page.waitForTimeout(100)
}

/** Clear localStorage and reload the page */
export async function resetGameState(page: Page): Promise<void> {
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await waitForGameLoaded(page)
}
