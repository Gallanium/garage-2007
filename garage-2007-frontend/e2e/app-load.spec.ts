import { expect, test } from '@playwright/test'
import { waitForGameLoaded, resetGameState } from './helpers'

test.describe('app load', () => {
  test.beforeEach(async ({ page }) => {
    await resetGameState(page)
  })

  test('app loads and game becomes ready', async ({ page }) => {
    await page.goto('/')
    await waitForGameLoaded(page)

    // isLoaded is true → main app renders (no loading screen)
    const loadingText = page.locator('text=Загрузка...')
    await expect(loadingText).not.toBeVisible()
  })

  test('game header is visible after load', async ({ page }) => {
    await page.goto('/')
    await waitForGameLoaded(page)

    // DEV overlay is always rendered in the bottom-right corner and shows balance/level info
    await expect(page.locator('text=DEV')).toBeVisible()
  })

  test('tab navigation is present with 4 tabs', async ({ page }) => {
    await page.goto('/')
    await waitForGameLoaded(page)

    // All 4 tab labels should be visible
    await expect(page.getByText('Игра', { exact: false })).toBeVisible()
    await expect(page.getByText('Улучшения', { exact: false })).toBeVisible()
    await expect(page.getByText('Ачивки', { exact: false })).toBeVisible()
    await expect(page.getByText('Статистика', { exact: false })).toBeVisible()
  })

  test('Phaser canvas is rendered', async ({ page }) => {
    await page.goto('/')
    await waitForGameLoaded(page)

    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible()

    // Canvas should have reasonable dimensions (game is 360x480)
    const box = await canvas.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThan(100)
    expect(box!.height).toBeGreaterThan(100)
  })
})
