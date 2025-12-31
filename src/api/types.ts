import type { GameState } from '../game/types';

// 定数ファイルの値を受け入れられるように string 型に変更
export type ActionType = string;

export interface PendingRequest {
  request_id: string;
  action: string;
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
