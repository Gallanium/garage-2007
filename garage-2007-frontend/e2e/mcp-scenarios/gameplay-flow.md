# Gameplay Flow — Garage 2007

Проверка основного геймплея: клики, баланс, навигация.

## Предусловие
Smoke test пройден. Dev-сервер запущен.

## Шаги

1. **Открыть приложение (свежее состояние)**
   - `browser_evaluate("localStorage.clear()")`
   - `browser_navigate("http://localhost:5173")`
   - `browser_wait_for("text=DEV")`

2. **Зафиксировать начальный баланс**
   - `browser_snapshot()` или `browser_evaluate("__store.getState().balance")`
   - Ожидаемо: 0

3. **Кликнуть по гаражу 10 раз**
   - Найти canvas: `browser_snapshot()` → получить ref канваса
   - `browser_click(canvas, center)` × 10
   - `browser_evaluate("__store.getState().balance")` → должен быть ≥ 10

4. **Проверить обновление DEV overlay**
   - `browser_take_screenshot()`
   - DEV overlay должен показывать "B: 10" или более

5. **Переключить таб "Улучшения"**
   - `browser_click("Улучшения")`
   - `browser_snapshot()` — должны видеть карточки улучшений (МАГАЗИН, БИРЖА ТРУДА)

6. **Переключить таб "Ачивки"**
   - `browser_click("Ачивки")`
   - `browser_snapshot()` — список достижений

7. **Переключить таб "Статистика"**
   - `browser_click("Статистика")`
   - `browser_take_screenshot()` — статистика

8. **Вернуться на таб "Игра"**
   - `browser_click("Игра")`
   - `browser_snapshot()` — canvas снова виден

## Критерии прохождения
- [ ] 10 кликов → баланс ≥ 10
- [ ] DEV overlay обновляется
- [ ] Все табы переключаются без ошибок
- [ ] Canvas сохраняется при переключении табов
