import { type Page } from '@playwright/test'

/** Wait for the game to finish loading (loading screen disappears) */
export async function waitForGameLoaded(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const store = (window as any).__store
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

/** Inject balance via window.__store (DEV mode only) */
export async function injectBalance(page: Page, amount: number): Promise<void> {
  await page.evaluate((bal) => {
    const store = (window as any).__store
    if (store) store.setState({ balance: bal })
  }, amount)
  await page.waitForTimeout(100)
}

/** Clear localStorage and reload the page */
export async function resetGameState(page: Page): Promise<void> {
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await waitForGameLoaded(page)
}
