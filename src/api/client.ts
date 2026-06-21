import type { GameActionRequest, BattleActionRequest, GameActionResult, PendingRequest, CpuStepResult } from './types';
import type { GameState } from '../game/types';
import { API_CONFIG } from './api.config';
import CONST from '../../shared_constants.json';
import { sessionManager } from '../utils/session';
import { recordApi } from '../utils/perfTrace';

const { BASE_URL, ENDPOINTS } = API_CONFIG;

const fetchWithLog = async (url: string, options: RequestInit = {}) => {
  const sid = sessionManager.getSessionId();
  const headers = {
    ...options.headers,
    'X-Session-ID': sid,
    'Content-Type': 'application/json',
  };

  // 計測（フェーズB）: API 応答時間を採取し、「サーバ応答待ちで進行が止まる」フリーズを切り分ける。
  // path はクエリを除いたエンドポイントのみ（集計をエンドポイント単位にするため）。
  const _t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const path = url.replace(BASE_URL, '').split('?')[0];
  try {
    const res = await fetch(url, { ...options, headers });
    recordApi({ t: Date.now(), path, ms: +((typeof performance !== 'undefined' ? performance.now() : Date.now()) - _t0).toFixed(1), ok: res.ok });
    return res;
  } catch (e) {
    recordApi({ t: Date.now(), path, ms: +((typeof performance !== 'undefined' ? performance.now() : Date.now()) - _t0).toFixed(1), ok: false });
    throw e;
  }
};

