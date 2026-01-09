// src/game/effectReporting.ts

// タイミング（いつ）
export type EffectTrigger = 
  | 'OnPlay'        // 登場時
  | 'WhenAttacking' // アタック時
  | 'OnBlock'       // ブロック時
  | 'OnKO'          // KO時
  | 'ActivateMain'  // 起動メイン
  | 'TurnEnd'       // ターン終了時
  | 'Trigger'       // トリガー
  | 'Other';

// 領域（どこから）
export type GameZone = 
  | 'Hand' 
  | 'Deck' 
  | 'Trash' 
  | 'Life' 
  | 'Field' 
  | 'CostArea'
  | 'Temp'; // 閲覧中エリアなど

// 行動の種類（〜して、〜する）
export type ActionType = 
  | 'Rest' 
  | 'Active' 
  | 'KO' 
  | 'Trash' 
  | 'ReturnToHand' 
  | 'AddDon' 
  | 'RestDon'       // ドンをレストで追加
  | 'Draw' 
  | 'BuffPower' 
  | 'SelectOption'  // 選択肢 (例: 1枚引く OR レストにする)
  | 'Other';

// 効果の定義構造
export interface EffectReport {
  cardName: string;       // 対象カード名
  trigger: EffectTrigger; // いつ
  condition: string;      // どの場合（テキストまたは構造化）
  
  // 対象選択（どこから、何を〜枚）
  sourceZone: GameZone;
  targetSelector: {
    count: number;
    filter: string;       // "コスト3以下のキャラ" など
  };

  // 一連のアクション
  actions: {
    type: ActionType;
    detail: string;       // "パワー+2000" や "Option A | Option B" など
  }[];
  
  note: string;           // 補足
  timestamp?: string;     // 報告時刻
}
