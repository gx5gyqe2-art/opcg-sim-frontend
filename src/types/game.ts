// リーダー専用型
export interface LeaderCard {
  uuid: string;
  card_id: string;
  name: string;
  power: number;
  attribute: string;
  is_rest: boolean;
  owner_id: string;
  traits: string[];
  is_face_up: true;
  attached_don: number;
}

// 盤面キャラクター用（公開）
export interface BoardCard {
  uuid: string;
  card_id: string;
  name: string;
  power: number;
  cost: number; // キャラクターには必須
  is_rest: boolean;
  is_face_up: true;
  attached_don: number;
  owner_id: string;
  attribute?: string;
  counter?: number;
  traits?: string[];
  keywords?: string[];
}

// 秘匿可能カード（手札・ライフ用）
export interface HiddenCard {
  uuid: string;
  owner_id: string;
  is_face_up: boolean;
  card_id?: string;
  name?: string;
  power?: number;
  cost?: number;
  is_rest?: boolean;
}

// すべてのカード型の連合
export type CardInstance = LeaderCard | BoardCard | HiddenCard;

// ドンカードの構造
export interface DonInstance {
  uuid: string;
  owner_id: string;
  is_rest: boolean;
}

export interface PlayerState {
  player_id: string;
  name: string;
  life_count: number;
  hand_count: number;
  don_active: DonInstance[];
  don_rested: DonInstance[];
  leader: LeaderCard; // リーダー分離
  zones: {
    field: BoardCard[];
    hand: CardInstance[];
    life: CardInstance[];
    trash: CardInstance[];
    stage: BoardCard | null;
  };
}

export interface GameState {
  game_id: string;
  turn_info: {
    turn_count: number;
    current_phase: string;
    active_player_id: string;
    winner: string | null;
  };
  players: {
    [key: string]: PlayerState;
  };
}

export interface GameResponse {
  success: boolean;
  gameId: string;
  state: GameState;
}
