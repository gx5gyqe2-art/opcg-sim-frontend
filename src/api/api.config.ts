/**
 * API通信関連のパラメータ
 */
export const API_CONFIG = {
  // 接続先 (Cloud RunのURL)
  BASE_URL: 'https://opcg-sim-backend-282430682904.asia-northeast1.run.app',
  
  // ▼▼▼ 追加: 画像の保存先 (作成したバケット名に書き換えてください) ▼▼▼
  // 例: https://storage.googleapis.com/opcg-images-caramel
  IMAGE_BASE_URL: 'https://storage.googleapis.com/opcg-images', 
  // ▲▲▲ 追加ここまで ▲▲▲

  // エンドポイント定義
  ENDPOINTS: {
    HEALTH: '/health',
    CREATE_GAME: '/api/game/create',
    ACTION: '/api/game/action'
  },

  DEFAULT_GAME_SETTINGS: {
    P1_DECK: "imu.json",
    P2_DECK: "nami.json"
  }
} as const;
