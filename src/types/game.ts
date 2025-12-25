export interface CardInstance {
  uuid: string;
  card_id: string;
  name?: string;
  power?: number;
  cost?: number;
  is_rest: boolean;
  is_face_up: boolean;
  attached_don: number;
  owner_id: string;
  attribute?: string;
  counter?: number;
  traits?: string[];
}

export interface PlayerState {
  player_id: string;
  name: string;
  life_count: number;
  hand_count: number;
  don_active: any[]; // バックエンド公認のリスト形式
  don_rested: any[];
  leader: CardInstance;
  zones: {
    field: CardInstance[];
    hand: CardInstance[];
    life: CardInstance[];
    trash: CardInstance[];
    stage: CardInstance | null;
  };
}

// 既存の CardInstance や PlayerState の下に追加
export interface GameResponse {
  success: boolean;
  gameId: string;
  state: GameState;
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

