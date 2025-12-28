import type { GameActionRequest } from './types';
import type { GameState } from '../game/types';
import { API_CONFIG } from './api.config';
import CONST from '../../shared_constants.json';
import { logger } from '../utils/logger'; 
import { sessionManager } from '../utils/session';

const { BASE_URL, ENDPOINTS, DEFAULT_GAME_SETTINGS } = API_CONFIG;

export const apiClient = {
  async checkHealth(): Promise<void> {
    const res = await fetch(`${BASE_URL}${ENDPOINTS.HEALTH}`);
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
    
    logger.log({
      level: 'debug',
      action: 'api.health_check',
      msg: 'Server is alive'
    });
  },

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

    const sid = res.headers.get('X-Session-ID');
    if (sid) {
      sessionManager.setSessionId(sid);
    }

    const data = await res.json();

    const stateKey = CONST.API_ROOT_KEYS.GAME_STATE as keyof typeof data;
    const newState = data[stateKey] || data.game_state;
    
    if (!newState) {
      throw new Error("Invalid Response Schema");
    }

    const finalGameId = data.game_id || (newState as any).game_id;
    return { game_id: finalGameId, state: newState };
  },

  async sendAction(gameId: string, request: GameActionRequest): Promise<GameState> {
    const actionBody = {
      game_id: gameId,
      player_id: request.player_id,
      action: request.action_type,
      payload: {
        uuid: request.card_id,
        target_uuid: request.target_ids?.[0],
        ...request.extra
      }
    };

    const response = await fetch(`${BASE_URL}/api/game/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(actionBody),
    });

    const result = await response.json();

    logger.log({
      level: 'info',
      action: 'api.receive_action',
      msg: `Action processed`, 
      payload: result
    });

    if (!response.ok || !result[CONST.API_ROOT_KEYS.GAME_STATE]) {
      throw new Error("Action failed");
    }

    return result[CONST.API_ROOT_KEYS.GAME_STATE];
  }
};
