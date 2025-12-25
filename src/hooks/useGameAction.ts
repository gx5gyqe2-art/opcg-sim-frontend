import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid'; 
import type { GameActionRequest, ActionType } from '../types/api';
import type { GameState } from '../types/game';
import { processMockAction } from '../mocks/mockGameLogic';

export const useGameAction = (
  _gameId: string, // Unused variable prefixed with _
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
    await new Promise(resolve => setTimeout(resolve, 200));

    const request: GameActionRequest = {
      request_id: uuidv4(),
      action_type: type,
      player_id: playerId,
      ...payload
    };

    try {
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
