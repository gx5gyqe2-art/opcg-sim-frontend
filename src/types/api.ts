import type { GameState } from './game';

export type ActionType = 
  | 'PLAY_CARD' 
  | 'ATTACK' 
  | 'ACTIVATE' 
  | 'ATTACH_DON' 
  | 'END_TURN' 
  | 'RESOLVE_INPUT';

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

export interface GameActionResult {
  success: boolean;
  game_id: string;
  game_state: GameState;
  input_request?: {
    request_id: string;
    type: string;
    message: string;
    valid_targets: string[];
  };
  error?: {
    code: string;
    message: string;
  };
}
