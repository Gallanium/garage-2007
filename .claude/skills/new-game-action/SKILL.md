---
name: new-game-action
description: Добавление нового game action — чеклист всех файлов (shared types, BE handler/validation, FE apiService/store action, тесты).
---

Этот скилл проведёт через добавление нового game action. Все 11 существующих action следуют одному паттерну — новый должен тоже.

## Входные данные

Спроси у пользователя:
1. **Название action** (snake_case для type, camelCase для handler). Пример: `buy_decoration` / `handleBuyDecoration`
2. **Что делает action** — краткое описание
3. **Влияет на баланс?** (да → нужен `idempotencyKey`, `balanceLog`, `checkIdempotencyInTx`)
4. **Нужны новые формулы/константы в shared/?** (да → какие)
5. **Нужен payload?** (да → какие поля, типы)

## Шаг 1: Разведка — изучи существующие паттерны

Прочитай эти файлы как образцы:

```
shared/types/actions.ts                              — типы action
garage-2007-backend/src/services/gameActionService.ts — switch-case dispatch
garage-2007-backend/src/services/actions/             — handler файлы (purchaseHandlers.ts как образец)
garage-2007-backend/src/validation/gameSchemas.ts     — Zod-схемы (actionSchema + per-action payload schemas)
garage-2007-backend/src/services/helpers/actionHelpers.ts — общие хелперы (checkIdempotencyInTx, parseEvents, etc.)
garage-2007-frontend/src/services/apiService.ts       — performAction()
garage-2007-frontend/src/store/actions/upgradeActions.ts — образец store slice (optimistic + rollback)
```

## Шаг 2: Shared-слой

### 2a. Тип action — `shared/types/actions.ts`

Добавь по паттерну:

```typescript
// 1. Payload interface
export interface <ActionName>Payload {
  <field>: <type>
}

// 2. Добавь в GameActionType union
export type GameActionType =
  | ... existing ...
  | '<action_snake_case>'

// 3. Добавь в GameActionPayload union
export type GameActionPayload =
  | ... existing ...
  | { type: '<action_snake_case>'; payload: <ActionName>Payload }
```

### 2b. Формулы/константы (если нужны)

- Формулы → `shared/formulas/<relevant>.ts`
- Константы → `shared/constants/<relevant>.ts`
- Сверь с GBD v1.1 (`docs/Garage_2007_GBD_v1_1.md`). Если отклонение — пометь `// DEVIATION FROM GBD: <reason>`

## Шаг 3: Backend

### 3a. Zod-схема — `garage-2007-backend/src/validation/gameSchemas.ts`

```typescript
// 1. Добавь per-action payload schema
export const <actionCamelCase>Payload = z.object({
  <field>: z.<type>(),
}).strict()

// 2. Добавь в actionSchema.type enum
type: z.enum([
  ...existing...,
  '<action_snake_case>',
]),
```

### 3b. Handler

Определи, в какой файл в `garage-2007-backend/src/services/actions/` добавить handler:
- Покупки → `purchaseHandlers.ts`
- Декорации → `decorationHandlers.ts`
- Бусты → `boostHandlers.ts`
- Награды → `rewardHandlers.ts`
- Или создай новый файл, если не подходит ни один

Паттерн handler'а:

```typescript
export async function handle<ActionName>(
  userId: number,
  payload: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<ActionResult> {
  return withOccRetry(() => prisma.$transaction(async (tx) => {
    // 1. Validate payload
    const validated = <payloadSchema>.parse(payload)

    // 2. Load game save
    const gs = gsToNumbers(await tx.gameSave.findUnique({ where: { userId } }))
    if (!gs) throw new AppError(404, 'NOT_FOUND', 'Game save not found')

    // 3. Check idempotency (if balance-affecting)
    await checkIdempotencyInTx(tx, idempotencyKey)

    // 4. Business logic validation
    // ... проверки баланса, лимитов, ownership ...

    // 5. Update game save
    const updated = await updateGameSaveWithLock(tx, userId, gs, { ... })

    // 6. Write balance log (if balance-affecting)
    await tx.balanceLog.create({
      data: {
        userId, actionType: '<action_snake_case>', currency: 'rubles',
        amount: -cost, balanceBefore: gs.balance, balanceAfter: newBalance,
        metadata: { ... }, idempotencyKey,
      },
    })

    // 7. Return result
    return {
      success: true,
      gameState: buildGameState(updated),
      actionResult: { ... },
    }
  }))
}
```

