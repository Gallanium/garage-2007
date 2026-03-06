# AI Agent Instructions — «Гараж 2007» Frontend

> Версия: 1.0 | Дата: 06.03.2026
> Прочитай ВСЕ файлы в docs/ перед началом работы.

---

## Роль агента

Ты — senior frontend-разработчик проекта «Гараж 2007», idle-кликера для Telegram Mini Apps. Твоя задача — развивать фронтенд-механики, сохраняя чистую архитектуру и готовность к будущему подключению бэкенда.

## Авторитетные источники (в порядке приоритета)

1. **GDD v3.0** (`Garage_2007_GDD_v3_0.docx`) — главный дизайн-документ, описание всех систем.
2. **GBD v1.1** (`Garage_2007_GBD_v1_1.md`) — формулы экономики, константы баланса, лимиты.
3. **Текущий код** (`src/`) — фактическая реализация.
4. **Эти инструкции** (`docs/`) — архитектурные решения и роадмап.

При конфликте между GDD/GBD и кодом — **GDD/GBD имеет приоритет**, если нет явного обоснования отклонения.

## Технический стек

| Технология | Роль |
|---|---|
| React 19 + TypeScript 5.9 (strict) | UI-слой |
| Phaser 3.90 | Игровой canvas (визуал гаража) |
| Zustand 5 | State management |
| TailwindCSS 3.4 | Стилизация |
| Vite 7 | Сборка |
| localStorage | Временное хранение (заменится на API) |

## Ключевые принципы

### 1. Разделение ответственности
- **Zustand store** (`gameStore.ts`) — единственный источник истины для игровой логики и состояния.
- **React-компоненты** — только отображение и обработка пользовательского ввода. Никакой бизнес-логики.
- **Phaser сцены** — только визуал и эффекты. Не хранят состояние. Получают данные из React через props/events.
- **Utils** (`storageService.ts`, `math.ts`) — чистые утилиты без side effects.

### 2. Backend-readiness
Любая новая функция ДОЛЖНА проектироваться так, чтобы localStorage можно было заменить на HTTP API без переписывания бизнес-логики. Подробнее в `BACKEND_READINESS.md`.

### 3. Экономика строго по GBD
Все формулы, константы и лимиты берутся из GBD v1.1. Если нужно отклонение — создай комментарий `// DEVIATION FROM GBD: причина` и опиши в PR.

### 4. Mobile-first
Telegram Mini Apps работают на мобильных устройствах. Размеры touch-таргетов минимум 44×44px. Шрифт Press Start 2P — минимум 8px. Тестируй на 360×640.

## Паттерны кодирования

### Zustand store
```typescript
// ✅ Правильно: атомарные селекторы
export const useBalance = () => useGameStore((s) => s.balance)

// ✅ Правильно: составные селекторы через useShallow
export const usePlayerStats = () => useGameStore(
  useShallow((s) => ({ totalClicks: s.totalClicks, totalEarned: s.totalEarned }))
)

// ❌ Неправильно: подписка на весь store
const state = useGameStore()
```

### Новые actions в store
```typescript
// 1. Добавь тип в interface GameActions
// 2. Реализуй в create<GameStore>()
// 3. Создай селектор-хук: export const useMyAction = () => useGameStore((s) => s.myAction)
// 4. Вызывай saveProgress() после значимых изменений
// 5. Вызывай checkAchievements() если действие может триггернуть достижение
```

### React-компоненты
```typescript
// ✅ Правильно: FC с props-интерфейсом, useCallback для обработчиков
interface MyCardProps {
  title: string
  onAction: () => void
}
const MyCard: React.FC<MyCardProps> = ({ title, onAction }) => {
  const handleClick = useCallback(() => onAction(), [onAction])
  return <button onClick={handleClick}>{title}</button>
}
export default MyCard
```

### CSS / TailwindCSS
- Кастомные цвета: `garage-metal`, `garage-rust`, `garage-blue`, `garage-yellow`, `garage-brown`.
- Шрифт: `font-mono` (маппится на Press Start 2P).
- Анимации: определяй в `index.css` как `@keyframes`, оборачивай в `.animate-*` utility class.
- Не используй произвольные значения (`w-[137px]`) без крайней необходимости.

### Phaser ↔ React контракт
- React → Phaser: через публичные методы сцены (`updateGarageLevel`, `syncGameData`) и Phaser events (`emit`).
- Phaser → React: через Phaser `events.emit('garageClicked', data)`, подписка в `PhaserGame.tsx`.
- **Никогда** не импортируй Zustand store внутри Phaser-файлов.

## Файловая структура (текущая)

```
src/
├── App.tsx                    # Корневой компонент, оркестрация
├── main.tsx                   # Точка входа + DEV-консоль
├── index.css                  # Tailwind + кастомные анимации
├── components/
│   ├── TabNavigation.tsx      # Навигация табов
│   ├── UpgradeCard.tsx        # Карточка апгрейда (переиспользуемая)
│   ├── UpgradesPanel.tsx      # Таб "Улучшения"
│   ├── AchievementCard.tsx    # Карточка достижения
│   ├── AchievementsPanel.tsx  # Таб "Достижения"
│   ├── StatsPanel.tsx         # Таб "Статистика"
│   ├── WelcomeBackModal.tsx   # Модалка оффлайн-дохода
│   ├── MilestoneUpgradeModal.tsx  # Модалка повышения класса
│   ├── DailyRewardsModal.tsx  # Модалка ежедневных наград
│   └── DailyRewardButton.tsx  # Кнопка ежедневных наград
├── game/
│   ├── gameConfig.ts          # Конфигурация Phaser
│   ├── types.ts               # Типы, константы Phaser
│   ├── MainScene.ts           # Главная Phaser-сцена
│   └── PhaserGame.tsx         # React-обёртка для Phaser
├── store/
│   └── gameStore.ts           # Zustand store (~1800 строк)
└── utils/
    ├── storageService.ts      # localStorage CRUD
    └── math.ts                # Математические утилиты
```

## Процесс работы

1. **Перед реализацией**: проверь GDD/GBD на наличие спецификации для фичи.
2. **Планирование**: создай design-doc в `docs/plans/` (пример: `2026-03-01-daily-reward-button-design.md`).
3. **Реализация**: работай по задачам из плана. После каждой задачи — `npx tsc --noEmit`.
4. **Сохранение**: обнови `storageService.ts` и `SAVE_VERSION` если добавляешь новые поля в SaveData.
5. **Тесты**: опиши ожидаемое поведение. Unit-тесты (Jest) для формул экономики — обязательны.

## Текущее состояние (Stage 7 завершён)

### Реализовано:
- Базовый кликер (клик + крит 5%)
- 20 уровней прогрессии с milestone-гейтами (5/10/15/20)
- 5 типов работников с лимитами 3-5-3-2-1
- 2 апгрейда (clickPower, workSpeed)
- Оффлайн-доход (до 24ч, двухступенчатая эффективность)
- 15 достижений (500 гаек)
- Ежедневные награды (7-дневный цикл, 80 гаек/неделю)
- Rewarded video ad placeholder
- localStorage persistence (v4 с миграциями)
- DEV-консоль (`window.game`)

### НЕ реализовано (по GDD):
- Система бустов (покупка за гайки: 2x/1ч, 3x/30мин, 5x клик/15мин)
- Случайные события (каждые 15-30 мин)
- Кастомизация гаража (декорации)
- Система лиг и лидерборды
- Реферальная система
- Telegram Stars интеграция
- FOMO-офферы
- Премиум-пропуск
- Звуковое оформление
- Pixel art спрайты (вместо цветных прямоугольников)
