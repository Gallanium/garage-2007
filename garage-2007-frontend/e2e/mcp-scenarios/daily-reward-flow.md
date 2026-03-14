# Daily Reward Flow — Garage 2007

Проверка системы ежедневных наград.

## Предусловие
Dev-сервер запущен.

## Шаги

1. **Открыть приложение (свежее состояние)**
   - `browser_evaluate("localStorage.clear()")`
   - `browser_navigate("http://localhost:5173")`
   - `browser_wait_for("text=DEV")`

2. **Найти кнопку ежедневной награды**
   - `browser_snapshot()` — найти кнопку с aria-label "Ежедневные награды"
   - Кнопка расположена в области canvas (GameCanvas overlay)
   - `browser_take_screenshot()` — визуальная проверка кнопки

3. **Открыть модалку ежедневных наград**
   - `browser_click("кнопка ежедневной награды")`
   - `browser_snapshot()` — должен появиться dialog с aria-label "Ежедневные награды"
   - `browser_take_screenshot()` — 7 кружочков дней, кнопка "Забрать"

4. **Забрать ежедневную награду**
   - `browser_evaluate("__store.getState().nuts")` → зафиксировать nuts до
   - Нажать кнопку "Забрать"
   - `browser_evaluate("__store.getState().nuts")` → должно увеличиться на 5 (день 1)
   - `browser_evaluate("__store.getState().dailyRewards.currentStreak")` → должно быть 1

5. **Проверить состояние после получения**
   - `browser_take_screenshot()` — кнопка должна изменить вид (уже забрана)
   - `browser_evaluate("__store.getState().dailyRewards.lastClaimTimestamp")` → ≠ 0

6. **Закрыть модалку**
   - Нажать кнопку закрытия (❌ или "Закрыть")
   - `browser_snapshot()` — модалка закрыта

## Критерии прохождения
- [ ] Кнопка ежедневной награды видима в game area
- [ ] Модалка открывается по клику
- [ ] 7 дней отображены в модалке
- [ ] Получение увеличивает nuts
- [ ] Кнопка меняет состояние после получения
- [ ] Streak = 1 после первого получения
