/**
 * ゲームロジック・UI制御パラメータ
 * 判定時間などの「さじ加減」を調整する場合はここを修正します。
 */
export const GAME_UI_CONFIG = {
  // インタラクション判定
  INTERACTION: {
    LONG_PRESS_DURATION: 500, // 長押しと判定する時間 (ms)
  },

  // 表示関連
  FEEDBACK: {
    ERROR_TOAST_AUTO_CLOSE: 3000, // トーストを自動で閉じる場合の時間 (ms)
  }
  
  // システムテキスト
  TEXT: {
    BACK_SIDE: "ONE\nPIECE",
    LIFE_LABEL: "Life",
    DECK_LABEL: "Deck",
    DON_LABEL: "DON!!",
    TRASH_LABEL: "Trash",
    CONNECTING: "Connecting to Fleet Server...",
    CLOUD_REGION: "Cloud Run: asia-northeast1"
  }
 } as const;