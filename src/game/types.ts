import type { 
  PendingRequest as ApiPendingRequest, 
} from '../api/types';

export interface BaseCard {
  uuid: string;
  card_id: string;
  owner_id: string;
  name: string;
  text?: string;
  attribute?: string;
  traits?: string[];
  type?: string;
  is_rest?: boolean;
  attached_don?: number;
}

export interface LeaderCard extends BaseCard {
  power: number;
}

export interface BoardCard extends BaseCard {
  power: number;
  cost: number;
  counter?: number;
}

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
  leader: LeaderCard | null;
  stage?: BoardCard | null;
  zones: {
    field: BoardCard[];
    hand: CardInstance[];
    life: CardInstance[];
    trash: CardInstance[];
    deck?: CardInstance[];
    don_deck?: CardInstance[];
  };
  don_count: number;
  active_don: number;
  don_active: CardInstance[];
  don_rested: CardInstance[];
  don_attached: CardInstance[];
  don_deck_count?: number;
}

export interface GameState {
  game_id: string;
  room_name?: string;
  status?: 'WAITING' | 'PLAYING';
  ready_states?: {
    p1: boolean;
    p2: boolean;
  };
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
  active_battle?: {
    attacker_uuid: string;
    target_uuid: string;
    counter_buff: number;
  } | null;
}
