# Visual Regression — Garage 2007

Набор скриншотов для визуальной регрессионной проверки. Запускать после крупных изменений UI.

## Предусловие
Dev-сервер запущен. Состояние: начальное (свежее сохранение).

## Скриншоты для сравнения

### 1. Начальный экран
- `browser_evaluate("localStorage.clear()")`
- `browser_navigate("http://localhost:5173")`
- `browser_wait_for("text=DEV")`
- `browser_resize(390, 844)` — iPhone 14 размер
- `browser_take_screenshot()` → `game-tab-initial.png`

### 2. Таб "Улучшения"
- `browser_click("Улучшения")`
- `browser_take_screenshot()` → `upgrades-tab-initial.png`

### 3. Таб "Ачивки"
- `browser_click("Ачивки")`
- `browser_take_screenshot()` → `achievements-tab-initial.png`

### 4. Таб "Статистика"
- `browser_click("Статистика")`
- `browser_take_screenshot()` → `stats-tab-initial.png`

### 5. Модалка ежедневных наград
- `browser_click("Игра")`
- `browser_evaluate("__store.getState().openDailyRewardsModal()")`
- `browser_wait_for("dialog")`
- `browser_take_screenshot()` → `daily-rewards-modal.png`
- `browser_evaluate("__store.getState().closeDailyRewardsModal()")`

### 6. Модалка буста (если доступна)
- `browser_evaluate("__store.setState({ nuts: 50 })")`
- Найти и кликнуть кнопку Boost (BoostButton в GameCanvas)
- `browser_take_screenshot()` → `boost-modal.png`

### 7. EventBanner (случайное событие)
- `browser_evaluate("__store.setState({ events: { activeEvent: { id: 'client_rush', activatedAt: Date.now(), expiresAt: Date.now() + 999999, eventSeed: 0 }, cooldownEnd: 0 } })")`
- `browser_wait_for("text=Наплыв клиентов")` или аналогичный текст события
- `browser_take_screenshot()` → `event-banner.png`

### 8. Desktop viewport (адаптивность)
- `browser_resize(1280, 800)`
- `browser_take_screenshot()` → `desktop-view.png`

### 9. Compact mobile viewport
- `browser_resize(360, 640)` — Android small
- `browser_take_screenshot()` → `mobile-small.png`

## Критерии прохождения
- [ ] Все скриншоты сделаны без ошибок браузера (console errors)
- [ ] Нет визуальных регрессий от предыдущей версии
- [ ] Адаптивность: нет горизонтального скролла на мобильных viewports
- [ ] Все модалки центрированы и не обрезаны
- [ ] Текст не выходит за пределы контейнеров
- [ ] Цветовая схема соответствует дизайну (темный фон, желтый акцент)
