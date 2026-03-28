---
name: deploy-check
description: Пред-deploy чеклист — полная проверка + git status + итог готовности к push
disable-model-invocation: true
---

Выполни полный пред-deploy чеклист. Результат — итог готовности к push.

## Шаги

1. **Запусти все проверки /verify:**
   - Type-check FE + BE
   - Lint FE
   - Unit tests FE + BE
   - Production build

2. **Проверь git:**
   ```bash
   git status --short
   git branch --show-current
   git log --oneline -3
   ```

3. **Проверь:**
   - Working tree чистый? (нет uncommitted changes)
   - На правильной ветке?
   - Последний коммит соответствует задаче?

## Итог

Выведи результат:

- ✅ **Готово к push** — все проверки пройдены, working tree чистый
- ❌ **Не готово** — перечисли что нужно исправить
