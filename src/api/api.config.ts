/**
 * API通信関連のパラメータ
 * 接続先サーバーやエンドポイントを変更する場合はここを修正します。
 */
export const API_CONFIG = {
  // 接続先
  BASE_URL: 'https://opcg-sim-backend-282430682904.asia-northeast1.run.app',
  
  // エンドポイント定義
  ENDPOINTS: {
    HEALTH: '/health',
    CREATE_GAME: '/api/game/create',
    ACTION: (gameId: string) => `/api/game/${gameId}/action`
  },

  // デフォルト設定
  DEFAULT_GAME_SETTINGS: {
    P1_DECK: "imu.json",
    P2_DECK: "nami.json"
  }
} as const;
