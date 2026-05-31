import type { GameState } from './types';
import { 
  moveCardLocal, 
  toggleRestLocal, 
  createInitialGameState, 
  resolveTurnEndLocal,
  attachDonLocal,
  mulliganLocal,
  finishMulliganLocal,
  drawCardLocal,
  shuffleDeckLocal,
  resetGameLocal 
} from './localLogic';
import { logger } from '../utils/logger';

export const handleLocalAction = (state: GameState, actionType: string, params: any): GameState => {
  logger.log({
    level: 'info',
    action: `local_action.${actionType}`,
    msg: `Processing local action: ${actionType}`,
    payload: params
  });

  switch (actionType) {
    case 'SET_DECK': {
      const newState = JSON.parse(JSON.stringify(state));
      const pid = params.player_id as 'p1' | 'p2';
      
      newState.players[pid].name = params.deck_id;

      if (params.deckData && params.deckData.leader) {
        const leaderData = Array.isArray(params.deckData.leader) 
          ? params.deckData.leader[0] 
          : params.deckData.leader;
          
        if (leaderData) {
          // ▼ 修正: uuidを上書きする前に、元のID（カード品番）を card_id として確保する
          const originalId = leaderData.card_id || leaderData.uuid || leaderData.id;

          newState.players[pid].leader = {
            ...leaderData,
            card_id: originalId, // これで画像読み込みが可能になる
            uuid: `leader-${pid}-${Date.now()}`, // ゲーム内での一意なID
            owner_id: params.deck_id
          };
        }
      }
      
      return newState;
    }

    case 'READY': {
      const newState = JSON.parse(JSON.stringify(state));
      if (!newState.ready_states) newState.ready_states = { p1: false, p2: false };
      const pid = params.player_id as 'p1' | 'p2';
      newState.ready_states[pid] = !newState.ready_states[pid];
      return newState;
    }

    case 'START':
      return createInitialGameState(params.p1Deck, params.p2Deck, state.room_name || 'local');

    case 'MOVE_CARD':
      return moveCardLocal(
        state,
        params.card_uuid,
        params.dest_player_id as 'p1' | 'p2',
        params.dest_zone,
        params.index
      );

    case 'TOGGLE_REST':
      return toggleRestLocal(state, params.card_uuid);

    case 'ATTACH_DON':
      return attachDonLocal(state, params.card_uuid, params.target_uuid);

    case 'TURN_END':
      return resolveTurnEndLocal(state);

    case 'MULLIGAN':
      return mulliganLocal(state, params.player_id);

    case 'MULLIGAN_FINISH':
      return finishMulliganLocal(state, params.player_id);

    case 'DRAW':
      return drawCardLocal(state, params.player_id || state.turn_info.active_player_id);

    case 'SHUFFLE':
      return shuffleDeckLocal(state, params.player_id);

    case 'RESET':
      return resetGameLocal(state);

    default:
      logger.warn('local_action.unknown', `Action ${actionType} is not implemented locally.`);
      return state;
  }
};
