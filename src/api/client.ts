import type { GameActionRequest } from './types';
import type { GameState } from '../game/types';
import { API_CONFIG } from './api.config';
import CONST from '../../shared_constants.json';
import { logger } from '../utils/logger'; 
import { sessionManager } from '../utils/session'; // ★追加

const { BASE_URL, ENDPOINTS, DEFAULT_GAME_SETTINGS } = API_CONFIG;

export const apiClient = {
  /** サーバーの生存確認 */
  async checkHealth(): Promise<void> {
    const res = await fetch(`${BASE_URL}${ENDPOINTS.HEALTH}`);
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
    
    logger.log({
      level: 'debug',
      action: 'api.health_check',
      msg: 'Server is alive'
    });
  },

  /** ゲームの新規作成 */
  async createGame(
    p1Deck = DEFAULT_GAME_SETTINGS.P1_DECK, 
    p2Deck = DEFAULT_GAME_SETTINGS.P2_DECK
  ): Promise<{ game_id: string; state: GameState }> {
    const res = await fetch(`${BASE_URL}${ENDPOINTS.CREATE_GAME}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p1_deck: p1Deck,
        p2_deck: p2Deck,
        p1_name: CONST.PLAYER_KEYS.P1,
        p2_name: CONST.PLAYER_KEYS.P2
      }),
    });

    // ★レスポンスヘッダーから Session ID を取得して同期
    const sid = res.headers.get('X-Session-ID');
    if (sid) {
      sessionManager.setSessionId(sid);
    }

    const data = await res.json();

// ここに詳細ログを追加
logger.log({
  level: 'info',
  action: 'api.receive_create_detail',
  msg: 'Full payload check',
  payload: {
    has_game_state: !!data.game_state,
    p1_zones: data.game_state?.players?.p1?.zones, // ここに zones があるか確認
    p1_hand: data.game_state?.players?.p1?.hand,   // または直下にあるか確認
  }
});


    const stateKey = CONST.API_ROOT_KEYS.GAME_STATE as keyof typeof data;
    const newState = data[stateKey] || data.state;
    
    if (!newState) {
      logger.log({
        level: 'error',
        action: 'api.schema_error',
        msg: `Key "${String(stateKey)}" not found in response`
      });
      throw new Error("Invalid Response Schema");
    }

    return { game_id: data.game_id, state: newState };
  },

  /** プレイヤーのアクションを送信 */
  async sendAction(gameId: string, request: GameActionRequest): Promise<GameState> {
    const response = await fetch(`${BASE_URL}${ENDPOINTS.ACTION(gameId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    const result = await response.json();

    logger.log({
      level: 'info',
      action: 'api.receive_action',
      msg: `Action processed`, 
      payload: result
    });

    const stateKey = CONST.API_ROOT_KEYS.GAME_STATE as keyof typeof result;
    const nextState = result[stateKey] || result.state;

    if (!response.ok || !nextState) throw new Error("Action failed");
    return nextState;
  }
};