### 3c. Регистрация в dispatch — `gameActionService.ts`

```typescript
// 1. Import handler
import { handle<ActionName> } from './actions/<file>.js'

// 2. Add case in switch
case '<action_snake_case>': return handle<ActionName>(userId, payload, idempotencyKey)
```

### Защиты backend (проверь)

- [ ] userId из `req.user!.id` (уже обеспечено gameController), НЕ из payload
- [ ] Весь handler внутри `prisma.$transaction`
- [ ] Если balance-affecting → `checkIdempotencyInTx()` вызван
- [ ] Если balance-affecting → `balanceLog` записан
- [ ] Zod-схема использует `.strict()`
- [ ] `withOccRetry` обёртка для OCC retry

## Шаг 4: Frontend

### 4a. Store action

Создай или обнови slice в `garage-2007-frontend/src/store/actions/`. Паттерн:

```typescript
import type { StateCreator } from 'zustand'
import type { GameStore, GameState } from '../types'
import * as api from '../../services/apiService'

type Slice = Pick<GameStore, '<actionMethodName>'>

let _pending = false

export const create<ActionName>Slice: StateCreator<GameStore, [], [], Slice> = (_set, get) => ({
  <actionMethodName>: async (/* params */) => {
    if (_pending) return false
    _pending = true
    try {
      const state = get()

      // 1. Client-side validation
      // ...

      // 2. Online check
      if (!api.isOnline()) {
        console.warn('[<ActionName>] Cannot perform: not connected to server')
        return false
      }

      // 3. Rate limit check
      if (api.isActionThrottled()) {
        if (import.meta.env.DEV) console.warn('[<ActionName>] Client-side rate limit reached')
        return false
      }

      // 4. Flush pending clicks (if balance-affecting)
      if ((get()._pendingClickBuffer ?? []).length > 0) {
        const flushOk = await get().flushPendingClicks()
        if (!flushOk) {
          get().showToast('Ошибка синхронизации, попробуйте снова', 'error')
          return false
        }
      }

      // 5. Optimistic update + snapshot for rollback
      const snapshot = { /* relevant fields */ }
      _set((s: GameState) => ({ /* optimistic changes */ }))
      get().saveProgress()

      // 6. Server call
      const r = await api.performAction('<action_snake_case>', { /* payload */ })
      if (!r?.gameState) {
        _set(snapshot)  // rollback
        get().saveProgress()
        get().showToast('Ошибка ...', 'error')
        return false
      }

      // 7. Apply server state (server wins)
      get().applyServerState(r.gameState)
      return true
    } finally { _pending = false }
  },
})
```

### 4b. Регистрация slice

Если создан новый slice — зарегистрируй в `garage-2007-frontend/src/store/gameStore.ts`:

```typescript
import { create<ActionName>Slice } from './actions/<file>'

// В create<GameStore>:
...create<ActionName>Slice(...a),
```

И добавь тип в `store/types.ts`.

### 4c. Селектор (если нужен UI)

Добавь в `garage-2007-frontend/src/store/selectors.ts`:

```typescript
export const use<Something> = () => useGameStore(s => s.<field>)
```

## Шаг 5: Тесты

### Backend unit test

Добавь тест для handler'а в соответствующий файл `garage-2007-backend/tests/unit/` или `tests/integration/`.

Минимальный набор:
- Happy path: action выполняется успешно
- Insufficient balance (если balance-affecting)
- Idempotency: повторный запрос не дублирует эффект
- Invalid payload: Zod отклоняет невалидные данные

### Frontend unit test

Добавь тест для store action в `garage-2007-frontend/tests/`.

Минимальный набор:
- Happy path: action меняет стейт
- Rollback: при ошибке сервера стейт откатывается

## Шаг 6: Верификация

Запусти `/verify` для полной проверки.

После верификации — предложи пользователю: «Хотите запустить `/audit` для проверки нового action?»

## Напоминание

Если action затрагивает `shared/` — соблюдай конвенции скилла `/shared-change`:
- Не дублируй формулы в FE или BE
- Сверь с GBD v1.1
- Проверь потребителей
