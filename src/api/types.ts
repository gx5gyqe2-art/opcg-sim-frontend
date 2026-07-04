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
    [key: string]: unknown;
  };
  options?: { label: string; value: unknown; [key: string]: unknown }[];

  // ▼ ARRANGE_DECK(並び替え/上下選択, 課題2a/2b)用のUI制御フラグ
  allow_position?: boolean; // デッキの上/下をプレイヤーに選ばせる
  allow_reorder?: boolean;  // DnD で配置順を並び替えさせる

  // ▼ 効果の発生源カード(任意効果/トリガー確認で盤面と紐付けて表示するため)
  source_card_uuid?: string;
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
    option_value?: unknown;
    position?: 'TOP' | 'BOTTOM'; // ARRANGE_DECK: デッキの上/下
    [key: string]: unknown;
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

export interface ActionEvent {
  type: string;
  player: string;
  card_name?: string;
  action?: string;
  targets?: string[];
  value?: number | null;
  message?: string;
  success?: boolean;
  /** 移動系（MOVE_CARD 等）の行き先ゾーン（"LIFE"/"HAND" 等・backend が additive に付与）。 */
  dest?: string;
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
  action_events?: ActionEvent[];
}

// CPU 対戦のポーリング待ち状態。
//   cpu            : CPU が続けて行動する（フロントは続けて step を呼ぶ）
//   human          : 人間の手番（メイン操作待ち）
//   human_decision : 人間宛の選択要求（マリガン/ブロッカー/カウンター/効果選択）
//   game_over      : 勝敗確定
export type CpuWaitingFor = 'cpu' | 'human' | 'human_decision' | 'game_over';

export interface CpuStepResult extends GameActionResult {
  cpu_acted?: boolean;
  cpu_event?: ActionEvent | null;
  waiting_for?: CpuWaitingFor;
}
