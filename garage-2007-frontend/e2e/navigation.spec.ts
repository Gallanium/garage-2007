import { expect, test } from '@playwright/test'
import { waitForGameLoaded, switchTab, resetGameState } from './helpers'

test.describe('tab navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForGameLoaded(page)
  })

  test('switches to Upgrades tab', async ({ page }) => {
    await switchTab(page, 'Улучшения')

    // UpgradesPanel always shows the "МАГАЗИН" section heading and the
    // "Инструменты" upgrade card (unlocked from level 1) as well as
    // the "Посмотреть рекламу" rewarded-video card.
    await expect(page.getByText('МАГАЗИН', { exact: false })).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Инструменты', { exact: false })).toBeVisible({ timeout: 5_000 })
  })

  test('upgrades tab shows worker labour exchange section', async ({ page }) => {
    await switchTab(page, 'Улучшения')

    // UpgradesPanel renders a "БИРЖА ТРУДА" section heading and at least
    // the always-unlocked "Подмастерье" worker card.
    await expect(page.getByText('БИРЖА ТРУДА', { exact: false })).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Подмастерье', { exact: false })).toBeVisible({ timeout: 5_000 })
  })

  test('switches to Achievements tab', async ({ page }) => {
    await switchTab(page, 'Ачивки')

    // AchievementsPanel always shows the "Прогресс" label in the header
    // and the first achievement title "Первые шаги" (garage_level_2, always visible).
    await expect(page.getByText('Прогресс', { exact: false })).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Первые шаги', { exact: false })).toBeVisible({ timeout: 5_000 })
  })

  test('achievements tab shows к получению (nuts to claim) header', async ({ page }) => {
    await switchTab(page, 'Ачивки')

    // AchievementsPanel header always shows "К получению" label
    await expect(page.getByText('К получению', { exact: false })).toBeVisible({ timeout: 5_000 })
  })

  test('switches to Stats tab', async ({ page }) => {
    await switchTab(page, 'Статистика')

    // StatsPanel always renders these stat row labels
    await expect(page.getByText('Всего кликов', { exact: false })).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Заработано', { exact: false })).toBeVisible({ timeout: 5_000 })
  })

  test('stats tab shows garage level section', async ({ page }) => {
    await switchTab(page, 'Статистика')

    // StatsPanel renders an "Уровень гаража" label
    await expect(page.getByText('Уровень гаража', { exact: false })).toBeVisible({ timeout: 5_000 })
  })

  test('stats tab shows time in game and sessions', async ({ page }) => {
    await switchTab(page, 'Статистика')

    await expect(page.getByText('Время в игре', { exact: false })).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Сессий', { exact: false })).toBeVisible({ timeout: 5_000 })
  })

  test('switches back to Game tab', async ({ page }) => {
    await switchTab(page, 'Улучшения')
    await switchTab(page, 'Игра')

    // Back on game tab — canvas should be visible and interactable
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible()
  })

  test('canvas remains in DOM when switching tabs (visibility toggling)', async ({ page }) => {
    // The app uses visibility toggling rather than unmounting,
    // so the canvas stays attached to the DOM at all times.
    await switchTab(page, 'Улучшения')

    const canvas = page.locator('canvas')
    await expect(canvas).toBeAttached()
  })

  test('can cycle through all four tabs in sequence', async ({ page }) => {
    await switchTab(page, 'Улучшения')
    await expect(page.getByText('МАГАЗИН', { exact: false })).toBeVisible({ timeout: 5_000 })

    await switchTab(page, 'Ачивки')
    await expect(page.getByText('Прогресс', { exact: false })).toBeVisible({ timeout: 5_000 })

    await switchTab(page, 'Статистика')
    await expect(page.getByText('Всего кликов', { exact: false })).toBeVisible({ timeout: 5_000 })

    await switchTab(page, 'Игра')
    await expect(page.locator('canvas')).toBeVisible()
  })
})
