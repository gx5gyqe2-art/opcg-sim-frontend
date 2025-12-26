import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid'; 

// 変更前: import type { GameActionRequest, ActionType } from '../types/api';
import type { GameActionRequest, ActionType } from '../api/types';

// 変更前: import type { GameState } from '../types/game';
import type { GameState } from './types'; // 同階層

// 変更前: import CONST from '../../shared_constants.json';
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
          p1_name: CONST.PLAYER_KEYS.P1, 
          p2_name: CONST.PLAYER_KEYS.P2
        }),
      });
      const data = await res.json();
      
      // 型安全なキー参照
      const stateKey = CONST.API_ROOT_KEYS.GAME_STATE as keyof typeof data;
      const newState = data[stateKey] || data.state;
      
      if (newState) {
        setGameId(data.game_id);
        setGameState(newState);
      } else {
        throw new Error("Invalid Response Schema");
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
      const stateKey = CONST.API_ROOT_KEYS.GAME_STATE as keyof typeof result;
      const nextState = result[stateKey] || result.state;

      if (!response.ok || !nextState) {
        throw new Error("Action failed");
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
