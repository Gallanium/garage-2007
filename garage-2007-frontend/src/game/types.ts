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
  // Уровни 1-4: Ржавый/грязный этап
  1: 0x8B4513,  // Ржавый коричневый
  2: 0x9B5523,  // Немного светлее
  3: 0xA0522D,  // Sienna
  4: 0xB8860B,  // DarkGoldenrod
  
  // Уровни 5-9: Базовая мастерская
  5: 0xCD853F,  // Peru
  6: 0xD2691E,  // Chocolate
  7: 0xDAA520,  // Goldenrod
  8: 0xDEB887,  // BurlyWood
  9: 0xF4A460,  // SandyBrown
  
  // Уровни 10-14: Современный техцентр
  10: 0x708090, // SlateGray
  11: 0x778899, // LightSlateGray
  12: 0x87CEEB, // SkyBlue
  13: 0x4682B4, // SteelBlue
  14: 0x5F9EA0, // CadetBlue
  
  // Уровни 15-19: Премиум сервис
  15: 0x6A5ACD, // SlateBlue
  16: 0x7B68EE, // MediumSlateBlue
  17: 0x9370DB, // MediumPurple
  18: 0xBA55D3, // MediumOrchid
  19: 0xDA70D6, // Orchid
  
  // Уровень 20: Элитная империя
  20: 0xFFD700, // Gold
} as const;

// ============================================
// ЦВЕТА ЭФФЕКТОВ (используются в MainScene)
// ============================================

export const EFFECT_COLORS = {
  money: 0xFFD700,
  levelUp: 0xFFFFFF,
  critical: 0xFF4444,
  bonus: 0x44FF44,
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