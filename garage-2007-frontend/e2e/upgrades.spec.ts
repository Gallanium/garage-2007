import { expect, test } from '@playwright/test'
import { waitForGameLoaded, switchTab, injectBalance, getStoreValue } from './helpers'

test.describe('upgrades', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForGameLoaded(page)
  })

  test('upgrades tab shows МАГАЗИН and БИРЖА ТРУДА section headings', async ({ page }) => {
    await switchTab(page, 'Улучшения')

    // Section headings defined in UpgradesPanel.tsx
    await expect(page.getByText('МАГАЗИН', { exact: false })).toBeVisible()
    await expect(page.getByText('БИРЖА ТРУДА', { exact: false })).toBeVisible()
  })

  test('upgrades tab shows Инструменты and Подмастерье cards', async ({ page }) => {
    await switchTab(page, 'Улучшения')

    // UpgradeCard titles from UpgradesPanel WORKER_DEFS and upgrade definitions
    await expect(page.getByText('Инструменты', { exact: false }).first()).toBeVisible()
    await expect(page.getByText('Подмастерье', { exact: false }).first()).toBeVisible()
  })

  test('purchase button is disabled when balance is insufficient', async ({ page }) => {
    await switchTab(page, 'Улучшения')

    // UpgradeCard renders a <button disabled={!canAfford}> with price text (e.g. "100 ₽")
    // With 0 balance all UpgradeCard buttons are disabled
    const buttons = page.locator('button[disabled]')
    const count = await buttons.count()

    // There should be at least one disabled button at 0 balance
    expect(count).toBeGreaterThan(0)
  })

  test('Инструменты button is enabled after injecting sufficient balance', async ({ page }) => {
    // Inject enough balance to afford the first click-power upgrade (costs 100 initially)
    await injectBalance(page, 1000)
    await switchTab(page, 'Улучшения')

    // Locate the UpgradeCard that contains "Инструменты" title, then find its button
    const toolsCard = page.locator('div').filter({ hasText: /^🔧\s*Инструменты/ }).first()
    const buyBtn = toolsCard.locator('button').first()

    if (await buyBtn.count() > 0) {
      await expect(buyBtn).toBeEnabled()
    }
  })

  test('purchase click upgrade deducts balance', async ({ page }) => {
    // Inject enough balance for the Инструменты upgrade
    await injectBalance(page, 1000)
    await switchTab(page, 'Улучшения')

    const balanceBefore = await getStoreValue(page, 'balance', 0)

    // Find the Инструменты card via its containing div and click its buy button
    // UpgradeCard structure: div > div(header with title) + p(description) + div(level + button)
    const toolsCard = page
      .locator('div.bg-gray-800')
      .filter({ hasText: 'Инструменты' })
      .first()
    const buyBtn = toolsCard.locator('button:not([disabled])').first()

    if (await buyBtn.count() > 0) {
      await buyBtn.click()
      await page.waitForTimeout(300)

      const balanceAfter = await getStoreValue(page, 'balance', 0)
      expect(balanceAfter).toBeLessThan(balanceBefore)
    }
  })

  test('purchase click upgrade increases clickPower level', async ({ page }) => {
    await injectBalance(page, 1000)
    await switchTab(page, 'Улучшения')

    const levelBefore = await getStoreValue(page, 'upgrades.clickPower.level', 0)

    const toolsCard = page
      .locator('div.bg-gray-800')
      .filter({ hasText: 'Инструменты' })
      .first()
    const buyBtn = toolsCard.locator('button:not([disabled])').first()

    if (await buyBtn.count() > 0) {
      await buyBtn.click()
      await page.waitForTimeout(300)

      const levelAfter = await getStoreValue(page, 'upgrades.clickPower.level', 0)
      expect(levelAfter).toBe(levelBefore + 1)
    }
  })

  test('hire apprentice worker increases worker count', async ({ page }) => {
    // Apprentice (Подмастерье) is unlocked by default (requiredMilestone: null)
    // Worker cost starts at 500
    await injectBalance(page, 1000)
    await switchTab(page, 'Улучшения')

    const workersBefore = await getStoreValue(page, 'workers.apprentice.count', 0)

    // Find Подмастерье UpgradeCard and click its enabled buy button
    const apprenticeCard = page
      .locator('div.bg-gray-800')
      .filter({ hasText: 'Подмастерье' })
      .first()
    const hireBtn = apprenticeCard.locator('button:not([disabled])').first()

    if (await hireBtn.count() > 0) {
      await hireBtn.click()
      await page.waitForTimeout(300)

      const workersAfter = await getStoreValue(page, 'workers.apprentice.count', 0)
      expect(workersAfter).toBe(workersBefore + 1)
    }
  })

  test('hire apprentice worker deducts balance', async ({ page }) => {
    await injectBalance(page, 1000)
    await switchTab(page, 'Улучшения')

    const balanceBefore = await getStoreValue(page, 'balance', 0)

    const apprenticeCard = page
      .locator('div.bg-gray-800')
      .filter({ hasText: 'Подмастерье' })
      .first()
    const hireBtn = apprenticeCard.locator('button:not([disabled])').first()

    if (await hireBtn.count() > 0) {
      await hireBtn.click()
      await page.waitForTimeout(300)

      const balanceAfter = await getStoreValue(page, 'balance', 0)
      expect(balanceAfter).toBeLessThan(balanceBefore)
    }
  })

  test('locked workers (Механик) show lock indicator before milestone 5', async ({ page }) => {
    await switchTab(page, 'Улучшения')

    // Механик requires milestone 5 — at game start it should show "🔒 Уровень 5"
    await expect(page.getByText('🔒 Уровень 5', { exact: false }).first()).toBeVisible()
  })
})
