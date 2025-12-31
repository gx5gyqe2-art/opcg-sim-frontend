export const LAYOUT_CONSTANTS = {
  // 色定義: PIXI.js (0xRRGGBB) および DOM/CSS (文字列) で使用
  COLORS: {
    // --- PIXI (Canvas) 用の数値カラー定義 (0xRRGGBB) ---
    APP_BG: 0x1a1a1a,          // アプリ全体の背景色 (黒に近いグレー)
    PLAYER_BG: 0xE8F5E9,       // 自分のフィールドの背景色 (薄い緑)
    OPPONENT_BG: 0xFFEBEE,     // 相手のフィールドの背景色 (薄い赤)
    CONTROL_BG: 0xF5F5F5,      // 操作パネル背景色 (薄いグレー)
    ZONE_BORDER: 0xCCCCCC,     // カード配置ゾーンの枠線色
    ZONE_FILL: 0xFFFFFF,       // カード配置ゾーンの塗りつぶし色 (白)
    CARD_BACK: 0x2C3E50,       // カード裏面の色 (紺色)
    
    // テキスト色 (PIXI描画用)
    TEXT_POWER: 0xFF0000,      // パワー値の文字色 (赤)
    TEXT_DEFAULT: 0x333333,    // 一般的なテキスト色 (濃いグレー)
    TEXT_RESOURCE: 0x000000,   // リソース名(Deck, Trash等)の文字色 (黒)
    TEXT_LIGHT: 0xFFFFFF,      // 暗い背景上の文字色 (白)
    TEXT_COUNTER: 0xe67e22,    // カウンター値(+1000等)の文字色 (オレンジ)
    
    // バッジ背景・文字色 (PIXI描画用)
    BADGE_BG: 0x000000,        // 汎用バッジ背景 (黒)
    BADGE_TEXT: 0xFFFFFF,      // 汎用バッジ文字色 (白)
    BADGE_COST_BG: 0x2c3e50,   // コスト表示バッジの背景
    BADGE_DON_BG: 0x9370DB,    // ドン!!付与数バッジの背景 (紫)

    // 装飾・マスク用 (PIXI描画用)
    MASK_FILL: 0xffffff,       // 手札エリアのマスク用塗りつぶし色
    BORDER_LINE: 0x000000,     // 盤面中央の境界線色
    
    // --- DOM (HTML/CSS) 用のカラー文字列定義 ---
    // UIオーバーレイ・通知・モーダル背景
    OVERLAY_ATTACK_BG: 'rgba(231, 76, 60, 0.9)',    // 攻撃対象選択時の赤帯背景
    OVERLAY_INFO_BG: 'rgba(0,0,0,0.8)',             // 情報通知の黒背景
    OVERLAY_MODAL_BG: 'rgba(0,0,0,0.5)',            // モーダル表示時の全画面黒透過背景
    OVERLAY_BORDER_HIGHLIGHT: '#f1c40f',            // 強調表示用の枠線色 (黄色)

    // 詳細画面のバッジ背景
    BADGE_ATTR: '#c0392b',     // 属性(Attribute)バッジの背景 (赤系)
    BADGE_TRAIT: '#34495e',    // 特徴(Trait)バッジの背景 (紺系)
    BADGE_LOC: '#333333',      // 場所(Hand, Trash等)バッジの背景 (黒系)
    
    // ボタン色 (CSSスタイル適用)
    BTN_PRIMARY: '#3498db',    // 主要アクション (青)
    BTN_DANGER: '#e74c3c',     // 危険・攻撃アクション (赤)
    BTN_SUCCESS: '#2ecc71',    // 肯定・登場アクション (緑)
    BTN_WARNING: '#f1c40f',    // 注意・ドン付与アクション (黄)
    BTN_SECONDARY: '#95a5a6',  // サブアクション・キャンセル (グレー)
    BTN_DISABLED: '#95a5a6',   // 無効状態 (グレー)
    
    // エラー画面 (ErrorBoundary) 用
    ERROR_SCREEN_BG: '#330000',     // エラー画面背景 (濃い赤)
    ERROR_SCREEN_TEXT: '#ffaaaa',   // エラーメッセージ文字色
    ERROR_SCREEN_TITLE: '#ff5555',  // エラータイトル文字色
    
    // ログ出力用カラースタイル (Chrome DevTools等)
    LOG_DEBUG: '#7f8c8d',
    LOG_INFO: '#2ecc71',
    LOG_WARN: '#f1c40f',
    LOG_ERROR: '#e74c3c',
    LOG_SUMMARY: '#ffffff',
  },

  // サイズ定義: フォントやレイアウトの基準値
  SIZES: {
    H_CTRL: 80,          // コントロールエリアの高さ (現状未使用の可能性あり)
    MARGIN_TOP: 20,      // 盤面上部のマージン (px)
    MARGIN_BOTTOM: 20,   // 盤面下部のマージン (px)
    
    // フォントサイズ (px)
    FONT_COST: 10,           // コスト表示
    FONT_COUNTER: 9,         // カウンター値
    FONT_POWER: 11,          // パワー値
    FONT_NAME_RESOURCE: 11,  // デッキ・トラッシュ等の名称
    FONT_NAME_NORMAL: 9,     // 通常カード名称
    FONT_DON: 10,            // 付与ドン数
    FONT_BACK: 8,            // 裏面テキスト
    FONT_COUNT: 12,          // 枚数バッジ
  }
} as const;

