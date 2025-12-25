// 盤面用（公開）カード
export interface BoardCard {
  uuid: string;
  card_id: string;
  name: string;
  power: number;
  cost: number;
  is_rest: boolean;
  is_face_up: true; // BoardCardは常にtrue
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
  // 以下は公開時のみ存在する可能性のある項目
  card_id?: string;
  name?: string;
  power?: number;
  cost?: number;
  is_rest?: boolean;
}

export type CardInstance = BoardCard | HiddenCard;

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
  leader: BoardCard; // リーダーは常にBoardCard
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
