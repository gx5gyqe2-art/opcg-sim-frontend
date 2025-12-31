export const LAYOUT_CONSTANTS = {
  COLORS: {
    APP_BG: 0x1a1a1a,
    PLAYER_BG: 0xE8F5E9,
    OPPONENT_BG: 0xFFEBEE,
    CONTROL_BG: 0xF5F5F5,
    ZONE_BORDER: 0xCCCCCC,
    ZONE_FILL: 0xFFFFFF,
    CARD_BACK: 0x2C3E50,
    
    // テキスト色 (PIXI)
    TEXT_POWER: 0xFF0000,
    TEXT_DEFAULT: 0x333333,
    TEXT_RESOURCE: 0x000000,
    TEXT_LIGHT: 0xFFFFFF,
    TEXT_COUNTER: 0xe67e22,
    
    // バッジ色 (PIXI)
    BADGE_BG: 0x000000,
    BADGE_TEXT: 0xFFFFFF,
    BADGE_COST_BG: 0x2c3e50,
    BADGE_DON_BG: 0x9370DB,

    // マスク・線 (PIXI)
    MASK_FILL: 0xffffff,
    BORDER_LINE: 0x000000,
    
    // UIオーバーレイ・バッジ (DOM文字列)
    OVERLAY_ATTACK_BG: 'rgba(231, 76, 60, 0.9)',
    OVERLAY_INFO_BG: 'rgba(0,0,0,0.8)',
    OVERLAY_MODAL_BG: 'rgba(0,0,0,0.5)',
    OVERLAY_BORDER_HIGHLIGHT: '#f1c40f',

    BADGE_ATTR: '#c0392b',
    BADGE_TRAIT: '#34495e',
    BADGE_LOC: '#333333',
    
    // ボタン色 (DOM文字列)
    BTN_PRIMARY: '#3498db',   // Blue
    BTN_DANGER: '#e74c3c',    // Red
    BTN_SUCCESS: '#2ecc71',   // Green
    BTN_WARNING: '#f1c40f',   // Yellow
    BTN_SECONDARY: '#95a5a6', // Gray
    BTN_DISABLED: '#95a5a6',
    
    // ログ色 (Console)
    LOG_DEBUG: '#7f8c8d',
    LOG_INFO: '#2ecc71',
    LOG_WARN: '#f1c40f',
    LOG_ERROR: '#e74c3c',
    LOG_SUMMARY: '#ffffff',
  },
  SIZES: {
    H_CTRL: 80,
    MARGIN_TOP: 20,
    MARGIN_BOTTOM: 20,
    
    // フォントサイズ
    FONT_COST: 10,
    FONT_COUNTER: 9,
    FONT_POWER: 11,
    FONT_NAME_RESOURCE: 11,
    FONT_NAME_NORMAL: 9,
    FONT_DON: 10,
    FONT_BACK: 8,
    FONT_COUNT: 12,
  }
} as const;

export const LAYOUT_PARAMS = {
  // カード・グリッド計算
  CARD: {
    ASPECT_RATIO: 1.4,
    MAX_ROWS_IN_HALF: 5.2,
    MAX_COLS_ON_SCREEN: 8.5,
    SCALE_ADJUST: 1.4,
  },
  SPACING: {
    V_GAP_RATIO: 0.30,
    TURN_END_BTN_X_OFFSET: 100,
  },
  
  // UI詳細配置・サイズ
  UI_DETAILS: {
    CARD_BADGE_OFFSET: 10,
    CARD_BADGE_DON_OFFSET: 8,
    CARD_TEXT_PADDING_X: 6,
    CARD_TEXT_PADDING_Y: 12,
    CARD_TEXT_MAX_WIDTH_RATIO: 1.1,
    
    MODAL_MAX_WIDTH: '500px',
    THUMBNAIL_WIDTH: '80px',
    THUMBNAIL_HEIGHT: '110px',
  },

  // 重なり順
  Z_INDEX: {
    NOTIFICATION: 100,
    OVERLAY: 110,
    SHEET: 2000,
  },

  // 形状・線
  SHAPE: {
    CORNER_RADIUS_CARD: 6,
    CORNER_RADIUS_BADGE: 9,
    CORNER_RADIUS_BTN: 12,
    CORNER_RADIUS_MODAL: '20px 20px 0 0',
    CORNER_RADIUS_SHEET_BADGE: '4px',
    STROKE_WIDTH_ZONE: 2,
  },

  // 物理挙動・操作
  PHYSICS: {
    HAND_FRICTION: 0.92,
    HAND_EASE: 0.2,
    HAND_BOUNCE: 0.5,
    HAND_DRAG_PADDING: 20,
    TAP_THRESHOLD: 10,
  },

  // 透明度
  ALPHA: {
    BADGE_BG: 0.9,
    BADGE_COUNT: 0.8,
    BORDER_LINE: 0.3,
  },

  // 時間・タイミング (ms)
  TIMING: {
    TOAST_DURATION: 3000,
    LONG_PRESS: 500,
  },

  // 影 (CSS文字列)
  SHADOWS: {
    MODAL: '0 -4px 16px rgba(0,0,0,0.2)',
  },

  // 各ゾーン配置比率
  FIELD: { GAP: 35, X_OFFSET: 20 },
  HAND: { X_START_RATIO: 0.08, OVERLAP_RATIO: 1.2 },
  ROWS: { ROW1_Y_OFFSET: 0.2, DEFAULT_MULTIPLIER: 0.55 },
  X_RATIOS: {
    LIFE: 0.15, 
    LEADER: 0.43, 
    STAGE: 0.65, 
    DECK: 0.90, 
    TRASH: 0.90, 
    DON_DECK: 0.15, 
    DON_ACTIVE: 0.38, 
    DON_REST: 0.60,
  }
} as const;
