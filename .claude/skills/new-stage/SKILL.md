---
name: new-stage
description: Запуск нового Stage проекта — сбор контекста из документации, brainstorming, design spec, implementation plan. Полный пайплайн.
---

Этот скилл проводит через полный пайплайн запуска нового Stage. Brainstorming НЕ пропускается, даже если «всё и так понятно».

## Шаг 1: Сбор контекста

Прочитай следующие документы и покажи пользователю саммари:

1. **`docs/ROADMAP.md`** — текущее состояние стейджей, что уже сделано
2. **`docs/Garage_2007_GDD_v3_0.md`** — найди секцию про запрашиваемый стейдж
3. **`docs/Garage_2007_GBD_v1_1.md`** — если стейдж затрагивает экономику (формулы, баланс)
4. **`docs/BACKEND_MVP.md`** — что in scope / out of scope для бэкенда
5. **`plans/completed/`** — глянь 2-3 последних завершённых стейджа для понимания паттерна

Покажи пользователю:
> **Stage N: <название>**
> - Что известно из GDD: ...
> - Экономические аспекты из GBD: ... (если применимо)
> - Backend scope: in/out ...
> - Текущее состояние (из ROADMAP): ...

## Шаг 2: Brainstorming

Вызови скилл `superpowers:brainstorming`, передав собранный контекст.

Brainstorming пройдёт свой полный цикл:
- Уточняющие вопросы (по одному)
- 2-3 подхода с trade-offs
- Посекционный дизайн с утверждением
- Design spec

Design spec сохраняется в: `plans/active/YYYY-MM-DD-stage-NN-<name>-design.md`

## Шаг 3: Implementation plan

После утверждения design spec — вызови скилл `superpowers:writing-plans`.

План сохраняется в: `plans/active/YYYY-MM-DD-stage-NN-<name>.md`

## Шаг 4: Обновление ROADMAP

Обнови `docs/ROADMAP.md` — отметь стейдж как «in progress».

## Связь с другими скиллами

При создании плана, упомяни релевантные скиллы:
- Если стейдж включает новые game actions → «Используйте `/new-game-action` для каждого нового action»
- Если стейдж затрагивает shared/ → «Используйте `/shared-change` при изменении shared/»
- После завершения стейджа → «Запустите `/audit` для финальной проверки»

## Именование файлов

Следуй паттерну из `plans/completed/`:
- Design: `plans/active/YYYY-MM-DD-stage-NN-<name>-design.md`
- Plan: `plans/active/YYYY-MM-DD-stage-NN-<name>.md`
- После завершения стейджа: переместить оба файла в `plans/completed/`

## Что скилл НЕ делает

- НЕ скаффолдит файлы заранее — это задача execution по плану
- НЕ пропускает brainstorming
- НЕ начинает реализацию — только design + plan
