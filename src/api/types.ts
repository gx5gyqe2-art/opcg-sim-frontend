import type { GameState } from '../game/types';

export type ActionType = 
  | 'PLAY_CARD' 
  | 'ATTACK' 
  | 'ACTIVATE' 
  | 'ATTACH_DON' 
  | 'END_TURN' 
  | 'RESOLVE_INPUT';

export interface PendingRequest {
  request_id: string;
  type: string;
  message: string;
  player_id: string;
  selectable_uuids: string[];
  can_skip: boolean;
}

export interface GameActionRequest {
  request_id: string;
  action_type: ActionType;
  player_id: string;
  card_id?: string;
  target_ids?: string[];
  reply_to?: string;
  extra?: {
    count?: number;
    ability_idx?: number;
  };
}

export interface BattleActionRequest {
  game_id: string;
  player_id: string;
  action_type: 'COUNTER' | 'BLOCK' | 'PASS';
  card_uuid?: string;
  request_id: string;
}

export interface GameActionResult {
  success: boolean;
  game_id: string;
  game_state: GameState;
  pending_request?: PendingRequest;
  error?: {
    code: string;
    message: string;
  };
}