export const LAYOUT_PARAMS = {
  // カード・グリッド計算設定
  CARD: {
    ASPECT_RATIO: 1.4,        // カードの縦横比 (高さ / 幅)
    MAX_ROWS_IN_HALF: 5.2,    // 画面半分(自陣)に縦に何枚分収めるか (高さ計算の基準)
    MAX_COLS_ON_SCREEN: 8.5,  // 画面横幅に何枚分収めるか (幅計算の基準)
    SCALE_ADJUST: 1.4,        // 幅基準で計算した際のスケール補正係数
  },

  // 配置・余白設定
  SPACING: {
    V_GAP_RATIO: 0.30,          // カード高さに対する垂直方向のギャップ比率
    TURN_END_BTN_X_OFFSET: 100, // ターン終了ボタンの右端からの距離 (px)
  },
  
  // UI詳細配置・サイズ (カード内部やモーダル)
  UI_DETAILS: {
    // カード描画関連
    CARD_BADGE_OFFSET: 10,      // 左上/右下からのバッジ中心位置オフセット (px)
    CARD_BADGE_DON_OFFSET: 8,   // ドン付与バッジのオフセット (px)
    CARD_TEXT_PADDING_X: 6,     // テキストの横方向余白 (px)
    CARD_TEXT_PADDING_Y: 12,    // テキストの縦方向余白 (px)
    CARD_TEXT_MAX_WIDTH_RATIO: 1.1, // テキスト最大幅の係数 (カード幅に対する比率)
    
    // モーダル・サムネイル関連
    MODAL_MAX_WIDTH: '500px',   // 詳細シートの最大幅
    THUMBNAIL_WIDTH: '80px',    // リスト表示時のサムネイル幅
    THUMBNAIL_HEIGHT: '110px',  // リスト表示時のサムネイル高さ
  },

  // 重なり順 (Z-Index)
  Z_INDEX: {
    NOTIFICATION: 100,  // 通知メッセージ、ターン終了ボタン
    OVERLAY: 110,       // 攻撃対象選択オーバーレイ
    SHEET: 2000,        // カード詳細シート (最前面)
  },

  // 形状・線のスタイル
  SHAPE: {
    CORNER_RADIUS_CARD: 6,         // カードの角丸 (px)
    CORNER_RADIUS_BADGE: 9,        // 丸バッジの半径 (px)
    CORNER_RADIUS_BTN: 12,         // ボタンの角丸 (px)
    CORNER_RADIUS_MODAL: '20px 20px 0 0', // モーダル上部の角丸 (CSS形式)
    CORNER_RADIUS_SHEET_BADGE: '4px',     // 詳細シート内バッジの角丸
    STROKE_WIDTH_ZONE: 2,          // ゾーン枠線の太さ (px)
  },

  // 物理挙動・操作設定
  PHYSICS: {
    HAND_FRICTION: 0.92,       // 手札スクロールの摩擦係数 (1に近いほど滑る)
    HAND_EASE: 0.2,            // 手札スクロールの追従速度係数
    HAND_BOUNCE: 0.5,          // 端に達したときの跳ね返り係数
    HAND_DRAG_PADDING: 20,     // 手札ドラッグ時の末尾余白 (px)
    TAP_THRESHOLD: 10,         // タップとみなす指の移動許容量 (px)
  },

  // 透明度 (Alpha/Opacity)
  ALPHA: {
    BADGE_BG: 0.9,       // コスト/ドンバッジ背景の透明度
    BADGE_COUNT: 0.8,    // 枚数バッジ背景の透明度
    BORDER_LINE: 0.3,    // 中央境界線の透明度
  },

  // 時間・タイミング設定 (ms)
  TIMING: {
    TOAST_DURATION: 3000, // トースト通知の表示時間
    LONG_PRESS: 500,      // 長押し判定時間
  },

  // 影の設定 (CSS Box-Shadow文字列)
  SHADOWS: {
    MODAL: '0 -4px 16px rgba(0,0,0,0.2)', // 詳細シートの影
  },

  // 各ゾーンの配置座標比率 (画面幅に対する割合 0.0 ~ 1.0)
  // レイアウトエンジン (layoutEngine.ts) で使用
  FIELD: { GAP: 35, X_OFFSET: 20 }, // フィールドカード間のギャップ(px)とXオフセット
  HAND: { X_START_RATIO: 0.08, OVERLAP_RATIO: 1.2 }, // 手札開始位置と重なり率
  ROWS: { ROW1_Y_OFFSET: 0.2, DEFAULT_MULTIPLIER: 0.55 }, // 行配置の計算係数
  
  X_RATIOS: {
    LIFE: 0.15,       // ライフ置き場
    LEADER: 0.43,     // リーダーカード
    STAGE: 0.65,      // ステージカード
    DECK: 0.90,       // デッキ
    TRASH: 0.90,      // トラッシュ (デッキと同じX座標)
    DON_DECK: 0.15,   // ドン!!デッキ
    DON_ACTIVE: 0.38, // アクティブドン!!
    DON_REST: 0.60,   // レストドン!!
  }
} as const;
