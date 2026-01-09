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

  // 【変更】引数でデッキIDを受け取るように修正
  const startGame = useCallback(async (p1Deck: string, p2Deck: string) => {
    setIsPending(true);
    try {
      // APIに選択されたデッキIDを渡す
      const { game_id, state, pending_request } = await apiClient.createGame(p1Deck, p2Deck);
      setGameId(game_id);
      setGameState(state);
      if (pending_request) {
        setPendingRequest(pending_request);
      }
    } catch (e: any) {
      setErrorToast(`ゲーム開始エラー: ${e.message}`);
    } finally {
      setIsPending(false);
    }
  }, [setGameState, setPendingRequest]);


  const sendAction = useCallback(async (
    type: ActionType, 
    payload: Omit<GameActionRequest, 'request_id' | 'action_type' | 'player_id'>
  ) => {
    if (!gameId) return;
    setIsPending(true);
    
    const targetPlayerId = pendingRequest?.player_id || playerId;
    
    logger.log({
      level: 'info',
      action: 'game.sendAction',
      msg: 'Sending action to server',
      payload: { 
        type, 
        targetPlayerId,
        full_payload: payload
      }
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
  }, [gameId, pendingRequest, playerId, setGameState, setPendingRequest]);

  const sendBattleAction = useCallback(async (
    actionType: BattleActionRequest['action_type'],
    cardUuid?: string,
    requestId?: string
  ) => {
    if (!gameId) return;
    setIsPending(true);

    const targetPlayerId = pendingRequest?.player_id || playerId;

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
  }, [gameId, pendingRequest, playerId, setGameState, setPendingRequest]);

  return { sendAction, sendBattleAction, startGame, gameId, isPending, errorToast, setErrorToast };
};
