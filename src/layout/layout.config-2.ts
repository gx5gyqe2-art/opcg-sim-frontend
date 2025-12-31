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
  // カードサイズ計算用パラメータ
  CARD: {
    ASPECT_RATIO: 1.4,        // カードの縦横比 (高さ / 幅)
    MAX_ROWS_IN_HALF: 5.2,    // 画面半分に縦に何枚分収めるか (高さ計算の基準)
    MAX_COLS_ON_SCREEN: 8.5,  // 画面横幅に何枚分収めるか (幅計算の基準)
    SCALE_ADJUST: 1.4,        // 幅基準で計算した際の高さ補正係数
  },
  // 配置・余白設定
  SPACING: {
    V_GAP_RATIO: 0.30,        // カード高さに対する垂直方向のギャップ比率
    TURN_END_BTN_X_OFFSET: 100, // ターン終了ボタンの右端からのオフセット
  },
  // 各ゾーンの詳細配置
  FIELD: { GAP: 35, X_OFFSET: 20 },
  HAND: { X_START_RATIO: 0.08, OVERLAP_RATIO: 1.2 },
  ROWS: { ROW1_Y_OFFSET: 0.2, DEFAULT_MULTIPLIER: 0.55 },
  X_RATIOS: {
    LIFE: 0.15, 
    LEADER: 0.43, 
    STAGE: 0.65, 
    
    // デッキとトラッシュを同じX位置（0.90）に配置
    DECK: 0.90, 
    TRASH: 0.90, 
    
    DON_DECK: 0.15, 
    DON_ACTIVE: 0.38, 
    DON_REST: 0.60,
  }
} as const;