export const apiClient = {
  async checkHealth(): Promise<void> {
    const res = await fetchWithLog(`${BASE_URL}${ENDPOINTS.HEALTH}`);
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  },

  async createGame(
    p1Deck: string,
    p2Deck: string,
    // CPU 対戦オプション（未指定＝従来のソロ/ホットシート）。
    opts?: { vsCpu?: boolean; cpuDifficulty?: 'easy' | 'normal' | 'hard' | 'expert'; cpuDeck?: string },
    // 先行プレイヤー: ソロは 'p1'/'p2'（プレイヤーが選択）、CPU は 'random'（コイントス）。
    firstPlayer?: 'p1' | 'p2' | 'random'
  ): Promise<{ game_id: string; state: GameState; pending_request?: PendingRequest }> {
    const res = await fetchWithLog(`${BASE_URL}${ENDPOINTS.CREATE_GAME}`, {
      method: 'POST',
      body: JSON.stringify({
        p1_deck: p1Deck,
        p2_deck: p2Deck,
        p1_name: CONST.PLAYER_KEYS.P1,
        p2_name: CONST.PLAYER_KEYS.P2,
        ...(firstPlayer ? { first_player: firstPlayer } : {}),
        ...(opts?.vsCpu ? {
          vs_cpu: true,
          cpu_difficulty: opts.cpuDifficulty || 'normal',
          cpu_deck: opts.cpuDeck || p2Deck,
          // CPU 思考トレースを有効化（ログ採取ボタンで GET /api/game/{id}/replay から取得するため）。
          cpu_trace: true,
        } : {}),
      }),
    });

    const data = await res.json();
    
    const SUCCESS_KEY = CONST.API_ROOT_KEYS.SUCCESS || 'success';
    if (!res.ok || data[SUCCESS_KEY] === false) {
      const msg = data.error?.message || 'Failed to create game';
      throw new Error(msg);
    }

    const GAME_ID_KEY = CONST.API_ROOT_KEYS.GAME_ID;
    const gameId = data[GAME_ID_KEY] || data[CONST.API_ROOT_KEYS.GAME_STATE]?.[GAME_ID_KEY];

    if (gameId) {
      sessionManager.setSessionId(gameId);
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

  // ログ採取: CPU 思考トレース＋リプレイ種を取得する（cpu_trace=true で作成した対局のみ）。
  // 失敗・未対応（success:false）は null を返す（採取は最善努力で、無くても他データは出す）。
  async getReplay(gameId: string): Promise<{ replay: unknown; decisions: unknown[] } | null> {
    try {
      const res = await fetchWithLog(`${BASE_URL}/api/game/${gameId}/replay`, { method: 'GET' });
      const data = await res.json();
      if (!res.ok || data.success === false) return null;
      return { replay: data.replay, decisions: data.decisions || [] };
    } catch {
      return null;
    }
  },

  // CPU 対戦: CPU(p2) の次の 1 手を進める（ポーリング駆動）。
  async cpuStep(gameId: string): Promise<CpuStepResult> {
    const res = await fetchWithLog(`${BASE_URL}/api/game/cpu/step`, {
      method: 'POST',
      body: JSON.stringify({ game_id: gameId }),
    });
    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data.error?.message || 'CPU step failed');
    }
    return data as CpuStepResult;
  },

  async createSandboxGame(
    roomName?: string
  ): Promise<{ game_id: string; state: GameState }> {
    const res = await fetchWithLog(`${BASE_URL}/api/sandbox/create`, {
      method: 'POST',
      body: JSON.stringify({
        p1_name: "P1",
        p2_name: "P2",
        room_name: roomName
      }),
    });

    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data.error || 'Failed to create sandbox');
    }
    
    if (data.game_id) sessionManager.setSessionId(data.game_id);

    return {
      game_id: data.game_id,
      state: data.game_state
    };
  },

  async sendSandboxAction(
    gameId: string, 
    action: { 
      action_type: string; 
      card_uuid?: string; 
      dest_player_id?: string; 
      dest_zone?: string; 
      index?: number;
      player_id?: string;
      deck_id?: string;
    }
  ): Promise<{ success: boolean; state: GameState }> {
    const res = await fetchWithLog(`${BASE_URL}/api/sandbox/action`, {
      method: 'POST',
      body: JSON.stringify({
        game_id: gameId,
        ...action
      }),
    });
    
    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data.error || 'Sandbox action failed');
    }

    return {
      success: true,
      state: data.game_state
    };
  },

  // ルールモード・オンライン対戦: ルーム作成
  async createRuleRoom(roomName: string): Promise<{ game_id: string }> {
    const res = await fetchWithLog(`${BASE_URL}/api/rule/create`, {
      method: 'POST',
      body: JSON.stringify({ room_name: roomName }),
    });
    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data.error || 'Failed to create rule room');
    }
    return { game_id: data.game_id };
  },

  // ルールモード・オンライン対戦: ロビー操作（SET_DECK / START / KICK_PLAYER）
  async sendRuleAction(
    gameId: string,
    action: { action_type: string; player_id?: string; deck_id?: string; target_player_id?: string }
  ): Promise<{ success: boolean }> {
    const res = await fetchWithLog(`${BASE_URL}/api/rule/action`, {
      method: 'POST',
      body: JSON.stringify({ game_id: gameId, ...action }),
    });
    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data.error || 'Rule lobby action failed');
    }
    return { success: true };
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

    const GAME_ID_KEY = CONST.API_ROOT_KEYS.GAME_ID;
    const newGameId = result[GAME_ID_KEY] || result[CONST.API_ROOT_KEYS.GAME_STATE]?.[GAME_ID_KEY];

    if (newGameId) {
      sessionManager.setSessionId(newGameId);
    }

    const SUCCESS_KEY = CONST.API_ROOT_KEYS.SUCCESS || 'success';
    if (!response.ok || result[SUCCESS_KEY] === false || !result[CONST.API_ROOT_KEYS.GAME_STATE]) {
      const msg = result.error?.message || "Action failed";
      throw new Error(msg);
    }

    return {
      success: true,
      game_id: newGameId,
      game_state: result[CONST.API_ROOT_KEYS.GAME_STATE],
      pending_request: result.pending_request,
      action_events: result.action_events || [],
    };
  },

  async sendBattleAction(request: BattleActionRequest): Promise<GameActionResult> {
    const response = await fetchWithLog(`${BASE_URL}/api/game/battle`, {
      method: 'POST',
      body: JSON.stringify(request),
    });

    const result = await response.json();
    
    const SUCCESS_KEY = CONST.API_ROOT_KEYS.SUCCESS || 'success';
    if (!response.ok || result[SUCCESS_KEY] === false || !result[CONST.API_ROOT_KEYS.GAME_STATE]) {
      const msg = result.error?.message || "Battle action failed";
      throw new Error(msg);
    }

    return {
      success: true,
      game_id: request.game_id,
      game_state: result[CONST.API_ROOT_KEYS.GAME_STATE],
      pending_request: result.pending_request,
      action_events: result.action_events || [],
    };
  },

  // 読み取り専用の状態再取得（オンライン対戦で WS ブロードキャストを取りこぼした側が
  // 待機中に最新状態へ再同期するためのフォールバック）。盤面は変更しない。
  // 取得できなければ null を返す（呼び出し側はポーリング継続）。
  async fetchGameState(gameId: string): Promise<GameActionResult | null> {
    try {
      const response = await fetchWithLog(`${BASE_URL}/api/game/state?game_id=${encodeURIComponent(gameId)}`, {
        method: 'GET',
      });
      const result = await response.json();
      const SUCCESS_KEY = CONST.API_ROOT_KEYS.SUCCESS || 'success';
      if (!response.ok || result[SUCCESS_KEY] === false || !result[CONST.API_ROOT_KEYS.GAME_STATE]) {
        return null;
      }
      return {
        success: true,
        game_id: gameId,
        game_state: result[CONST.API_ROOT_KEYS.GAME_STATE],
        pending_request: result.pending_request,
        action_events: result.action_events || [],
      };
    } catch {
            return null;
          }
  }
};
