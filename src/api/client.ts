import type { GameActionRequest } from './types';
import type { GameState } from '../game/types';
import CONST from '../../shared_constants.json';

const BASE_URL = 'https://opcg-sim-backend-282430682904.asia-northeast1.run.app';

export const apiClient = {
  // ヘルスチェック
  async checkHealth(): Promise<void> {
    const res = await fetch(`${BASE_URL}/health`);
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  },

  // ゲーム開始
  async createGame(p1Deck: string, p2Deck: string): Promise<{ game_id: string; state: GameState }> {
    const res = await fetch(`${BASE_URL}/api/game/create`, {
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
    const stateKey = CONST.API_ROOT_KEYS.GAME_STATE as keyof typeof data;
    const newState = data[stateKey] || data.state;
    
    if (!newState) throw new Error("Invalid Response Schema");
    return { game_id: data.game_id, state: newState };
  },

  // アクション送信
  async sendAction(gameId: string, request: GameActionRequest): Promise<GameState> {
    const response = await fetch(`${BASE_URL}/api/game/${gameId}/action`, {
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
