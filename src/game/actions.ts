import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid'; 
import { apiClient } from '../api/client';
import type { GameActionRequest, ActionType, BattleActionRequest, PendingRequest } from '../api/types';
import type { GameState } from './types';
import { logger } from '../utils/logger';

export const useGameAction = (
  playerId: string, 
  setGameState: (state: GameState) => void,
  setPendingRequest: (req: PendingRequest | null) => void,
  pendingRequest: PendingRequest | null
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
    if (!gameId || !pendingRequest?.player_id) return;
    setIsPending(true);
    
    const targetPlayerId = pendingRequest.player_id;
    logger.log({
      level: 'info',
      action: 'game.sendAction',
      msg: 'Sending action to server',
      payload: { type, targetPlayerId }
    });

    try {
      const result = await apiClient.sendAction(gameId, {
        request_id: uuidv4(),
        action_type: type,
        player_id: targetPlayerId,
        ...payload
      });
      setGameState(result.game_state);
      setPendingRequest(result.pending_request || null);
    } catch (e: any) {
      if (e.game_state || e.pending_request) {
        setGameState(e.game_state);
        setPendingRequest(e.pending_request || null);
      }
      setErrorToast(`アクション失敗: ${e.message}`);
    } finally {
      setIsPending(false);
    }
  }, [gameId, pendingRequest, setGameState, setPendingRequest]);

  const sendBattleAction = useCallback(async (
    actionType: BattleActionRequest['action_type'],
    cardUuid?: string,
    requestId?: string
  ) => {
    if (!gameId || !pendingRequest?.player_id) return;
    setIsPending(true);

    const targetPlayerId = pendingRequest.player_id;
    logger.log({
      level: 'info',
      action: 'game.sendBattleAction',
      msg: 'Sending battle action to server',
      payload: { actionType, targetPlayerId }
    });

    try {
      const result = await apiClient.sendBattleAction({
        game_id: gameId,
        player_id: targetPlayerId,
        action_type: actionType,
        card_uuid: cardUuid,
        request_id: requestId || uuidv4()
      });
      setGameState(result.game_state);
      setPendingRequest(result.pending_request || null);
    } catch (e: any) {
      if (e.game_state) {
        setGameState(e.game_state);
      }
      if (e.pending_request !== undefined) {
        setPendingRequest(e.pending_request || null);
      }
      setErrorToast(`バトルアクション失敗: ${e.message}`);
    } finally {
      setIsPending(false);
    }
  }, [gameId, pendingRequest, setGameState, setPendingRequest]);

  return { sendAction, sendBattleAction, startGame, gameId, isPending, errorToast, setErrorToast };
};
