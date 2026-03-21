import { expect, test } from '@playwright/test'
import {
  resetGameState,
  getStoreValue,
  callStoreAction,
} from './helpers'

test.describe('daily rewards', () => {
  test.beforeEach(async ({ page }) => {
    // Fresh state ensures lastClaimTimestamp === 0 (first visit)
    await resetGameState(page)
  })

  test('daily reward button is visible on game tab', async ({ page }) => {
    // DailyRewardButton renders in GameCanvas with aria-label
    // On fresh state canClaim=true → label "Забрать ежедневную награду"
    const dailyBtn = page.getByRole('button', { name: /ежедневн/i }).first()
    await expect(dailyBtn).toBeVisible({ timeout: 5_000 })
  })

  test('daily reward button shows fire emoji', async ({ page }) => {
    // DailyRewardButton always renders 🔥 span
    const dailyBtn = page.getByRole('button', { name: /ежедневн/i }).first()
    await expect(dailyBtn).toBeVisible({ timeout: 5_000 })
    await expect(dailyBtn).toContainText('🔥')
  })

  test('clicking daily reward button opens the modal', async ({ page }) => {
    // On first visit modal auto-opens via checkDailyReward; click button to confirm
    const dailyBtn = page.getByRole('button', { name: /ежедневн/i }).first()
    await expect(dailyBtn).toBeVisible({ timeout: 5_000 })
    await dailyBtn.click()
    await page.waitForTimeout(300)

    // DailyRewardsModal has role="dialog" and aria-label="Ежедневные награды"
    await expect(page.getByRole('dialog', { name: 'Ежедневные награды' })).toBeVisible({ timeout: 3_000 })
  })

  test('daily rewards modal shows title and 7 day cards', async ({ page }) => {
    // Open modal programmatically
    await callStoreAction(page, 'openDailyRewardsModal')
    await page.waitForTimeout(300)

    const modal = page.getByRole('dialog', { name: 'Ежедневные награды' })
    await expect(modal).toBeVisible({ timeout: 3_000 })

    // Modal title text
    await expect(modal.getByText('ЕЖЕДНЕВНАЯ НАГРАДА')).toBeVisible()

    // DayCard renders "Д{dayLabel}" — 7 cards total (Д1 through Д7)
    await expect(modal.getByText('Д1', { exact: false })).toBeVisible()
    await expect(modal.getByText('Д7', { exact: false })).toBeVisible()

    // Subtitle
    await expect(modal.getByText('Заходи каждый день!', { exact: false })).toBeVisible()
  })

  test('daily rewards modal can be closed', async ({ page }) => {
    await callStoreAction(page, 'openDailyRewardsModal')
    await page.waitForTimeout(300)

    const modal = page.getByRole('dialog', { name: 'Ежедневные награды' })
    await expect(modal).toBeVisible({ timeout: 3_000 })

    // Close button has aria-label="Закрыть"
    await page.getByRole('button', { name: 'Закрыть' }).click()
    await page.waitForTimeout(300)

    await expect(modal).not.toBeVisible()

    const isOpen = await getStoreValue(page, 'showDailyRewardsModal', false)
    expect(isOpen).toBe(false)
  })

  test('on first visit modal opens automatically', async ({ page }) => {
    // After resetGameState, lastClaimTimestamp === 0 → checkDailyReward opens modal
    const modalVisible = await getStoreValue(page, 'showDailyRewardsModal', false)
    expect(modalVisible).toBe(true)
  })

  test('claiming daily reward awards nuts', async ({ page }) => {
    const nutsBefore = await getStoreValue(page, 'nuts', 0)

    // Claim via store action directly
    await callStoreAction(page, 'claimDailyReward')
    await page.waitForTimeout(200)

    const nutsAfter = await getStoreValue(page, 'nuts', 0)
    expect(nutsAfter).toBeGreaterThan(nutsBefore)
  })

  test('claiming daily reward increases streak', async ({ page }) => {
    const streakBefore = await getStoreValue(page, 'dailyRewards.currentStreak', 0)

    await callStoreAction(page, 'claimDailyReward')
    await page.waitForTimeout(200)

    const streakAfter = await getStoreValue(page, 'dailyRewards.currentStreak', 0)
    expect(streakAfter).toBe(streakBefore + 1)
  })

  test('daily reward cannot be claimed twice in a row', async ({ page }) => {
    // First claim
    await callStoreAction(page, 'claimDailyReward')
    await page.waitForTimeout(100)

    const nutsAfterFirst = await getStoreValue(page, 'nuts', 0)

    // Immediate second claim — blocked because lastClaimTimestamp is now set
    await callStoreAction(page, 'claimDailyReward')
    await page.waitForTimeout(100)

    const nutsAfterSecond = await getStoreValue(page, 'nuts', 0)

    // Nuts must not increase on the second claim
    expect(nutsAfterSecond).toBe(nutsAfterFirst)
  })

  test('modal shows "Забрать" button when reward is available', async ({ page }) => {
    // Open modal — fresh state means canClaim=true
    await callStoreAction(page, 'openDailyRewardsModal')
    await page.waitForTimeout(300)

    const modal = page.getByRole('dialog', { name: 'Ежедневные награды' })
    await expect(modal).toBeVisible({ timeout: 3_000 })

    // Claim button text: "Забрать {reward} 🔩"
    await expect(modal.getByRole('button', { name: /Забрать.*🔩/i })).toBeVisible()
  })

  test('claiming via modal button awards nuts', async ({ page }) => {
    // Open modal
    await callStoreAction(page, 'openDailyRewardsModal')
    await page.waitForTimeout(300)

    const nutsBefore = await getStoreValue(page, 'nuts', 0)

    const modal = page.getByRole('dialog', { name: 'Ежедневные награды' })
    const claimBtn = modal.getByRole('button', { name: /Забрать.*🔩/i })
    await expect(claimBtn).toBeVisible({ timeout: 3_000 })
    await claimBtn.click()
    await page.waitForTimeout(300)

    const nutsAfter = await getStoreValue(page, 'nuts', 0)
    expect(nutsAfter).toBeGreaterThan(nutsBefore)
  })
})
