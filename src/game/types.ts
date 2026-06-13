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
  // ▼ ドン!!カードが付与されている対象キャラの uuid（未付与/解除時は null/undefined）
  attached_to?: string | null;
}

// デッキ JSON / localStorage 由来の生カードデータ（スキーマ揺れを許容する permissive 型）。
// card_id / uuid / id / number のいずれかで識別され得るため全て optional。
export interface DeckCardData {
  card_id?: string;
  uuid?: string;
  id?: string;
  number?: string;
  name?: string;
  type?: string;
  power?: number;
  cost?: number;
  counter?: number;
  life?: number;
  [key: string]: unknown;
}

// createInitialGameState 等が受け取るデッキ入力（leader は単体/配列の両形式を許容）。
export interface DeckInput {
  leader?: DeckCardData | DeckCardData[] | null;
  cards?: DeckCardData[];
  [key: string]: unknown;
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

// 盤面の仮想ゾーン（ライフ束/デッキ/トラッシュ/ドン置き場）を1枚のカードとして描画する際の型。
// 実カード(CardInstance)も渡せるよう全フィールドを optional にしている。
export interface VirtualZoneCard extends Partial<BaseCard> {
  id?: string;                 // デッキ/生データ由来の別ID表記
  cards?: CardInstance[];      // トラッシュ等、内包カード一覧（ビューワー用）
}

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
  candidates?: CardInstance[];
  constraints?: { min?: number; max?: number; source_label?: string; render_mode?: string; [key: string]: unknown };
  options?: { label: string; value: unknown; [key: string]: unknown }[];
  // ▼ ARRANGE_DECK(並び替え/上下選択, 課題2a/2b)用のUI制御フラグ
  allow_position?: boolean;
  allow_reorder?: boolean;
  // ▼ 効果の発生源カード(任意効果/トリガー確認で盤面と紐付けて表示するため)
  source_card_uuid?: string;
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
    current_phase: 'MAIN' | 'REFRESH' | 'DRAW' | 'DON' | 'END' | 'SETUP' | 'MULLIGAN' | 'BLOCK_STEP' | 'BATTLE_COUNTER';
    winner: string | null;
  };
  ready_states?: { p1: boolean; p2: boolean };
  // マリガン完了フラグ（ローカル対戦用）
  mulligan_finished?: { p1: boolean; p2: boolean };
  // RealGame.tsx 用
  active_battle?: {
    attacker_uuid: string;
    target_uuid: string;
    counter_buff: number;
    attacker?: CardInstance;
    target?: CardInstance;
  } | null;
}
