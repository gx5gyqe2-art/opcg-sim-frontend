import type { GameState } from '../game/types';
import type { CardInstance } from '../game/types';

// 定数ファイルの値を受け入れられるように string 型に変更
export type ActionType = string;

export interface PendingRequest {
  request_id: string; // 注: 現状バックエンドからは送られていませんが、フロントで使用箇所があるため維持
  action: string;
  message: string;
  player_id: string;
  selectable_uuids: string[];
  can_skip: boolean;
  
  // ▼ 追加: UI制御用の詳細フィールド
  candidates?: CardInstance[]; // 選択候補（デッキ内カードなど）
  constraints?: {
    min?: number;
    max?: number;
    source_label?: string; // "デッキの上から" など
    render_mode?: string;
    [key: string]: any;
  };
  options?: { label: string; value: any; [key: string]: any }[];
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
    // ▼ 追加: 選択結果汎用フィールド
    selected_uuids?: string[]; 
    option_value?: any;
    [key: string]: any;
  };
}

export interface BattleActionRequest {
  game_id: string;
  player_id: string;
  // ここも厳密なユニオン型から string に変更して CONST の値を受け入れる
  action_type: string;
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
