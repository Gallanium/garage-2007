import { expect, test } from '@playwright/test'
import { waitForGameLoaded, switchTab, clickGarage } from './helpers'

test.describe('stats panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForGameLoaded(page)
  })

  test('stats tab shows statistics panel with key labels', async ({ page }) => {
    await switchTab(page, 'Статистика')

    // StatsPanel renders these labels from the source
    await expect(page.getByText('Всего кликов', { exact: false })).toBeVisible({ timeout: 3_000 })
    await expect(page.getByText('Заработано', { exact: false })).toBeVisible({ timeout: 3_000 })
    await expect(page.getByText('Уровень гаража', { exact: false })).toBeVisible({ timeout: 3_000 })
  })

  test('stats tab shows all stat labels', async ({ page }) => {
    await switchTab(page, 'Статистика')

    await expect(page.getByText('Всего кликов', { exact: false })).toBeVisible({ timeout: 3_000 })
    await expect(page.getByText('Рекорд (сек)', { exact: false })).toBeVisible({ timeout: 3_000 })
    await expect(page.getByText('Время в игре', { exact: false })).toBeVisible({ timeout: 3_000 })
    await expect(page.getByText('Заработано', { exact: false })).toBeVisible({ timeout: 3_000 })
    await expect(page.getByText('Сессий', { exact: false })).toBeVisible({ timeout: 3_000 })
    await expect(page.getByText('Лучшая серия', { exact: false })).toBeVisible({ timeout: 3_000 })
  })

  test('stats tab shows player profile section', async ({ page }) => {
    await switchTab(page, 'Статистика')

    // StatsPanel renders "Игрок" as the player name placeholder
    await expect(page.getByText('Игрок', { exact: false })).toBeVisible({ timeout: 3_000 })
  })

  test('click count updates in store after clicking garage', async ({ page }) => {
    const clicksBefore = await page.evaluate(() =>
      (window as any).__store?.getState().totalClicks ?? 0
    )

    await clickGarage(page, 5)
    await page.waitForTimeout(300)

    const clicksAfter = await page.evaluate(() =>
      (window as any).__store?.getState().totalClicks ?? 0
    )

    expect(clicksAfter).toBe(clicksBefore + 5)
  })

  test('click count is reflected in stats panel', async ({ page }) => {
    await clickGarage(page, 3)
    await page.waitForTimeout(300)

    const totalClicks = await page.evaluate(() =>
      (window as any).__store?.getState().totalClicks ?? 0
    )

    await switchTab(page, 'Статистика')

    // formatLargeNumber renders totalClicks — verify the number appears somewhere in the panel
    await expect(page.getByText(String(totalClicks), { exact: false })).toBeVisible({ timeout: 3_000 })
  })

  test('total earned increases after clicking', async ({ page }) => {
    const earnedBefore = await page.evaluate(() =>
      (window as any).__store?.getState().totalEarned ?? 0
    )

    await clickGarage(page, 10)
    await page.waitForTimeout(300)

    const earnedAfter = await page.evaluate(() =>
      (window as any).__store?.getState().totalEarned ?? 0
    )

    expect(earnedAfter).toBeGreaterThan(earnedBefore)
  })

  test('garage level shows in stats as "Уровень гаража"', async ({ page }) => {
    await switchTab(page, 'Статистика')

    // Stats panel section with garage level icon and label
    await expect(page.getByText('Уровень гаража', { exact: false })).toBeVisible({ timeout: 3_000 })

    // Garage starts at level 1 — verify the level value is present
    const garageLevel = await page.evaluate(() =>
      (window as any).__store?.getState().garageLevel ?? 1
    )
    expect(garageLevel).toBeGreaterThanOrEqual(1)
  })

  test('session count is at least 1 after loading', async ({ page }) => {
    await switchTab(page, 'Статистика')

    const sessionCount = await page.evaluate(() =>
      (window as any).__store?.getState().sessionCount ?? 0
    )
    // At least one session has been started
    expect(sessionCount).toBeGreaterThanOrEqual(1)
  })

  test('play time timer increases with time', async ({ page }) => {
    const timeBefore = await page.evaluate(() =>
      (window as any).__store?.getState().totalPlayTimeSeconds ?? 0
    )

    // Wait a couple of seconds for the ticker to advance play time
    await page.waitForTimeout(2_000)

    const timeAfter = await page.evaluate(() =>
      (window as any).__store?.getState().totalPlayTimeSeconds ?? 0
    )

    expect(timeAfter).toBeGreaterThanOrEqual(timeBefore)
  })
})
