import type { GameActionRequest } from './types';
import type { GameState } from '../game/types';
import { API_CONFIG } from './api.config'; // 追加
import CONST from '../../shared_constants.json';

const { BASE_URL, ENDPOINTS, DEFAULT_GAME_SETTINGS } = API_CONFIG;

export const apiClient = {
  async checkHealth(): Promise<void> {
    const res = await fetch(`${BASE_URL}${ENDPOINTS.HEALTH}`);
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  },

  async createGame(p1Deck = DEFAULT_GAME_SETTINGS.P1_DECK, p2Deck = DEFAULT_GAME_SETTINGS.P2_DECK): Promise<{ game_id: string; state: GameState }> {
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
    // ...以下、データ加工ロジックは不変
  },

  async sendAction(gameId: string, request: GameActionRequest): Promise<GameState> {
    const response = await fetch(`${BASE_URL}${ENDPOINTS.ACTION(gameId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    // ...以下、エラー判定ロジックは不変
  }
};
