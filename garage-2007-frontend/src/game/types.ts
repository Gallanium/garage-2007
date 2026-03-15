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
  DECORATIONS: 15,
  EFFECTS: 20,
  UI: 30,
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
// ТИПЫ TYPESCRIPT
// ============================================

export interface SceneData {
  balance?: number;
  garageLevel?: number;
  activeDecorations?: string[];
}

/** Данные декорации для рендера в Phaser */
export interface DecorationRenderData {
  id: string
  position: { x: number; y: number }
  size: { w: number; h: number }
  color: number
  icon: string
  depth: number
}

/** Данные события клика по гаражу */
export interface GarageClickEvent {
  x: number;
  y: number;
  timestamp: number;
}

/** Данные события завершения анимации перехода уровня */
export interface LevelTransitionEvent {
  level: number;
}