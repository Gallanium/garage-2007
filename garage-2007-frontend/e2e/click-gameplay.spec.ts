import { expect, test } from '@playwright/test'
import { waitForGameLoaded, clickGarage, getStoreValue } from './helpers'

test.describe('click gameplay', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForGameLoaded(page)
  })

  test('clicking the game area increases balance', async ({ page }) => {
    // Get initial balance
    const initialBalance = await getStoreValue(page, 'balance', 0)

    await clickGarage(page, 5)
    await page.waitForTimeout(300)

    const newBalance = await getStoreValue(page, 'balance', 0)

    expect(newBalance).toBeGreaterThan(initialBalance)
  })

  test('multiple clicks accumulate balance', async ({ page }) => {
    await clickGarage(page, 10)
    await page.waitForTimeout(300)

    const balance = await getStoreValue(page, 'balance', 0)

    // clickValue starts at 1, so 10 clicks should yield at least 10 balance
    expect(balance).toBeGreaterThanOrEqual(10)
  })

  test('total clicks count updates', async ({ page }) => {
    const before = await getStoreValue(page, 'totalClicks', 0)

    await clickGarage(page, 3)
    await page.waitForTimeout(300)

    const after = await getStoreValue(page, 'totalClicks', 0)

    expect(after).toBe(before + 3)
  })

  test('click income is reflected by DEV overlay C value', async ({ page }) => {
    // DEV overlay shows "C: <clickIncome>"
    const overlayText = await page.locator('text=/C: /').first().textContent()
    const clickIncomeStr = overlayText?.replace('C: ', '').trim() ?? '0'
    const clickIncome = parseFloat(clickIncomeStr)

    // Default click income at level 0 upgrades is 1
    expect(clickIncome).toBeGreaterThanOrEqual(1)
  })
})
