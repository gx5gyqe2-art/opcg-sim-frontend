import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { apiClient } from '../api/client';
import type { GameActionRequest, ActionType, BattleActionRequest, PendingRequest, ActionEvent } from '../api/types';
import type { GameState } from './types';
import { logger } from '../utils/logger';

// API クライアントが throw するエラー（部分的に game_state/pending_request を含み得る）。
type ApiActionError = { message?: string; game_state?: GameState; pending_request?: PendingRequest | null };

export const useGameAction = (
  playerId: string,
  setGameState: (state: GameState) => void,
  setPendingRequest: (req: PendingRequest | null) => void,
  pendingRequest: PendingRequest | null,
  addEventLog?: (events: ActionEvent[]) => void,
  // オンライン対戦では既存ルームの game_id を外部から受け取り、createGame は呼ばない。
  externalGameId?: string,
) => {
  const [isPending, setIsPending] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(externalGameId ?? null);

  useEffect(() => {
    apiClient.checkHealth().catch(e => setErrorToast(`サーバー接続エラー: ${e.message}`));
  }, []);

  // 外部 game_id（オンライン対戦のルーム）が後から確定した場合に同期する。
  useEffect(() => {
    if (externalGameId) setGameId(externalGameId);
  }, [externalGameId]);

  // 【変更】引数でデッキIDを受け取るように修正。CPU 対戦時は cpuOptions を渡す。
  const startGame = useCallback(async (
    p1Deck: string,
    p2Deck: string,
    cpuOptions?: { vsCpu?: boolean; cpuDifficulty?: 'easy' | 'normal' | 'hard'; cpuDeck?: string },
  ) => {
    setIsPending(true);
    try {
      // APIに選択されたデッキIDを渡す
      const { game_id, state, pending_request } = await apiClient.createGame(p1Deck, p2Deck, cpuOptions);
      setGameId(game_id);
      setGameState(state);
      if (pending_request) {
        setPendingRequest(pending_request);
      }
    } catch (e) {
      setErrorToast(`ゲーム開始エラー: ${(e as ApiActionError).message}`);
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
      if (result.action_events?.length) addEventLog?.(result.action_events);
    } catch (e) {
      const err = e as ApiActionError;
      if (err.game_state) setGameState(err.game_state);
      if (err.pending_request !== undefined) setPendingRequest(err.pending_request || null);
      setErrorToast(`アクション失敗: ${err.message}`);
    } finally {
      setIsPending(false);
    }
  }, [gameId, pendingRequest, playerId, setGameState, setPendingRequest, addEventLog]);

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
      if (result.action_events?.length) addEventLog?.(result.action_events);
    } catch (e) {
      const err = e as ApiActionError;
      if (err.game_state) {
        setGameState(err.game_state);
      }
      if (err.pending_request !== undefined) {
        setPendingRequest(err.pending_request || null);
      }
      setErrorToast(`バトルアクション失敗: ${err.message}`);
    } finally {
      setIsPending(false);
    }
  }, [gameId, pendingRequest, playerId, setGameState, setPendingRequest, addEventLog]);

  return { sendAction, sendBattleAction, startGame, gameId, isPending, errorToast, setErrorToast };
};
