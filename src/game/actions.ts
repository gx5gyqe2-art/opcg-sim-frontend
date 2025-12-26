import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid'; 
import { apiClient } from '../api/client';
import type { GameActionRequest, ActionType } from '../api/types';
import type { GameState } from './types';

export const useGameAction = (
  playerId: string, 
  setGameState: (state: GameState) => void
) => {
  const [isPending, setIsPending] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);

  useEffect(() => {
    apiClient.checkHealth().catch(e => setErrorToast(`サーバー接続エラー: ${e.message}`));
  }, []);

  const startGame = useCallback(async () => {
    setIsPending(true);
    try {
      const { game_id, state } = await apiClient.createGame("imu.json", "nami.json");
      setGameId(game_id);
      setGameState(state);
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
    try {
      const nextState = await apiClient.sendAction(gameId, {
        request_id: uuidv4(),
        action_type: type,
        player_id: playerId as any,
        ...payload
      });
      setGameState(nextState);
    } catch (e: any) {
      setErrorToast(`アクション失敗: ${e.message}`);
    } finally {
      setIsPending(false);
    }
  }, [gameId, playerId, setGameState]);

  return { sendAction, startGame, gameId, isPending, errorToast, setErrorToast };
};
