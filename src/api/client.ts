import type { GameActionRequest, BattleActionRequest, GameActionResult } from './types';
import type { GameState } from '../game/types';
import { API_CONFIG } from './api.config';
import CONST from '../../shared_constants.json';
import { logger } from '../utils/logger';
import { sessionManager } from '../utils/session';

const { BASE_URL, ENDPOINTS, DEFAULT_GAME_SETTINGS } = API_CONFIG;

const fetchWithLog = async (url: string, options: RequestInit = {}) => {
  const sid = sessionManager.getSessionId();
  const headers = {
    ...options.headers,
    'X-Session-ID': sid,
    'Content-Type': 'application/json',
  };

  const res = await fetch(url, { ...options, headers });

  if (import.meta.env.DEV) {
    const logRes = res.clone();
    console.group(`%cAPI Response: ${url}`, `color: ${res.ok ? '#2ecc71' : '#e74c3c'}; font-weight: bold;`);
    console.log('Status:', res.status);
    try {
      const data = await logRes.json();
      console.table(data);
    } catch {
      console.log('Data: (not json)');
    }
    console.groupEnd();
  }

  return res;
};

export const apiClient = {
  async checkHealth(): Promise<void> {
    const res = await fetchWithLog(`${BASE_URL}${ENDPOINTS.HEALTH}`);
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  },

  async createGame(
    p1Deck = DEFAULT_GAME_SETTINGS.P1_DECK,
    p2Deck = DEFAULT_GAME_SETTINGS.P2_DECK
  ): Promise<{ game_id: string; state: GameState; pending_request?: any }> {
    const res = await fetchWithLog(`${BASE_URL}${ENDPOINTS.CREATE_GAME}`, {
      method: 'POST',
      body: JSON.stringify({
        p1_deck: p1Deck,
        p2_deck: p2Deck,
        p1_name: CONST.PLAYER_KEYS.P1,
        p2_name: CONST.PLAYER_KEYS.P2
      }),
    });

    const data = await res.json();
    
    if (!res.ok) {
      logger.error('api.create_game', 'Failed to create game', { response: data });
      throw new Error("Failed to create game");
    }

    const oldSid = sessionManager.getSessionId();
    const GAME_ID_KEY = CONST.API_ROOT_KEYS.GAME_ID;
    const gameId = data[GAME_ID_KEY] || (data[CONST.API_ROOT_KEYS.GAME_STATE] as any)?.[GAME_ID_KEY];
    
    if (gameId) {
      sessionManager.setSessionId(gameId);
      if (oldSid !== gameId) {
        logger.log({
          level: 'info',
          action: 'session.updated',
          msg: `Session ID updated from ${oldSid} to ${gameId}`,
          payload: { old: oldSid, new: gameId }
        });
      }
    }
    
    const stateKey = CONST.API_ROOT_KEYS.GAME_STATE as keyof typeof data;
    const newState = data[stateKey];
    const pendingKey = CONST.API_ROOT_KEYS.PENDING_REQUEST as keyof typeof data;
    const pendingRequest = data[pendingKey];

    return { 
      game_id: gameId, 
      state: newState, 
      pending_request: pendingRequest 
    };
  },


  async sendAction(gameId: string, request: GameActionRequest): Promise<GameActionResult> {
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

    const response = await fetchWithLog(`${BASE_URL}/api/game/action`, {
      method: 'POST',
      body: JSON.stringify(actionBody),
    });

    const result = await response.json();
    const oldSid = sessionManager.getSessionId();
    
    // 定数を使って game_id を取得
    const GAME_ID_KEY = CONST.API_ROOT_KEYS.GAME_ID;
    const newGameId = result[GAME_ID_KEY] || result[CONST.API_ROOT_KEYS.GAME_STATE]?.[GAME_ID_KEY];

    if (newGameId) {
      sessionManager.setSessionId(newGameId);
      if (oldSid !== newGameId) {
        logger.log({
          level: 'info',
          action: 'session.updated',
          msg: `Session ID updated from ${oldSid} to ${newGameId}`,
          payload: { old: oldSid, new: newGameId }
        });
      }
    }

    if (!response.ok || !result[CONST.API_ROOT_KEYS.GAME_STATE]) {
      logger.error('api.send_action', 'Action failed', { request: actionBody, response: result });
      throw new Error("Action failed");
    }

    return {
      success: true,
      game_id: newGameId,
      game_state: result[CONST.API_ROOT_KEYS.GAME_STATE],
      pending_request: result.pending_request
    };
  },

  async sendBattleAction(request: BattleActionRequest): Promise<GameActionResult> {
    const response = await fetchWithLog(`${BASE_URL}/api/game/battle`, {
      method: 'POST',
      body: JSON.stringify(request),
    });

    const result = await response.json();
    
    if (!response.ok || !result[CONST.API_ROOT_KEYS.GAME_STATE]) {
      logger.error('api.send_battle_action', 'Battle action failed', { request, response: result });
      throw new Error(result.error?.message || "Battle action failed");
    }

    return {
      success: true,
      game_id: request.game_id,
      game_state: result[CONST.API_ROOT_KEYS.GAME_STATE],
      pending_request: result.pending_request
    };
  }
};
