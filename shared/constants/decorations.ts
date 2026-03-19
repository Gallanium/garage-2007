// shared/constants/decorations.ts
import type { DecorationDefinition, DecorationSlot } from '../types/game.js'

export const SLOT_LABELS: Record<DecorationSlot, string> = {
  workbench_area:     'Верстак',
  left_wall:          'Левая стена',
  back_wall_left:     'Задняя стена (лево)',
  back_wall_center:   'Задняя стена (центр)',
  back_wall_right:    'Задняя стена (право)',
  floor_main:         'Пол гаража',
  right_shelf_top:    'Правая полка (верх)',
  right_shelf_mid:    'Правая полка (середина)',
  right_shelf_bottom: 'Правая полка (низ)',
  right_shelf_extra:  'Правая полка (доп.)',
  right_wall:         'Правая стена',
}

const _CATALOG = {
  tools_workbench: {
    id: 'tools_workbench', category: 'tools', slot: 'workbench_area',
    name: 'Верстак', icon: '🔨', description: 'Основа любого гаража',
    currency: 'rubles', cost: 5000, unlockLevel: 1,
    position: { x: 55, y: 300 }, size: { w: 40, h: 25 }, color: 0x8B6914,
  },
  tools_wrench_set: {
    id: 'tools_wrench_set', category: 'tools', slot: 'left_wall',
    name: 'Набор ключей', icon: '🔧', description: 'Незаменимые инструменты',
    currency: 'rubles', cost: 15000, unlockLevel: 3,
    position: { x: 50, y: 200 }, size: { w: 30, h: 20 }, color: 0xA0A0A0,
  },
  tools_shelf: {
    id: 'tools_shelf', category: 'tools', slot: 'left_wall',
    name: 'Стеллаж с запчастями', icon: '🗄️', description: 'Порядок в запчастях',
    currency: 'rubles', cost: 50000, unlockLevel: 5,
    position: { x: 45, y: 250 }, size: { w: 25, h: 50 }, color: 0x6B4226,
  },
  tools_compressor: {
    id: 'tools_compressor', category: 'tools', slot: 'workbench_area',
    name: 'Компрессор', icon: '⚙️', description: 'Для покраски и продувки',
    currency: 'rubles', cost: 200000, unlockLevel: 8,
    position: { x: 55, y: 330 }, size: { w: 30, h: 30 }, color: 0xC0392B,
  },
  tools_welding: {
    id: 'tools_welding', category: 'tools', slot: 'workbench_area',
    name: 'Сварочный аппарат', icon: '🔥', description: 'Для серьёзных работ',
    currency: 'nuts', cost: 25, unlockLevel: 10,
    position: { x: 70, y: 270 }, size: { w: 25, h: 25 }, color: 0xFF6600,
  },
  decor_calendar: {
    id: 'decor_calendar', category: 'wall_decor', slot: 'back_wall_center',
    name: 'Календарь 2007', icon: '📅', description: 'Памятный год',
    currency: 'rubles', cost: 2000, unlockLevel: 1,
    position: { x: 180, y: 155 }, size: { w: 20, h: 25 }, color: 0xFFFFFF,
  },
  decor_poster_car: {
    id: 'decor_poster_car', category: 'wall_decor', slot: 'back_wall_left',
    name: 'Постер «Тачка мечты»', icon: '🖼️', description: 'Мотивирует работать',
    currency: 'rubles', cost: 10000, unlockLevel: 2,
    position: { x: 140, y: 155 }, size: { w: 30, h: 25 }, color: 0x3498DB,
  },
  decor_flag: {
    id: 'decor_flag', category: 'wall_decor', slot: 'back_wall_right',
    name: 'Флаг гаражного кооператива', icon: '🚩', description: 'Символ единства',
    currency: 'rubles', cost: 30000, unlockLevel: 4,
    position: { x: 220, y: 155 }, size: { w: 25, h: 20 }, color: 0xE74C3C,
  },
  decor_clock: {
    id: 'decor_clock', category: 'wall_decor', slot: 'back_wall_right',
    name: 'Настенные часы', icon: '🕐', description: 'Время — деньги',
    currency: 'rubles', cost: 80000, unlockLevel: 7,
    position: { x: 260, y: 160 }, size: { w: 20, h: 20 }, color: 0xF5F5DC,
  },
  decor_neon_sign: {
    id: 'decor_neon_sign', category: 'wall_decor', slot: 'back_wall_center',
    name: 'Неоновая вывеска «OPEN»', icon: '✨', description: 'Всегда открыт',
    currency: 'nuts', cost: 40, unlockLevel: 12,
    position: { x: 180, y: 148 }, size: { w: 50, h: 15 }, color: 0x00FF00,
  },
  light_bulb: {
    id: 'light_bulb', category: 'lighting', slot: 'back_wall_center',
    name: 'Лампочка Ильича', icon: '💡', description: 'Классика жанра',
    currency: 'rubles', cost: 3000, unlockLevel: 1,
    position: { x: 180, y: 145 }, size: { w: 15, h: 15 }, color: 0xFFFF00,
  },
  light_fluorescent: {
    id: 'light_fluorescent', category: 'lighting', slot: 'back_wall_left',
    name: 'Люминесцентная лампа', icon: '🔦', description: 'Яркий свет для работы',
    currency: 'rubles', cost: 25000, unlockLevel: 4,
    position: { x: 130, y: 148 }, size: { w: 40, h: 8 }, color: 0xE0FFFF,
  },
  light_spotlight: {
    id: 'light_spotlight', category: 'lighting', slot: 'back_wall_right',
    name: 'Прожектор', icon: '🔆', description: 'Освещает всё',
    currency: 'rubles', cost: 100000, unlockLevel: 7,
    position: { x: 230, y: 148 }, size: { w: 20, h: 15 }, color: 0xFFFACD,
  },
  light_garage_lamp: {
    id: 'light_garage_lamp', category: 'lighting', slot: 'right_wall',
    name: 'Переноска', icon: '🏮', description: 'Свет под машиной',
    currency: 'rubles', cost: 300000, unlockLevel: 10,
    position: { x: 310, y: 200 }, size: { w: 15, h: 25 }, color: 0xFFA500,
  },
  car_zaporozhets: {
    id: 'car_zaporozhets', category: 'cars', slot: 'floor_main',
    name: 'Запорожец на ремонте', icon: '🚗', description: 'Народный автомобиль',
    currency: 'rubles', cost: 100000, unlockLevel: 5,
    position: { x: 250, y: 310 }, size: { w: 50, h: 25 }, color: 0x27AE60,
  },
  car_moskvich: {
    id: 'car_moskvich', category: 'cars', slot: 'floor_main',
    name: 'Москвич-412', icon: '🚙', description: 'Легенда советского автопрома',
    currency: 'rubles', cost: 500000, unlockLevel: 8,
    position: { x: 250, y: 310 }, size: { w: 50, h: 25 }, color: 0x2980B9,
  },
  car_vaz_2106: {
    id: 'car_vaz_2106', category: 'cars', slot: 'floor_main',
    name: 'ВАЗ-2106 «Шестёрка»', icon: '🏎️', description: 'Классика жигулей',
    currency: 'rubles', cost: 2000000, unlockLevel: 12,
    position: { x: 250, y: 310 }, size: { w: 55, h: 25 }, color: 0xE74C3C,
  },
  car_gaz_24: {
    id: 'car_gaz_24', category: 'cars', slot: 'floor_main',
    name: 'ГАЗ-24 «Волга»', icon: '🚕', description: 'Статусный автомобиль',
    currency: 'nuts', cost: 80, unlockLevel: 15,
    position: { x: 250, y: 310 }, size: { w: 55, h: 28 }, color: 0x1A1A1A,
  },
  trophy_first_place: {
    id: 'trophy_first_place', category: 'trophies', slot: 'right_shelf_top',
    name: 'Кубок «Лучший гараж»', icon: '🏆', description: 'Гордость гаражника',
    currency: 'rubles', cost: 50000, unlockLevel: 5,
    position: { x: 305, y: 200 }, size: { w: 15, h: 20 }, color: 0xFFD700,
  },
  trophy_certificate: {
    id: 'trophy_certificate', category: 'trophies', slot: 'right_shelf_mid',
    name: 'Сертификат мастера', icon: '📜', description: 'Признание мастерства',
    currency: 'rubles', cost: 200000, unlockLevel: 10,
    position: { x: 305, y: 230 }, size: { w: 20, h: 15 }, color: 0xF5DEB3,
  },
  trophy_medal: {
    id: 'trophy_medal', category: 'trophies', slot: 'right_shelf_bottom',
    name: 'Медаль «За трудовые заслуги»', icon: '🎖️', description: 'Заслуженная награда',
    currency: 'rubles', cost: 1000000, unlockLevel: 14,
    position: { x: 305, y: 260 }, size: { w: 15, h: 15 }, color: 0xCD7F32,
  },
  trophy_golden_wrench: {
    id: 'trophy_golden_wrench', category: 'trophies', slot: 'right_shelf_extra',
    name: 'Золотой гаечный ключ', icon: '🔑', description: 'Ключ от всех замков',
    currency: 'nuts', cost: 100, unlockLevel: 18,
    position: { x: 305, y: 290 }, size: { w: 20, h: 12 }, color: 0xFFD700,
  },
} satisfies Record<string, DecorationDefinition>

/** Type-safe union of all decoration IDs derived from the catalog */
export type DecorationId = keyof typeof _CATALOG

export const DECORATION_CATALOG: Record<string, DecorationDefinition> = _CATALOG
