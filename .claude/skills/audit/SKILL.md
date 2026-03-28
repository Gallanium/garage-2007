---
name: audit
description: Систематический security/architecture/economy аудит проекта. Запускай по запросу или после завершения фичи/стейджа.
---

Проведи аудит проекта. Сначала уточни scope и глубину.

## Входные данные

Спроси у пользователя:
1. **Scope:** весь проект или конкретная область? (например «только purchase flow», «только leagues»)
2. **Глубина:** quick или full?

| Режим | Что проверяется |
|-------|----------------|
| **quick** | Type check обеих сторон + тесты + security spot-check (категории 1, 7) |
| **full** | Все 7 категорий полностью |

Если scope ограничен — проверяй все категории, но только файлы в указанной области.

## Категории проверок

Проверяй категории последовательно. Для каждой — выдай вердикт: **PASS**, **WARN** (с описанием), **FAIL** (с файлом и строкой).

### 1. Security

- [ ] Auth: `initData` верифицируется через HMAC-SHA256, не используется `initDataUnsafe`
- [ ] JWT: корректная проверка, `userId` берётся из auth context (`req.user!.id`), не из request body
- [ ] Validation: каждый endpoint использует Zod `.strict()`, unknown fields отклоняются
- [ ] Ownership: проверки на каждом user-bound read/write
- [ ] Injection: нет raw SQL, нет string concatenation в запросах к БД

```bash
# Проверь отсутствие raw SQL
cd garage-2007-backend && grep -rn '\$queryRaw\|\$executeRaw\|\.query(' src/ --include='*.ts' || echo "PASS: no raw SQL"
```

- [ ] Secrets: нет JWT/initData/webhook secrets в логах

```bash
cd garage-2007-backend && grep -rn 'initData\|WEBHOOK_SECRET\|JWT_SECRET\|BOT_TOKEN' src/ --include='*.ts' | grep -i 'log\|console' || echo "PASS: no secrets in logs"
```

- [ ] Rate limiting: на всех sensitive endpoints (auth, action, sync, purchase)
- [ ] CORS и body size limits включены

### 2. Architecture

- [ ] Server-authoritative: backend решает, frontend только оптимистичные обновления
- [ ] Layer violations: Phaser не импортирует Zustand store

```bash
cd garage-2007-frontend && grep -rn "from.*gameStore\|from.*store/" src/game/ --include='*.ts' || echo "PASS: no store imports in Phaser"
```

- [ ] Shared code: формулы/константы/типы в `shared/`, не дублированы отдельно в FE или BE
- [ ] localStorage: используется только через `storageService.ts`

```bash
cd garage-2007-frontend && grep -rn 'localStorage\.' src/ --include='*.ts' --include='*.tsx' | grep -v storageService || echo "PASS: no direct localStorage"
```

### 3. Economy

- [ ] Прочитай `docs/Garage_2007_GBD_v1_1.md` и сверь с `shared/formulas/` и `shared/constants/`
- [ ] Все отклонения помечены `// DEVIATION FROM GBD: reason`

```bash
cd shared && grep -rn 'DEVIATION FROM GBD' . --include='*.ts' || echo "INFO: no deviations marked"
```

- [ ] Нет отрицательных стоимостей, нет double-credit эксплойтов
- [ ] Offline earnings и progression когерентны между FE и BE

### 4. API Contracts

- [ ] FE request shapes (в `apiService.ts`) совпадают с BE Zod-схемами (в `validation/`)
- [ ] Response shapes стабильны — FE и BE используют одни типы из `shared/types/`
- [ ] HTTP status codes корректны (не 200 на ошибки)
- [ ] Auth/validation/not-found обрабатываются явно в controllers

### 5. Idempotency & Purchases

- [ ] Balance-affecting операции используют `idempotencyKey`
- [ ] `checkIdempotencyInTx()` вызывается в каждом balance-affecting handler
- [ ] Webhook processing идемпотентен (дублирующие webhook'и не дублируют кредит)
- [ ] Purchase status transitions безопасны (нет race conditions)
- [ ] Audit trail: `balanceLog` записывается для каждой balance-мутации

### 6. Database

- [ ] Prisma schema совместима с сервисами (после schema changes — проверить все queries)
- [ ] Unique constraints для idempotency на месте (`idempotencyKey` в `BalanceLog`)
- [ ] Runtime user без DDL privileges (в production)

### 7. Code Quality

- [ ] TypeScript strict, нет `any`

```bash
cd garage-2007-frontend && grep -rn ': any\b\|as any' src/ --include='*.ts' --include='*.tsx' | head -20
cd garage-2007-backend && grep -rn ': any\b\|as any' src/ --include='*.ts' | head -20
```

- [ ] `as const` вместо enums
- [ ] Timestamps (`activatedAt`/`expiresAt`) вместо countdowns
- [ ] Phaser: max 20 particles, cleanup в `shutdown()`
- [ ] Type check и тесты проходят

```bash
cd garage-2007-frontend && npx tsc --noEmit
cd garage-2007-backend && npx tsc --noEmit
cd garage-2007-frontend && npm run test
cd garage-2007-backend && npm run test
```

## Формат вывода

После всех проверок — выведи итоговую таблицу:

| Категория | Вердикт | Детали |
|-----------|---------|--------|
| Security | PASS/WARN/FAIL | ... |
| Architecture | PASS/WARN/FAIL | ... |
| Economy | PASS/WARN/FAIL | ... |
| API Contracts | PASS/WARN/FAIL | ... |
| Idempotency | PASS/WARN/FAIL | ... |
| Database | PASS/WARN/FAIL | ... |
| Code Quality | PASS/WARN/FAIL | ... |

Затем — приоритезированный список фиксов: FAIL сначала, потом WARN.
