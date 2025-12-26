import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid'; 
import type { GameActionRequest, ActionType } from '../types/api';
import type { GameState } from '../types/game';
// 共通定数のインポート
import CONST from '../../shared_constants.json';

const BASE_URL = 'https://opcg-sim-backend-282430682904.asia-northeast1.run.app';

export const useGameAction = (
  playerId: string, 
  setGameState: (state: GameState) => void
) => {
  const [isPending, setIsPending] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${BASE_URL}/health`);
        if (res.ok) console.log("[API] Health Check Success.");
        else throw new Error(`Health check failed: ${res.status}`);
      } catch (e: any) {
        setErrorToast(`サーバーに接続できません: ${e.message}`);
      }
    };
    checkHealth();
  }, []);

  const startGame = useCallback(async () => {
    setIsPending(true);
    try {
      const res = await fetch(`${BASE_URL}/api/game/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p1_deck: "imu.json",
          p2_deck: "nami.json",
          p1_name: CONST.PLAYER_KEYS.P1, // "Player 1"
          p2_name: CONST.PLAYER_KEYS.P2
        }),
      });
      const data = await res.json();
      
      // 定義されたルートキーを最優先で参照
      const newState = data[CONST.API_ROOT_KEYS.GAME_STATE] || data.state;
      
      if (data.success && newState) {
        setGameId(data.game_id);
        setGameState(newState);
        console.log("[API] GameState synchronized using shared constants.");
      } else {
        throw new Error(data.error?.message || "Invalid Response Schema");
      }
    } catch (e: any) {
      setErrorToast(`ゲーム開始エラー: ${e.message}`);
    } finally {
      setIsPending(false);
    }
  }, [setGameState]);

  const sendAction = useCallback(async (
    type: ActionType, 
    payload: Omit<GameActionRequest, 'request_id' | 'action_type' | 'player_id'>
  ) => {
    if (!gameId) return;
    setIsPending(true);

    const request: GameActionRequest = {
      request_id: uuidv4(),
      action_type: type,
      player_id: playerId as any,
      ...payload
    };

    try {
      const response = await fetch(`${BASE_URL}/api/game/${gameId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      const result = await response.json();
      const nextState = result[CONST.API_ROOT_KEYS.GAME_STATE] || result.state;

      if (!response.ok || !result.success || !nextState) {
        throw new Error(result.error?.message || "Action failed");
      }
      setGameState(nextState);
    } catch (e: any) {
      setErrorToast(`アクション失敗: ${e.message}`);
    } finally {
      setIsPending(false);
    }
  }, [gameId, playerId, setGameState]);

  return { sendAction, startGame, gameId, isPending, errorToast, setErrorToast };
};
