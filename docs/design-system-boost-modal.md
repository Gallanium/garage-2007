# Design System — BoostModal Reference

> Эталонный дизайн для масштабирования на весь проект.
> Источник: `garage-2007-frontend/src/components/BoostModal.tsx`

---

## Философия

Тёмный мрачный интерфейс в стиле «гаражного» клиент-сервиса. Пиксельный шрифт `Press Start 2P` создаёт ретро-аркадное ощущение. Оранжево-ржавая акцентная палитра отсылает к металлу и ржавчине. Каждая карточка/раздел имеет собственный цветовой акцент, встроенный в тему карточки.

---

## Кастомные токены (tailwind.config.js)

```
garage-yellow: #E6B800   — грязно-жёлтый, основной акцент (заголовки)
garage-rust:   #D2691E   — ржавый оранжевый (border разделители)
garage-metal:  #6B6B6B   — серый металлик
garage-blue:   #003D7A   — тёмно-синий
garage-brown:  #8B4513   — коричневый

font-mono / font-sans → "Press Start 2P", cursive  (один шрифт на весь проект)

text-game-xs:   8px / 10px line-height
text-game-sm:   10px / 12px line-height
text-game-base: 12px / 16px line-height
```

---

## Оверлей (backdrop)

```
fixed inset-0 z-40 flex items-center justify-center
bg-black/70 backdrop-blur-sm
```

| Свойство | Значение |
|---|---|
| Перекрытие | `bg-black/70` |
| Размытие фона | `backdrop-blur-sm` |
| z-index | `z-40` (дочерние модалки — `z-50`) |
| Закрытие | клик по оверлею вызывает `onClose` |

---

## Контейнер модалки

```
relative bg-gray-950 border-2 border-orange-700/70 rounded-xl
p-4 mx-3 w-full max-w-sm font-mono
shadow-2xl shadow-orange-900/30
```

