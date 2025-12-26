import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid'; 
import type { GameActionRequest, ActionType } from '../types/api';
import type { GameState } from '../types/game';
import { processMockAction } from '../mocks/mockGameLogic';

// 通信先URLの動的解決
const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) return envUrl;

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://127.0.0.1:8000';
  }
  return ''; 
};

export const useGameAction = (
  _gameId: string, 
  playerId: string, 
  currentState: GameState, 
  setGameState: (state: GameState) => void
) => {
  const [isPending, setIsPending] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const sendAction = useCallback(async (
    type: ActionType, 
    payload: Omit<GameActionRequest, 'request_id' | 'action_type' | 'player_id'>
  ) => {
    setIsPending(true);
    setErrorToast(null);

    const baseUrl = getBaseUrl();
    const request: GameActionRequest = {
      request_id: uuidv4(),
      action_type: type,
      player_id: playerId,
      ...payload
    };

    try {
      // 通信先が設定されている場合（baseUrlが存在する場合）のみfetchを実行
      if (baseUrl) {
        const response = await fetch(`${baseUrl}/api/game/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        setGameState(result.game_state);
      } else {
        // フォールバック: 通信先がない場合はモックロジックで動作
        const nextState = processMockAction(currentState, request);
        setGameState(nextState);
      }
    } catch (e: any) {
      console.error(e);
      let hint = "";
      // Mixed Content や接続拒否の判定
      if (e.name === 'TypeError' && window.location.protocol === 'https:') {
        hint = "\n(HTTPSからHTTPへの混合コンテンツ制限の可能性があります。distをバックエンド経由で配信してください)";
      } else if (e.message.includes('Failed to fetch')) {
        hint = "\n(a-Shell上のバックエンドが未起動か、CORS設定を確認してください)";
      }
      setErrorToast(`通信失敗: ${e.name} - ${e.message}${hint}`);
    } finally {
      setIsPending(false);
    }
  }, [playerId, currentState, setGameState]);

  return { sendAction, isPending, errorToast, setErrorToast };
};
