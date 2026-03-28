---
name: verify
description: Полная проверка проекта — type-check, lint, тесты, build. Запускай после завершения задачи или перед коммитом.
---

Запусти последовательно все проверки проекта. При первой ошибке — остановись, покажи что сломано и предложи фикс.

## Шаги

1. **Type-check frontend:**
   ```bash
   cd garage-2007-frontend && npx tsc --noEmit
   ```

2. **Lint frontend:**
   ```bash
   cd garage-2007-frontend && npm run lint
   ```

3. **Unit tests frontend:**
   ```bash
   cd garage-2007-frontend && npm run test
   ```

4. **Type-check backend:**
   ```bash
   cd garage-2007-backend && npx tsc --noEmit
   ```

5. **Unit tests backend:**
   ```bash
   cd garage-2007-backend && npm run test
   ```

6. **Production build:**
   ```bash
   cd garage-2007-frontend && npm run build
   ```

## При ошибке

- Покажи полный вывод ошибки
- Объясни причину
- Предложи конкретный фикс
- НЕ продолжай к следующему шагу пока текущий не пройдёт
