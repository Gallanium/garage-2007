import { expect, test } from '@playwright/test'
import {
  waitForGameLoaded,
  resetGameState,
  getStoreValue,
  patchStore,
  callStoreAction,
} from './helpers'

test.describe('persistence', () => {
  // resetGameState clears localStorage, reloads, and waits for game to load.
  // Each test navigates to '/' first so the page is open before resetGameState runs.
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await resetGameState(page)
  })

  test('fresh start has zero balance', async ({ page }) => {
    const balance = await getStoreValue(page, 'balance', -1)
    expect(balance).toBe(0)
  })

  test('balance persists across page reload', async ({ page }) => {
    // Set a specific balance and call saveProgress()
    await patchStore(page, { balance: 12345 })
    await callStoreAction(page, 'saveProgress')
    await page.waitForTimeout(200)

    // Verify the save key exists in localStorage
    const hasSave = await page.evaluate(() =>
      localStorage.getItem('garage2007_save_data') !== null
    )
    expect(hasSave).toBe(true)

    // Reload the page and wait for game to re-initialise
    await page.reload()
    await waitForGameLoaded(page)

    // Balance should be restored from the saved state
    const restoredBalance = await getStoreValue(page, 'balance', 0)
    expect(restoredBalance).toBe(12345)
  })

  test('garage level persists across page reload', async ({ page }) => {
    await patchStore(page, { garageLevel: 3 })
    await callStoreAction(page, 'saveProgress')
    await page.waitForTimeout(200)

    await page.reload()
    await waitForGameLoaded(page)

    const level = await getStoreValue(page, 'garageLevel', 1)
    expect(level).toBe(3)
  })

  test('totalClicks persists across page reload', async ({ page }) => {
    await patchStore(page, { totalClicks: 99 })
    await callStoreAction(page, 'saveProgress')
    await page.waitForTimeout(200)

    await page.reload()
    await waitForGameLoaded(page)

    const totalClicks = await getStoreValue(page, 'totalClicks', 0)
    expect(totalClicks).toBe(99)
  })

  test('worker counts persist across page reload', async ({ page }) => {
    const currentWorkers = await getStoreValue(page, 'workers', {
      apprentice: { count: 0, cost: 0 },
    })
    await patchStore(page, {
      workers: {
        ...currentWorkers,
        apprentice: { ...currentWorkers.apprentice, count: 3 },
      },
    })
    await callStoreAction(page, 'saveProgress')
    await page.waitForTimeout(200)

    await page.reload()
    await waitForGameLoaded(page)

    const apprenticeCount = await getStoreValue(page, 'workers.apprentice.count', 0)
    expect(apprenticeCount).toBe(3)
  })

  test('upgrade levels persist across page reload', async ({ page }) => {
    const currentUpgrades = await getStoreValue(page, 'upgrades', {
      clickPower: { level: 0, cost: 0 },
    })
    await patchStore(page, {
      upgrades: {
        ...currentUpgrades,
        clickPower: { ...currentUpgrades.clickPower, level: 5 },
      },
    })
    await callStoreAction(page, 'saveProgress')
    await page.waitForTimeout(200)

    await page.reload()
    await waitForGameLoaded(page)

    const clickPowerLevel = await getStoreValue(page, 'upgrades.clickPower.level', 0)
    expect(clickPowerLevel).toBe(5)
  })

  test('save is triggered on beforeunload', async ({ page }) => {
    // Set balance and navigate away (triggers beforeunload handler)
    await patchStore(page, { balance: 7777 })

    // Reload triggers beforeunload, which saves state
    await page.reload()
    await waitForGameLoaded(page)

    const restoredBalance = await getStoreValue(page, 'balance', 0)
    // beforeunload save should have persisted the balance
    expect(restoredBalance).toBe(7777)
  })

  test('clearing localStorage resets game to zero balance on reload', async ({ page }) => {
    // Inject and save some balance first
    await patchStore(page, { balance: 5000 })
    await callStoreAction(page, 'saveProgress')
    await page.waitForTimeout(200)

    // Now clear localStorage and reload
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await waitForGameLoaded(page)

    const balance = await getStoreValue(page, 'balance', -1)
    expect(balance).toBe(0)
  })
})
