export interface BaseCard {
  uuid: string;
  card_id: string;
  owner_id: string;
  name: string;
  type: string;
  is_rest: boolean;
  power?: number;
  counter?: number;
  cost?: number;
  attribute?: string;
  attached_don?: number;
  is_face_up?: boolean;
  life?: number;
  // ▼ 追加: 既存コンポーネントで参照されているプロパティ
  keywords?: string[];
  traits?: string[];
  text?: string;
  trigger_text?: string;
  ability_disabled?: boolean;
  is_frozen?: boolean;
}

export interface LeaderCard extends BaseCard {
  type: 'LEADER' | 'リーダー';
}

export interface CharacterCard extends BaseCard {
  type: 'CHARACTER' | 'キャラクター';
}

export interface EventCard extends BaseCard {
  type: 'EVENT' | 'イベント';
}

export interface StageCard extends BaseCard {
  type: 'STAGE' | 'ステージ';
}

export interface DonCard extends BaseCard {
  type: 'DON' | 'ドン!!';
}

// すべてのカード型の集合
export type CardInstance = LeaderCard | CharacterCard | EventCard | StageCard | DonCard;

// BoardSideでの互換性のため
export type BoardCard = CardInstance;

export interface ZoneState {
  field: CardInstance[];
  hand: CardInstance[];
  life: CardInstance[];
  trash: CardInstance[];
  deck: CardInstance[];
  don_deck: CardInstance[];
}

export interface PlayerState {
  player_id: string;
  name: string;
  leader: LeaderCard | null;
  stage: BoardCard | null;
  zones: ZoneState;
  don_count: number;
  active_don: number;
  don_active: CardInstance[];
  don_rested: CardInstance[];
  don_attached: CardInstance[];
  don_deck_count: number;
}

// RealGame.tsx のエラー解消用
export interface PendingRequest {
  player_id: string;
  action: string;
  message: string;
  selectable_uuids: string[];
  can_skip: boolean;
  candidates?: any[];
  constraints?: any;
  options?: any;
  // ▼ 追加: 必須プロパティ
  request_id: string;
}

export interface GameState {
  game_id: string;
  room_name: string;
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  players: {
    p1: PlayerState;
    p2: PlayerState;
  };
  turn_info: {
    turn_count: number;
    active_player_id: 'p1' | 'p2';
    current_phase: 'MAIN' | 'REFRESH' | 'DRAW' | 'DON' | 'END' | 'SETUP';
    winner: string | null;
  };
  ready_states?: { p1: boolean; p2: boolean };
  // RealGame.tsx 用
  active_battle?: {
    attacker_uuid: string;
    target_uuid: string;
    counter_buff: number;
    attacker?: any;
    target?: any;
  } | null;
}
