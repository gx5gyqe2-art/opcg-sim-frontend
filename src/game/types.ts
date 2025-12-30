import type { 
  PendingRequest as ApiPendingRequest, 
} from '../api/types';

interface BaseCard {
  uuid: string;
  card_id: string;
  owner_id: string;
  name: string;
  text?: string;
  attribute?: string;
  traits?: string[];
}

export interface LeaderCard extends BaseCard {
  power: number;
  is_rest: boolean;
  attached_don: number;
}

export interface BoardCard extends BaseCard {
  power: number;
  cost: number;
  is_rest: boolean;
  attached_don: number;
  counter?: number;
}

// uuidを必須に上書き
export interface HiddenCard extends Partial<BaseCard> {
  uuid: string; 
  owner_id: string;
  is_face_up: boolean;
}

export type CardInstance = LeaderCard | BoardCard | HiddenCard;

export interface PendingRequest extends ApiPendingRequest {}

export interface PlayerState {
  player_id: string;
  name: string;
  leader: LeaderCard;
  zones: {
    field: BoardCard[];
    hand: CardInstance[];
    life: CardInstance[];
    trash: CardInstance[];
  };
  don_count: number;
  active_don: number;
}

export interface GameState {
  game_id: string;
  turn_info: {
    turn_count: number;
    active_player_id: string;
    current_phase: string;
    winner: string | null;
  };
  players: {
    p1: PlayerState;
    p2: PlayerState;
  };
  pending_request?: PendingRequest | null;
}
