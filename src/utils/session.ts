import CONST from '../../shared_constants.json';

/**
 * バックエンドと同期するセッションID（トレースID）を管理
 */
let currentSessionId: string = 'unknown';

export const sessionManager = {
  /**
   * HTTPヘッダー（X-Session-ID）から取得した値をセット
   */
  setSessionId: (id: string) => {
    currentSessionId = id;
  },

  /**
   * ロガーやAPIクライアントで使用する現在のIDを取得
   */
  getSessionId: () => currentSessionId
};
