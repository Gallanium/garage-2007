# Backend Readiness — «Гараж 2007»

> Как проектировать фронтенд-фичи сейчас, чтобы бэкенд-интеграция была минимальной.

---

## Текущее состояние

Бэкенд отсутствует. Всё работает на localStorage. Планируемый стек: Node.js + Express + Prisma + PostgreSQL + Redis + Socket.io.

## Принцип: Абстрагирование persistence

Вся работа с хранилищем проходит через `storageService.ts`. При подключении бэкенда заменяется ТОЛЬКО этот файл (→ `apiService.ts`), store остаётся без изменений.

### Текущий flow
```
gameStore.saveProgress() → storageService.saveGameFull() → localStorage.setItem()
gameStore.loadProgress() → storageService.loadGame() → localStorage.getItem()
```

### Будущий flow
```
gameStore.saveProgress() → apiService.saveGameFull() → fetch('/api/save', { POST })
gameStore.loadProgress() → apiService.loadGame() → fetch('/api/load', { GET })
```

## Правила для новых фич

### 1. Все мутации — через store actions

```typescript
// ✅ Правильно: action в store
purchaseBoost: (boostId: string) => {
  const state = get()
  if (state.nuts < BOOST_COSTS[boostId]) return false
  set({ nuts: state.nuts - BOOST_COSTS[boostId], ... })
  get().saveProgress()
  return true
}

// ❌ Неправильно: мутация из компонента
const handleBuy = () => {
  localStorage.setItem('boosts', JSON.stringify([...boosts, newBoost]))
}
```

### 2. Timestamps вместо countdown

```typescript
// ✅ Backend-ready: серверное время, устойчиво к манипуляциям
interface ActiveBoost {
  type: BoostType
  activatedAt: number    // Date.now()
  endTimestamp: number    // Date.now() + durationMs
}

// ❌ Плохо: клиентский таймер, легко эксплуатировать
interface ActiveBoost {
  type: BoostType
  remainingSeconds: number
}
```

### 3. Валидация на клиенте — preview, не truth

Клиентская валидация (`balance >= cost`) — для UX (disable кнопки). Бэкенд будет перепроверять. Не полагайся на клиентские проверки для безопасности.

### 4. Idempotent actions

Action должен быть безопасен для повторного вызова:

```typescript
// ✅ Idempotent: проверяет, не забрано ли уже
claimAchievement: (id) => {
  if (state.achievements[id].claimed) return false  // уже забрано
  set({ nuts: state.nuts + reward, achievements: { ...updated } })
  return true
}
```

### 5. Поля для будущего API

При добавлении новых сущностей включай поля, нужные бэкенду:

```typescript
interface ActiveBoost {
  id: string              // UUID — для серверной идентификации
  type: BoostType
  activatedAt: number     // серверный timestamp
  endTimestamp: number
  source: 'nuts' | 'ad' | 'gift'  // для аналитики
}
```

### 6. SaveData — плоская структура

SaveData должна легко маппиться на Prisma-модель. Избегай глубокой вложенности:

```typescript
// ✅ Хорошо: 2 уровня вложенности максимум
{ workers: { mechanic: { count: 5, cost: 7500 } } }

// ❌ Плохо: 3+ уровня
{ workers: { mechanic: { upgrades: { speed: { level: 3 } } } } }
```

## Подготовка к конкретным бэкенд-фичам

### Telegram Auth
```typescript
// Подготовить: src/services/TelegramService.ts
export function getInitData(): string | null {
  return window.Telegram?.WebApp?.initData ?? null
}
export function getUserId(): number | null {
  return window.Telegram?.WebApp?.initDataUnsafe?.user?.id ?? null
}
```

### Лиги (Socket.io)
```typescript
// Подготовить интерфейс:
interface LeagueService {
  connect(): void
  disconnect(): void
  onLeaderboardUpdate(callback: (entries: LeaderboardEntry[]) => void): void
  submitScore(score: number): void
}
// Реализация-заглушка: LocalLeagueService с mock data
// Реальная: SocketLeagueService с Socket.io
```

### Покупки (Telegram Stars)
```typescript
// Подготовить интерфейс:
interface PurchaseService {
  buyNutsPack(packId: string): Promise<PurchaseResult>
  getPurchaseHistory(): Promise<PurchaseRecord[]>
}
// Реализация-заглушка: LocalPurchaseService (alert + начисление гаек)
// Реальная: TelegramPurchaseService → Telegram.WebApp.openInvoice()
```

## Checklist перед каждым PR

- [ ] Новая логика — в store action, не в компоненте.
- [ ] Новые данные — в SaveData с миграцией.
- [ ] Timestamps — не countdowns.
- [ ] Нет прямых вызовов localStorage вне storageService.
- [ ] Action idempotent (безопасен при повторном вызове).
- [ ] Валидация — для UX, не для безопасности.
