import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid'; 
import { apiClient } from '../api/client';
import type { GameActionRequest, ActionType, BattleActionRequest, PendingRequest } from '../api/types';
import type { GameState } from './types';

export const useGameAction = (
  playerId: string, 
  setGameState: (state: GameState) => void,
  setPendingRequest: (req: PendingRequest | null) => void
) => {
  const [isPending, setIsPending] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [currentRequest, setCurrentRequest] = useState<PendingRequest | null>(null);

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
      const result = await apiClient.sendAction(gameId, {
        request_id: uuidv4(),
        action_type: type,
        player_id: playerId as any,
        ...payload
      });
      setGameState(result.game_state);
      setPendingRequest(result.pending_request || null);
      setCurrentRequest(result.pending_request || null);
    } catch (e: any) {
      setErrorToast(`アクション失敗: ${e.message}`);
    } finally {
      setIsPending(false);
    }
  }, [gameId, playerId, setGameState, setPendingRequest]);

  const sendBattleAction = useCallback(async (
    actionType: BattleActionRequest['action_type'],
    cardUuid?: string,
    requestId?: string
  ) => {
    if (!gameId) return;
    setIsPending(true);
    try {
      const result = await apiClient.sendBattleAction({
        game_id: gameId,
        player_id: currentRequest?.player_id || playerId,
        action_type: actionType,
        card_uuid: cardUuid,
        request_id: requestId || uuidv4()
      });
      setGameState(result.game_state);
      setPendingRequest(result.pending_request || null);
      setCurrentRequest(result.pending_request || null);
    } catch (e: any) {
      setErrorToast(`バトルアクション失敗: ${e.message}`);
    } finally {
      setIsPending(false);
    }
  }, [gameId, playerId, currentRequest, setGameState, setPendingRequest]);

  return { sendAction, sendBattleAction, startGame, gameId, isPending, errorToast, setErrorToast };
};