| Свойство | Значение | Примечание |
|---|---|---|
| Фон | `bg-gray-950` | Самый тёмный серый (~#0a0a0a) |
| Рамка | `border-2 border-orange-700/70` | 2px, оранжевая 70% |
| Скругление | `rounded-xl` | 12px |
| Отступ | `p-4` | 16px |
| Тень | `shadow-2xl shadow-orange-900/30` | Большая, с оранжевым оттенком |
| Ширина | `w-full max-w-sm` | ~384px |
| Шрифт | `font-mono` | Press Start 2P, на весь контейнер |

> **Ключевое отличие от старых модалок:** тёмный `bg-gray-950` вместо градиентного `from-gray-800 to-gray-900`, толстая рамка `border-2`, бо́льшое скругление `rounded-xl`, цветная тень.

---

## Заголовок

```html
<div class="text-center mb-4">
  <h2 class="text-garage-yellow text-sm font-bold tracking-widest">
    ЗАГОЛОВОК
  </h2>
  <p class="text-gray-500 text-[9px] mt-1 tracking-wide">
    Подзаголовок или описание
  </p>
</div>
```

| Элемент | Размер | Цвет | Прочее |
|---|---|---|---|
| Заголовок | `text-sm` (14px) | `text-garage-yellow` | `font-bold tracking-widest` |
| Подзаголовок | `text-[9px]` | `text-gray-500` | `tracking-wide mt-1` |

---

## Кнопка закрытия (×)

```html
<button class="absolute top-3 right-3 text-gray-400 hover:text-white text-xl leading-none p-1">
  ×
</button>
```

Символ `×` (знак умножения), без фона и рамки. Простая hover-смена цвета.

---

## Карточка — базовая структура

### Контейнер карточки

```
rounded-lg border p-3
bg-gradient-to-br from-{color}-950/80 to-{color}-950/60 border-{color}-700/60
```

- **Скругление:** `rounded-lg` (8px)
- **Отступ:** `p-3` (12px)
- **Фон:** диагональный градиент от тёмного к ещё более тёмному (обе точки в диапазоне `-950`)
- **Рамка:** 1px в цвете темы на 60% прозрачности
- **Заблокировано:** весь блок получает `opacity-50`

### Иконка

```
w-10 h-10 rounded-lg flex items-center justify-center
text-white text-lg flex-shrink-0
bg-{color}-{shade}
```

- 40×40px, `rounded-lg`, заливка цветом темы
- Белый эмодзи/символ, `text-lg` (18px)

### Строка названия + цены

```html
<div class="flex items-center justify-between">
  <span class="text-xs font-bold text-white">Название</span>
  <span class="text-cyan-400 text-xs font-bold">30 🔩</span>
</div>
```

- Название: `text-xs font-bold text-white` (при активном бусте — цвет темы)
- Цена: **всегда `text-cyan-400`** — единственный циановый элемент, выделяет стоимость

### Строка описания + длительности

```html
<div class="flex items-center justify-between mt-0.5">
  <span class="text-gray-400 text-[9px]">Описание</span>
  <span class="text-gray-500 text-[9px]">⏱ 15 мин</span>
</div>
```

### Внутренний layout карточки

```
flex items-center gap-3 mb-2   ← верхняя строка: иконка + текст
[кнопка/статус]                ← нижняя строка: полная ширина
```

---

## Состояния карточки (action row)

### Активно (таймер)

```html
<div class="w-full py-2 rounded text-center text-[10px] font-bold text-{theme} bg-black/30">
  ⏱ АКТИВЕН — 14:32
</div>
```

Не-кликабельный `div`. Фон `bg-black/30`, текст в цвете темы.

### Заблокировано (нет уровня)

```html
<div class="w-full py-2 rounded text-center text-[10px] font-bold text-gray-500 bg-black/30">
  🔒 УРОВЕНЬ 5
</div>
```

Та же форма, серый текст.

### Доступно к покупке / замена / нет гаек

```html
<button class="w-full py-2 rounded text-[10px] font-bold text-white
               bg-gradient-to-r from-{color}-{a} to-{color}-{b}
               hover:from-{color}-{a-1} hover:to-{color}-{b-1}
               transition-colors
               opacity-60 (только при нехватке ресурсов)">
  КУПИТЬ / ЗАМЕНИТЬ / КУПИТЬ — не хватает 15 🔩
</button>
```

- Горизонтальный градиент (`bg-gradient-to-r`)
- Hover — сдвиг градиента на 1 тон светлее
- `transition-colors` для плавной смены
- При нехватке ресурсов: `opacity-60` (кнопка кликабельна, ведёт к вторичной модалке)

---

## Диалог подтверждения (inline)

Встроен в модалку, появляется над карточками при деструктивном действии:

```html
<div class="mb-3 p-3 bg-orange-950/60 border border-orange-600/50 rounded-lg text-center">
  <p class="text-orange-300 text-[9px] mb-2">
    Вопрос?<br/>
    <span class="text-gray-400">Уточнение последствий</span>
  </p>
  <div class="flex gap-2">
    <button class="flex-1 py-1.5 bg-gray-800 text-gray-300 text-[9px] font-bold rounded">
      ОТМЕНА
    </button>
    <button class="flex-1 py-1.5 bg-orange-700 hover:bg-orange-600 text-white text-[9px] font-bold rounded">
      ПОДТВЕРДИТЬ
    </button>
  </div>
</div>
```

---

## Цветовые темы карточек

Каждая карточка/секция имеет собственную тему. Паттерн:

| Тип | Фон | Рамка | Кнопка | Таймер |
|---|---|---|---|---|
| turbo (фиолетовый) | `from-purple-950/80 to-violet-950/60` | `border-purple-700/60` | `from-purple-700 to-violet-600` | `text-purple-300` |
| income_2x (янтарный) | `from-orange-950/80 to-amber-950/60` | `border-orange-700/60` | `from-orange-600 to-amber-500` | `text-amber-300` |
| income_3x (красный) | `from-red-950/80 to-rose-950/60` | `border-red-700/60` | `from-red-700 to-rose-600` | `text-red-300` |
| нейтральный | `from-gray-800 to-gray-700` | `border-gray-600/30` | — | — |

**Принцип:** фон — тёмные тона `-950` с прозрачностью, рамка — насыщенный тон на 60%, кнопка — насыщенный переход в родственный цвет, активный текст — светлый `-300`.

---

## Сводная цветовая палитра

| Роль | Tailwind класс |
|---|---|
| Фон модалки | `bg-gray-950` |
| Рамка модалки | `border-orange-700/70` |
| Тень модалки | `shadow-orange-900/30` |
| Оверлей | `bg-black/70` |
| Заголовок | `text-garage-yellow` |
| Подзаголовок | `text-gray-500` |
| Кнопка закрытия | `text-gray-400 hover:text-white` |
| Название в карточке | `text-white` |
| Цена | `text-cyan-400` ← единственный циан |
| Описание | `text-gray-400` |
| Детали (длительность) | `text-gray-500` |
| Таймер/статус фон | `bg-black/30` |
| Заблокировано | `text-gray-500` + `opacity-50` на карточке |
| Диалог фон | `bg-orange-950/60` |
| Диалог рамка | `border-orange-600/50` |
| Диалог текст | `text-orange-300` |
| Кнопка отмены | `bg-gray-800 text-gray-300` |
| Кнопка действия | `bg-orange-700 hover:bg-orange-600` |

---

## Типографика

| Элемент | Размер | Вес | Доп |
|---|---|---|---|
| Заголовок модалки | `text-sm` (14px) | `font-bold` | `tracking-widest` |
| Подзаголовок | `text-[9px]` | normal | `tracking-wide` |
| Название карточки | `text-xs` (12px) | `font-bold` | — |
| Цена | `text-xs` | `font-bold` | — |
| Описание | `text-[9px]` | normal | — |
| Длительность | `text-[9px]` | normal | — |
| Текст кнопки | `text-[10px]` | `font-bold` | — |
| Таймер | `text-[10px]` | `font-bold` | — |
| Диалог текст | `text-[9px]` | normal / bold | — |
| Кнопка × | `text-xl` | normal | — |

Весь текст — `font-mono` (Press Start 2P), наследуется от контейнера.

---

## Отступы

| Элемент | Значение |
|---|---|
| Модалка padding | `p-4` (16px) |
| Модалка боковые отступы | `mx-3` (12px) |
| После заголовка | `mb-4` (16px) |
| После подзаголовка | `mt-1` (4px) |
| Между карточками | `gap-2` (8px) |
| Padding карточки | `p-3` (12px) |
| Gap иконка-текст | `gap-3` (12px) |
| Нижний отступ верхней строки | `mb-2` (8px) |
| Верхний отступ строки описания | `mt-0.5` (2px) |
| Кнопки по вертикали | `py-2` (8px) |
| Диалог нижний отступ | `mb-3` (12px) |
| Диалог padding | `p-3` (12px) |

---

## Эффекты

| Эффект | Класс | Где |
|---|---|---|
| Размытие фона | `backdrop-blur-sm` | Оверлей |
| Тень модалки | `shadow-2xl shadow-orange-900/30` | Контейнер |
| Диагональный градиент | `bg-gradient-to-br from-*-950/80 to-*-950/60` | Карточки |
| Горизонтальный градиент | `bg-gradient-to-r` | Кнопки |
| Opacity | `opacity-50` / `opacity-60` | Locked / blocked_nuts |
| Переход цвета | `transition-colors` | Кнопки hover |
| Нет анимации входа | — | Модалка не анимирована |

---

## Чего НЕТ в этом дизайне

Намеренные упрощения, которые стоит сохранить при масштабировании:

- Нет анимаций входа/выхода модалки (`fadeIn`, `slideUp` и т.п.) — появляется мгновенно
- Нет `active:scale-95` на кнопках — без «нажатия»
- Нет круглой рамки на кнопке закрытия — просто символ ×
- Нет `sm:` responsive-breakpoints внутри модалки — фиксированный размер
- Нет `border-radius` на оверлее — он на весь экран

---

## Компоненты для редизайна

При масштабировании на весь проект нужно обновить:

| Файл | Описание |
|---|---|
| `MilestoneUpgradeModal.tsx` | Модалка апгрейда уровня |
| `DailyRewardsModal.tsx` | Модалка ежедневных наград |
| `NutsPromptModal.tsx` | Модалка нехватки гаек |
| `WelcomeBackModal.tsx` | Модалка оффлайн-дохода |
| `UpgradesPanel.tsx` | Вкладка улучшений |
| `AchievementsPanel.tsx` | Вкладка ачивок |
| `StatsPanel.tsx` | Вкладка статистики |
| `GameHeader.tsx` | Хедер с балансом |
| `GameFooter.tsx` | Футер с доходами |
| `TabNavigation.tsx` | Навигация по вкладкам |
