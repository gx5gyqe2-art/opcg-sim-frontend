// src/game/effectReporting.ts

// --- Enum Definitions ---

export type EffectTrigger = 
  | 'ON_PLAY'        // 登場時
  | 'WHEN_ATTACKING' // アタック時
  | 'ON_BLOCK'       // ブロック時
  | 'ON_KO'          // KO時
  | 'ACTIVATE_MAIN'  // 起動メイン
  | 'TURN_END'       // ターン終了時
  | 'TRIGGER'        // トリガー
  | 'OTHER';

export type CostType = 
  | 'DOWN_DON'       // ドン!!-X
  | 'REST_DON'       // ドン!!X枚をレスト
  | 'TRASH_CARD'     // 手札を捨てる
  | 'RETURN_DON'     // ドン!!を戻す
  | 'NONE';

export type TargetPlayer = 'SELF' | 'OPPONENT' | 'BOTH';

export type CardZone = 'HAND' | 'DECK' | 'TRASH' | 'LIFE' | 'FIELD' | 'COST_AREA';

export type CardTypeFilter = 'CHARACTER' | 'LEADER' | 'STAGE' | 'EVENT' | 'ALL';

export type ActionType = 
  | 'KO' 
  | 'REST' 
  | 'ACTIVE' 
  | 'RETURN_TO_HAND' 
  | 'TRASH' 
  | 'ADD_DON_ACTIVE' 
  | 'ADD_DON_REST' 
  | 'DRAW' 
  | 'BUFF_POWER' 
  | 'RECOVER_LIFE'
  | 'OTHER';

export type VerificationOperator = 
  | 'INCREASE_BY'    // 増える
  | 'DECREASE_BY'    // 減る
  | 'CONTAINS'       // 特定カードを含む
  | 'NOT_CONTAINS'   // 含まない
  | 'EQUALS';        // 等しい

// --- Structure Definitions ---

// 1. コスト定義
export interface CostDefinition {
  type: CostType;
  amount: number;
}

// 2. 対象選択フィルター
export interface TargetSelector {
  player: TargetPlayer;
  zone: CardZone;
  cardType: CardTypeFilter;
  filterQuery: string; // "Cost <= 4" などの条件（簡易記述）
  count: number;
}

// 3. 効果定義
export interface EffectDefinition {
  type: ActionType;
  target?: TargetSelector; // 対象を取る場合
  value?: string;          // "+1000" や "1" など
}

// --- Report Structure ---

// Correction: あるべき姿
export interface CorrectionSpec {
  cardName: string;
  rawText: string;         // 原文テキスト
  
  structuredEffect: {
    trigger: EffectTrigger;
    costs: CostDefinition[];
    conditions: string;    // "Leader has Straw Hat" などを簡易構造化またはテキスト
    effects: EffectDefinition[];
  };
}

// Verification: 検証条件
export interface VerificationCheck {
  targetPlayer: TargetPlayer;
  targetProperty: string;  // "hand", "life", "field", "don_active"
  operator: VerificationOperator;
  value: string | number;
}

// 最終的なレポート型
export interface EffectReport {
  correction: CorrectionSpec;
  verification: {
    expectedStateChanges: VerificationCheck[];
  };
  note: string;
}
