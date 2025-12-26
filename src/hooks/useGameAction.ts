import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid'; 
import type { GameActionRequest, ActionType } from '../types/api';
import type { GameState } from '../types/game';

const BASE_URL = 'https://opcg-sim-backend-282430682904.asia-northeast1.run.app';

export const useGameAction = (
  playerId: string, 
  setGameState: (state: GameState) => void
) => {
  const [isPending, setIsPending] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);

  // 1. 疎通確認（Health Check）
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${BASE_URL}/health`);
        if (res.ok) {
          console.log("[API] Health Check Success.");
        } else {
          throw new Error(`Health check failed: ${res.status}`);
        }
      } catch (e: any) {
        setErrorToast(`サーバーに接続できません: ${e.message}`);
      }
    };
    checkHealth();
  }, []);

  // 2. ゲーム開始 (POST /api/game/create)
  const startGame = useCallback(async () => {
    setIsPending(true);
    try {
      const res = await fetch(`${BASE_URL}/api/game/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p1_deck: "imu.json",
          p2_deck: "nami.json",
          p1_name: "Player 1",
          p2_name: "Player 2"
        }),
      });
      const data = await res.json();
      
      // v1.4 スキーマ対応: game_state キーを優先的に取得
      const newState = data.game_state || data.state;
      
      if (data.success && newState) {
        setGameId(data.game_id);
        setGameState(newState);
        console.log("[API] GameState initialized:", newState.game_id);
      } else {
        throw new Error(data.error?.message || "Invalid Response Schema");
      }
    } catch (e: any) {
      setErrorToast(`ゲーム開始エラー: ${e.message}`);
    } finally {
      setIsPending(false);
    }
  }, [setGameState]);

  // 3. アクション送信 (POST /api/game/{gameId}/action)
  const sendAction = useCallback(async (
    type: ActionType, 
    payload: Omit<GameActionRequest, 'request_id' | 'action_type' | 'player_id'>
  ) => {
    if (!gameId) return;
    setIsPending(true);
    setErrorToast(null);

    const request: GameActionRequest = {
      request_id: uuidv4(),
      action_type: type,
      player_id: playerId as "p1" | "p2",
      ...payload
    };

    try {
      const response = await fetch(`${BASE_URL}/api/game/${gameId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      const result = await response.json();
      
      // レスポンスから最新の盤面状態を抽出
      const nextState = result.game_state || result.state;

      if (!response.ok || !result.success || !nextState) {
        throw new Error(result.error?.message || `HTTP ${response.status}`);
      }

      setGameState(nextState);
    } catch (e: any) {
      console.error(e);
      setErrorToast(`通信失敗: ${e.message}`);
    } finally {
      setIsPending(false);
    }
  }, [gameId, playerId, setGameState]);

  return { sendAction, startGame, gameId, isPending, errorToast, setErrorToast };
};
