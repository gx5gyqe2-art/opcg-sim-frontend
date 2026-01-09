// src/game/effectReporting.ts

// トリガー（いつ）
export type EffectTrigger = 
  | 'ON_PLAY'        // 登場時
  | 'WHEN_ATTACKING' // アタック時
  | 'ON_BLOCK'       // ブロック時
  | 'ON_KO'          // KO時
  | 'ACTIVATE_MAIN'  // 起動メイン
  | 'TURN_END'       // ターン終了時
  | 'MY_TURN'        // 自分のターン中（常時）
  | 'OPPONENT_TURN'  // 相手のターン中（常時）
  | 'TRIGGER'        // トリガー
  | 'RULE'           // ルール処理（速攻、ブロッカーなど）
  | 'OTHER';

// コスト（代償）
export type CostType = 
  | 'DOWN_DON'       // ドン!!-X
  | 'REST_DON'       // ドン!!X枚をレスト
  | 'RETURN_DON'     // ドン!!X枚をドンデッキに戻す
  | 'TRASH_HAND'     // 手札をX枚捨てる
  | 'TRASH_SELF'     // 自身をトラッシュに送る
  | 'REST_SELF'      // 自身をレストにする
  | 'LIFE_TO_HAND'   // ライフを手札に加える
  | 'NONE';

export type TargetPlayer = 'SELF' | 'OPPONENT' | 'BOTH';

export type CardZone = 'HAND' | 'DECK' | 'TRASH' | 'LIFE' | 'FIELD' | 'COST_AREA' | 'LEADER' | 'STAGE';

export type CardTypeFilter = 'CHARACTER' | 'LEADER' | 'STAGE' | 'EVENT' | 'ALL';

// アクション（効果）
export type ActionType = 
  | 'KO'               // KOする
  | 'REST'             // レストにする
  | 'ACTIVE'           // アクティブにする
  | 'RETURN_TO_HAND'   // 手札に戻す
  | 'RETURN_TO_DECK'   // デッキの下/上に戻す
  | 'TRASH'            // トラッシュに送る
  | 'PLAY'             // 登場させる
  | 'ADD_DON_ACTIVE'   // ドン追加(アクティブ)
  | 'ADD_DON_REST'     // ドン追加(レスト)
  | 'ATTACH_DON'       // ドンを付与する
  | 'BUFF_POWER'       // パワー増減
  | 'DEBUFF_COST'      // コスト減少
  | 'DRAW'             // ドロー
  | 'TRASH_RANDOM'     // ハンデス
  | 'RECOVER_LIFE'     // ライフ回復
  | 'ADD_LIFE'         // ライフ追加
  | 'LOOK_AND_ADD'     // デッキトップを見て加える（サーチ）
  | 'SET_KEYWORD'      // 速攻などを付与
  | 'OTHER';

export type VerificationOperator = 
  | 'INCREASE_BY'    // 増える
  | 'DECREASE_BY'    // 減る
  | 'CONTAINS'       // 特定カードを含む
  | 'NOT_CONTAINS'   // 含まない
  | 'EQUALS';        // 等しい

// --- Structure Definitions ---

export interface CostDefinition {
  type: CostType;
  amount: number;
  rawText?: string; // 元のテキスト
}

export interface TargetSelector {
  player: TargetPlayer;
  zone: CardZone;
  cardType: CardTypeFilter;
  filterQuery: string; 
  count: number;
}

export interface EffectDefinition {
  type: ActionType;
  target?: TargetSelector; 
  value?: string;
  rawText?: string; // 元のテキスト
}

// --- Report Structure ---

export interface CorrectionSpec {
  cardName: string;
  rawText: string;
  
  structuredEffect: {
    trigger: EffectTrigger;
    costs: CostDefinition[];
    conditions: string;
    effects: EffectDefinition[];
  };
}

export interface VerificationCheck {
  targetPlayer: TargetPlayer;
  targetProperty: string;
  operator: VerificationOperator;
  value: string | number;
}

export interface EffectReport {
  correction: CorrectionSpec;
  verification: {
    expectedStateChanges: VerificationCheck[];
  };
  note: string;
}
