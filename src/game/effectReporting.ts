// src/game/effectReporting.ts

// --- Enums (src/models/enums.py に準拠) ---

export type TriggerType = 
  | 'ON_PLAY'        // 登場時
  | 'ON_ATTACK'      // アタック時
  | 'ON_BLOCK'       // ブロック時
  | 'ON_KO'          // KO時
  | 'ACTIVATE_MAIN'  // 起動メイン
  | 'TURN_END'       // ターン終了時
  | 'OPP_TURN_END'   // 相手のターン終了時
  | 'ON_OPP_ATTACK'  // 相手のアタック時
  | 'TRIGGER'        // トリガー
  | 'COUNTER'        // カウンター
  | 'RULE'           // ルール
  | 'PASSIVE'        // 常時
  | 'UNKNOWN';

export type ActionType = 
  | 'KO'
  | 'REST'
  | 'ACTIVE'
  | 'DRAW'
  | 'TRASH'            // トラッシュに送る
  | 'RETURN_TO_HAND'   // 手札に戻す (MOVE_TO_HAND かな？ resolverを確認すると MOVE_TO_HAND が使われています)
  | 'MOVE_TO_HAND'     // resolver.py で使用
  | 'DECK_BOTTOM'
  | 'DECK_TOP'
  | 'PLAY_CARD'        // 登場させる
  | 'ATTACH_DON'       // ドン付与
  | 'REST_DON'         // ドンをレスト（コスト等）
  | 'RETURN_DON'       // ドンを戻す（コスト等）
  | 'ACTIVE_DON'       // ドンをアクティブに
  | 'BUFF'             // パワー増減
  | 'COST_CHANGE'      // コスト増減
  | 'GRANT_KEYWORD'    // 速攻などを付与
  | 'LIFE_MANIPULATE'  // ライフ操作
  | 'LOOK'             // デッキトップを見る
  | 'SELECT_OPTION'    // 選択肢
  | 'OTHER';

export type Zone = 
  | 'FIELD' | 'HAND' | 'DECK' | 'TRASH' | 'LIFE' | 'DON_DECK' | 'COST_AREA' | 'TEMP' | 'ANY';

export type PlayerType = 'SELF' | 'OPPONENT' | 'OWNER' | 'ALL';

// --- Data Structures (src/models/effect_types.py に準拠) ---

// 対象選択のクエリ
export interface TargetQuery {
  zone: Zone;
  player: PlayerType;
  card_type?: string[]; // "CHARACTER", "LEADER" など
  traits?: string[];
  attributes?: string[];
  cost_min?: number;
  cost_max?: number;
  power_min?: number;
  power_max?: number;
  is_rest?: boolean;
  count: number;
  is_up_to: boolean;    // "〜枚まで"
  select_mode?: string; // "CHOOSE", "ALL" など
}

// 条件定義
export interface Condition {
  type: string; // ConditionType Enum (LIFE_COUNT, HAND_COUNT etc.)
  value: any;
  operator: string; // "GE", "LE", "EQ" etc.
  target?: TargetQuery;
}

// 効果/コストのアクション定義 (EffectAction)
export interface EffectAction {
  type: ActionType;
  subject?: PlayerType;
  target?: TargetQuery;
  condition?: Condition;
  value?: number;       // パワー値、枚数、コスト値など
  source_zone?: Zone;
  dest_zone?: Zone;
  raw_text?: string;    // 元のテキスト
  details?: any;        // その他の詳細
  then_actions?: EffectAction[]; // 後続効果
}

// カードの能力定義 (Ability)
export interface CardAbility {
  trigger: TriggerType;
  costs: EffectAction[];
  actions: EffectAction[]; // effects ではなく actions
  raw_text?: string;
}

// --- Report Wrapper ---

export interface EffectReport {
  correction: {
    cardName: string;
    rawText: string;
    ability: CardAbility; // この構造がそのままバックエンドで使えるようになる
  };
  verification: {
    expectedStateChanges: any[]; // 検証用（一旦簡易形式）
  };
  note: string;
}
