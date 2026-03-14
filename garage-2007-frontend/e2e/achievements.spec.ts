import { expect, test } from '@playwright/test'
import { waitForGameLoaded, switchTab } from './helpers'

test.describe('achievements', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForGameLoaded(page)
  })

  test('achievements panel renders with progress section', async ({ page }) => {
    await switchTab(page, 'Ачивки')

    // AchievementsPanel header shows "Прогресс" and "К получению" labels
    await expect(page.getByText('Прогресс', { exact: false })).toBeVisible({ timeout: 3_000 })
    await expect(page.getByText('К получению', { exact: false })).toBeVisible({ timeout: 3_000 })
  })

  test('achievement "Первые шаги" is listed', async ({ page }) => {
    await switchTab(page, 'Ачивки')

    // AchievementCard renders title from ACHIEVEMENTS constant
    await expect(page.getByText('Первые шаги', { exact: false })).toBeVisible({ timeout: 3_000 })
  })

  test('achievement "Кликер-новичок" is listed', async ({ page }) => {
    await switchTab(page, 'Ачивки')

    await expect(page.getByText('Кликер-новичок', { exact: false })).toBeVisible({ timeout: 3_000 })
  })

  test('claim button "ЗАБРАТЬ" appears on unlocked unclaimed achievement', async ({ page }) => {
    // Inject unlocked+unclaimed state for garage_level_2 via store
    await page.evaluate(() => {
      const store = (window as any).__store
      if (!store) return
      const state = store.getState()
      store.setState({
        achievements: {
          ...state.achievements,
          garage_level_2: { unlocked: true, claimed: false },
        },
        hasNewAchievements: true,
      })
    })

    await switchTab(page, 'Ачивки')
    await page.waitForTimeout(300)

    // AchievementCard renders "ЗАБРАТЬ 🎁" button when unlocked and not yet claimed
    const claimBtn = page.getByRole('button', { name: /ЗАБРАТЬ/i }).first()
    await expect(claimBtn).toBeVisible({ timeout: 3_000 })
  })

  test('claiming an unlocked achievement awards nuts', async ({ page }) => {
    // Inject unlocked+unclaimed state
    await page.evaluate(() => {
      const store = (window as any).__store
      if (!store) return
      const state = store.getState()
      store.setState({
        achievements: {
          ...state.achievements,
          garage_level_2: { unlocked: true, claimed: false },
        },
      })
    })

    await switchTab(page, 'Ачивки')
    await page.waitForTimeout(300)

    const nutsBefore = await page.evaluate(() =>
      (window as any).__store?.getState().nuts ?? 0
    )

    // Click the claim button
    const claimBtn = page.getByRole('button', { name: /ЗАБРАТЬ/i }).first()
    await expect(claimBtn).toBeVisible({ timeout: 3_000 })
    await claimBtn.click()
    await page.waitForTimeout(300)

    const nutsAfter = await page.evaluate(() =>
      (window as any).__store?.getState().nuts ?? 0
    )
    expect(nutsAfter).toBeGreaterThan(nutsBefore)
  })

  test('claimed achievement shows "Забрано" text and checkmark', async ({ page }) => {
    // Inject already-claimed achievement
    await page.evaluate(() => {
      const store = (window as any).__store
      if (!store) return
      const state = store.getState()
      store.setState({
        achievements: {
          ...state.achievements,
          garage_level_2: { unlocked: true, claimed: true },
        },
      })
    })

    await switchTab(page, 'Ачивки')
    await page.waitForTimeout(300)

    // AchievementCard in claimed state shows "Забрано: {nutsReward} 🔩"
    await expect(page.getByText(/Забрано:/i)).toBeVisible({ timeout: 3_000 })
  })
})
