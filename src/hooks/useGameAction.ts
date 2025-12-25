import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid'; // npm install uuid 
import { GameActionRequest, ActionType } from '../types/api';
import { GameState } from '../types/game';
import { processMockAction } from '../mocks/mockGameLogic';

export const useGameAction = (
  gameId: string, 
  playerId: string, 
  currentState: GameState, 
  setGameState: (state: GameState) => void
) => {
  const [isPending, setIsPending] = useState(false);

  const sendAction = useCallback(async (
    type: ActionType, 
    payload: Omit<GameActionRequest, 'request_id' | 'action_type' | 'player_id'>
  ) => {
    setIsPending(true);
    // 擬似的な通信ラグ (200ms)
    await new Promise(resolve => setTimeout(resolve, 200));

    const request: GameActionRequest = {
      request_id: uuidv4(),
      action_type: type,
      player_id: playerId,
      ...payload
    };

    try {
      // ★現在はモックロジックで状態を計算
      // 将来的にはここで fetch('/api/game/action', ...) を呼ぶ
      const nextState = processMockAction(currentState, request);
      setGameState(nextState);
    } catch (e) {
      console.error(e);
    } finally {
      setIsPending(false);
    }
  }, [playerId, currentState, setGameState]);

  return { sendAction, isPending };
};
