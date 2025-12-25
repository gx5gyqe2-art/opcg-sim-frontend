import { GameState } from '../types/game';
import { GameActionRequest } from '../types/api';

const cloneState = (state: GameState): GameState => JSON.parse(JSON.stringify(state));

export const processMockAction = (currentState: GameState, request: GameActionRequest): GameState => {
  const newState = cloneState(currentState);
  const player = newState.players[request.player_id];

  if (!player) return newState;

  switch (request.action_type) {
    case 'PLAY_CARD': {
      const handIndex = player.zones.hand.findIndex(c => c.uuid === request.card_id);
      if (handIndex !== -1) {
        const card = player.zones.hand[handIndex];
        player.zones.hand.splice(handIndex, 1);
        card.is_rest = false;
        
        // 型アサーションを追加して BoardCard[] への push を許可
        // 実際には手札のカードデータに power や cost が含まれている前提
        player.zones.field.push(card as any); 
        
        console.log(`[Mock] Played: ${card.name}`);
      }
      break;
    }
    case 'ATTACK': {
      const card = player.zones.field.find(c => c.uuid === request.card_id) || 
                   (player.leader.uuid === request.card_id ? player.leader : undefined);
      if (card) {
        card.is_rest = true;
        console.log(`[Mock] Attack: ${card.name}`);
      }
      break;
    }
    case 'ACTIVATE': {
      const card = player.zones.field.find(c => c.uuid === request.card_id);
      if (card) {
        card.is_rest = true; 
        console.log(`[Mock] Activate: ${card.name}`);
      }
      break;
    }
    case 'ATTACH_DON': {
      if (player.don_active.length > 0) {
        player.don_active.pop();
        const targetId = request.target_ids?.[0];
        const target = player.zones.field.find(c => c.uuid === targetId) || 
                       (player.leader.uuid === targetId ? player.leader : undefined);
        if (target) {
          target.attached_don = (target.attached_don || 0) + 1;
          target.power += 1000;
          console.log(`[Mock] Don Attached: ${target.name}`);
        }
      }
      break;
    }
  }
  return newState;
};
