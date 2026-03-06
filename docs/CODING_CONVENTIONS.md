# Coding Conventions — «Гараж 2007»

> Стилистические и структурные правила для единообразия кодовой базы.

---

## TypeScript

### Strict mode — всегда
`tsconfig.app.json` включает `"strict": true`. Все типы — явные. `any` запрещён.

### Интерфейсы vs типы
- `interface` — для объектов и props компонентов.
- `type` — для unions, intersections, утилитарных типов.

### Enums — не использовать
Zustand плохо сериализует enums. Используй `as const` объекты:
```typescript
// ✅
export const WORKER_TYPES = ['apprentice', 'mechanic', 'master', 'brigadier', 'director'] as const
export type WorkerType = typeof WORKER_TYPES[number]

// ❌
enum WorkerType { Apprentice, Mechanic }
```

### Экспорты
- Именованные экспорты для утилит, констант, типов.
- `export default` только для React-компонентов.

## React

### Компоненты
```typescript
// Шаблон компонента:
interface XxxProps { /* ... */ }

const Xxx: React.FC<XxxProps> = ({ prop1, prop2 }) => {
  // hooks
  // handlers (useCallback)
  // derived state
  // return JSX
}

export default Xxx
```

### Hooks
- `useCallback` для всех обработчиков, передаваемых в дочерние компоненты.
- `useMemo` для дорогих вычислений (сортировка, фильтрация списков).
- Zustand-селекторы вместо `useMemo` для данных из store.

### Условный рендер
- `{condition && <Component />}` для простых случаев.
- Early return `if (!isOpen) return null` для модалок.
- НЕ условный рендер Phaser-канваса — используй `visibility: hidden`.

## Zustand

### Селекторы — атомарные
Одно поле = один селектор. Комбинации — через `useShallow`.

### Actions — побочные эффекты в конце
```typescript
myAction: () => {
  // 1. Валидация (return false/void если не прошла)
  // 2. set() — обновление состояния
  // 3. get().saveProgress() — persistence
  // 4. get().checkAchievements() — если релевантно
}
```

### Именование
- State: существительные (`balance`, `garageLevel`, `activeBoosts`).
- Actions: глаголы (`handleClick`, `purchaseUpgrade`, `activateBoost`).
- Селекторы: `useXxx` (camelCase с префиксом use).

## CSS / Tailwind

### Порядок классов (рекомендуемый)
```
position → display → sizing → spacing → typography → colors → borders → effects → animation
```

### Breakpoints
- По умолчанию — мобильный (360px).
- `sm:` — планшет (640px+).
- Не используй `md:` и выше — Telegram Mini Apps редко показываются на десктопе в полный размер.

### Кастомные цвета — из конфига
```
garage-metal, garage-rust, garage-blue, garage-yellow, garage-brown
```

## Phaser

### Naming
- Классы сцен: PascalCase (`MainScene`, `BoostEffectManager`).
- Game objects: camelCase (`garageSprite`, `levelText`).
- Events: camelCase строки (`'garageClicked'`, `'levelTransitionComplete'`).

### Memory management
- Все game objects уничтожаются в `shutdown()`.
- Tweens с `onComplete: () => object.destroy()` для временных объектов.
- Контейнеры (`Phaser.GameObjects.Container`) для группировки.

### Performance
- Particle effects: максимум 20 частиц одновременно.
- Tweens: максимум 600ms для одиночных анимаций.
- `update()` — минимальная работа, предпочитай tweens.

## Комментарии

### JSDoc — для публичных API
```typescript
/**
 * Расчёт стоимости N-го уровня апгрейда.
 * Формула: Cost(n) = floor(BaseCost × 1.15^n)
 *
 * @param baseCost - базовая стоимость
 * @param level - текущий уровень
 * @returns стоимость следующего уровня в рублях
 */
```

### Секции — разделители
```typescript
// ============================================
// НАЗВАНИЕ СЕКЦИИ
// ============================================
```

### TODO — с контекстом
```typescript
// TODO: Добавить визуализацию бустов на гараже (Stage 8)
// TODO: Заменить placeholder на реальные спрайты (Pixel Art Pipeline)
```

### DEVIATION — отклонения от GDD
```typescript
// DEVIATION FROM GDD: Используем 24ч вместо 48ч для streak grace period.
// Причина: 48ч слишком щедро, тестирование показало потерю мотивации.
```

## Git

### Commit messages
```
feat: add boost activation system
fix: correct offline earnings calculation overflow
style: extract pulse-ring animation to index.css
refactor: split MainScene into managers
docs: add Stage 8 design document
```

### Branch naming
```
feature/stage-8-boosts
fix/offline-earnings-overflow
refactor/phaser-scene-managers
```

## Локализация

Весь пользовательский текст — на русском. Ключевые правила:
- Числительные: правильные склонения через `pluralize()` (см. WelcomeBackModal).
- Большие числа: `formatLargeNumber()` → K/M/B/T/Q.
- Emoji: используются как иконки в UI (без нативных изображений пока).
