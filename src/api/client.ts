import type { GameActionRequest } from './types';
import type { GameState } from '../game/types';
import { API_CONFIG } from './api.config';
import CONST from '../../shared_constants.json';

const { BASE_URL, ENDPOINTS, DEFAULT_GAME_SETTINGS } = API_CONFIG;

export const apiClient = {
  /** サーバーの生存確認 */
  async checkHealth(): Promise<void> {
    const res = await fetch(`${BASE_URL}${ENDPOINTS.HEALTH}`);
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
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

    const data = await res.json();
    // shared_constants.json を参照してステートを抽出
    const stateKey = CONST.API_ROOT_KEYS.GAME_STATE as keyof typeof data;
    const newState = data[stateKey] || data.state;
    
    if (!newState) throw new Error("Invalid Response Schema");
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
    const stateKey = CONST.API_ROOT_KEYS.GAME_STATE as keyof typeof result;
    const nextState = result[stateKey] || result.state;

    if (!response.ok || !nextState) throw new Error("Action failed");
    return nextState;
  }
};
