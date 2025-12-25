import type { GameState } from '../types/game';
import type { GameActionRequest } from '../types/api';

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
        
        // Cast to 'any' to bypass strict type checking between HiddenCard and BoardCard for mock logic
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
