// src/layout/layout.config.ts

/**
 * [AIへの制約] 
 * 画面上の配置位置や色を変更したい場合は、このファイルの値を修正してください。
 */

export const LAYOUT_CONSTANTS = {
  COLORS: {
    PLAYER_BG: 0xE8F5E9,
    OPPONENT_BG: 0xFFEBEE,
    CONTROL_BG: 0xF5F5F5,
    ZONE_BORDER: 0xCCCCCC,
    ZONE_FILL: 0xFFFFFF,
    CARD_BACK: 0x2C3E50,
    TEXT_POWER: 0xFF0000,
    TEXT_DEFAULT: 0x333333,
    TEXT_RESOURCE: 0x000000,
    BADGE_BG: 0x000000,
    BADGE_TEXT: 0xFFFFFF,
  },
  SIZES: {
    H_CTRL: 80,
    MARGIN_TOP: 20,
    MARGIN_BOTTOM: 20,
  }
} as const;

export const LAYOUT_PARAMS = {
  X_RATIOS: {
    LIFE: 0.15,
    LEADER: 0.35,
    STAGE: 0.55,
    DECK: 0.85,
    TRASH: 0.85,
    DON_DECK: 0.2,
    DON_ACTIVE: 0.4,
    DON_REST: 0.6,
  },
  FIELD: {
    GAP: 10,
    X_OFFSET: 0,
  },
  HAND: {
    X_START_RATIO: 0.1,
    OVERLAP_RATIO: 0.15,
  },
  ROWS: {
    ROW1_Y_OFFSET: 0.6,       // フィールド（キャラ）
    DEFAULT_MULTIPLIER: 1.2,  // リーダー・ライフ列以降
  }
} as const;
