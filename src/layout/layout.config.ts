/**
 * レイアウト微調整用パラメータ
 * 座標計算のロジック（Engine）を触らずに、数値だけを調整するためのファイルです。
 */
export const LAYOUT_PARAMS = {
  // フィールド（キャラクター等）の配置
  FIELD: {
    GAP: 35,           // カード間の隙間
    X_OFFSET: 20,      // 横方向の微調整
  },
  
  // 手札の配置
  HAND: {
    X_START_RATIO: 0.08, // 画面左端からの開始位置（0.0〜1.0）
    OVERLAP_RATIO: 0.75,  // カード同士の重なり具合
  },

  // 縦方向（行）の配置倍率
  ROWS: {
    ROW1_Y_OFFSET: 0.2,     // 1行目（フィールド等）
    DEFAULT_MULTIPLIER: 0.55 // 2行目以降の計算用オフセット
  },

  // 各ゾーンの横座標（画面幅に対する割合）
  X_RATIOS: {
    LIFE: 0.15,
    LEADER: 0.43,
    STAGE: 0.65,
    DECK: 0.85,
    DON_DECK: 0.15,
    DON_ACTIVE: 0.38,
    DON_REST: 0.60,
    TRASH: 0.85
  }
  
  // カードの描画詳細
  CARD_STYLE: {
    CORNER_RADIUS: 6,      // 角丸
    BORDER_WIDTH: 2,       // 枠線の太さ
    FONT_SIZE: {
      POWER: 11,           // パワー表示
      NAME: 9,             // 名前（通常）
      NAME_RESOURCE: 11,    // 名前（DON!!等）
      COUNTER: 8,          // カウンター
      ATTRIBUTE: 7,        // 属性
      COST: 8,             // コスト
      BACK: 8              // 裏面の「ONE PIECE」
    },
    BADGE: {
      RADIUS: 9,           // 枚数バッジの半径
      OFFSET: 2,           // バッジの余白
      FONT_SIZE: 9         // バッジ内の数字
    },
    OFFSET: {
      POWER_Y: 10,         // パワー表示の垂直オフセット
      NAME_Y: 2,           // 名前表示の垂直オフセット
      COUNTER_X: 8,        // カウンターの水平位置
      ATTR_MARGIN: 4,      // 属性表示の端からの距離
      COST_POS: 10,        // コスト円の中心位置
      COST_RADIUS: 7,      // コスト円の半径
      ATTACHED_DON: 6      // ドン付与時のズレ幅
    }
  }
} as const;
