// ============================================
// РАЗМЕРЫ И КООРДИНАТЫ
// ============================================

export const GAME_DIMENSIONS = {
  width: 360,
  height: 480,
  // Вычисляемые центры экрана
  get CENTER_X() { return this.width / 2 },
  get CENTER_Y() { return this.height / 2 },
};

// ============================================
// СЛОИ ГЛУБИНЫ (Z-INDEX)
// ============================================

export const DEPTH_LAYERS = {
  BACKGROUND: 0,
  GARAGE: 10,
  EFFECTS: 20,
  UI: 30,
} as const;

// ============================================
// ЦВЕТА
// ============================================

// Цвета для разных уровней гаража
export const GARAGE_COLORS = {
  1: 0x8B4513, // Коричневый - ржавая ракушка
  2: 0xA0522D, // Сиена - начало пути
  3: 0xCD853F, // Перуанский - базовый ремонт
  4: 0xDEB887, // Бурливуд - мастерская
  5: 0xF4A460, // Песочно-коричневый - гараж механика
} as const;

// Цвета эффектов
export const EFFECT_COLORS = {
  money: 0xFFD700,      // Золотой - для монеток
  levelUp: 0xFFFFFF,    // Белый - для вспышки повышения уровня
  critical: 0xFF4444,   // Красный - для критических кликов
  bonus: 0x44FF44,      // Зелёный - для бонусных событий
} as const;

// ============================================
// КОНФИГУРАЦИЯ ЧАСТИЦ И ЭФФЕКТОВ
// ============================================

export const CLICK_PARTICLE_CONFIG = {
  minCount: 8,
  maxCount: 12,
  minSize: 3,
  maxSize: 6,
  minDistance: 40,
  maxDistance: 80,
  minDuration: 400,
  maxDuration: 600,
} as const;

export const EFFECT_CONFIG = {
  particleCount: 8,
  particleSize: 4,
  particleDistance: 40,
  particleDuration: 500,
  clickTextDuration: 800,
} as const;

// ============================================
// КОНФИГУРАЦИЯ АНИМАЦИЙ
// ============================================

export const ANIMATION_CONFIG = {
  clickScale: 0.95,
  clickDuration: 50,
  levelUpScale: 1.1,
  levelUpDuration: 200,
  
  // Длительности
  DEFAULT_DURATION: 300,
  FAST_DURATION: 150,
  SLOW_DURATION: 600,
  
  // Типы easing
  EASING: {
    SMOOTH: 'Power2',
    BOUNCE: 'Bounce.easeOut',
    ELASTIC: 'Elastic.easeOut',
    BACK: 'Back.easeOut',
  },
} as const;

// ============================================
// КОНСТАНТЫ ДЛЯ УРОВНЕЙ ГАРАЖА
// ============================================

export const GARAGE_LEVELS = [
  'rusty_shell',
  'cleaned',
  'basic_repair',
  'workshop',
  'mechanic_garage'
] as const;

// ============================================
// ТИПЫ TYPESCRIPT
// ============================================

export type GarageLevel = typeof GARAGE_LEVELS[number];

export interface SceneData {
  balance: number;
  garageLevel: number;
}

export interface GarageSpriteData {
  level: number;
  isAnimating: boolean;
}

export interface ClickEventData {
  x: number;
  y: number;
  timestamp: number;
}

export interface EffectOptions {
  color?: number;
  duration?: number;
  scale?: number;
  particleCount?: number;
}