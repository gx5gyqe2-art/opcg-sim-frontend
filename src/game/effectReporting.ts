// src/game/effectReporting.ts

// --- Enums ---

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
  | 'TRASH'
  | 'RETURN_TO_HAND'
  | 'MOVE_TO_HAND'
  | 'DECK_BOTTOM'
  | 'DECK_TOP'
  | 'PLAY_CARD'
  | 'ATTACH_DON'
  | 'REST_DON'
  | 'RETURN_DON'
  | 'ACTIVE_DON'
  | 'BUFF'
  | 'COST_CHANGE'
  | 'GRANT_KEYWORD'
  | 'LIFE_MANIPULATE'
  | 'LOOK'
  | 'SELECT_OPTION'
  | 'OTHER';

export type Zone = 
  | 'FIELD' | 'HAND' | 'DECK' | 'TRASH' | 'LIFE' | 'DON_DECK' | 'COST_AREA' | 'TEMP' | 'ANY';

export type PlayerType = 'SELF' | 'OPPONENT' | 'OWNER' | 'ALL';

export type VerificationOperator = 
  | 'INCREASE_BY'
  | 'DECREASE_BY'
  | 'CONTAINS'
  | 'NOT_CONTAINS'
  | 'EQUALS';

// --- Data Structures ---

export interface TargetQuery {
  zone: Zone;
  player: PlayerType;
  card_type?: string[]; 
  traits?: string[];
  attributes?: string[];
  cost_min?: number;
  cost_max?: number;
  power_min?: number;
  power_max?: number;
  is_rest?: boolean;
  count: number;
  is_up_to: boolean;
  select_mode?: string;
  filterQuery?: string;
}

export interface Condition {
  type: string; 
  value: any;
  operator: string;
  target?: TargetQuery;
}

export interface EffectAction {
  type: ActionType;
  subject?: PlayerType;
  target?: TargetQuery;
  condition?: Condition;
  value?: number;
  source_zone?: Zone;
  dest_zone?: Zone;
  raw_text?: string;
  details?: any;
  then_actions?: EffectAction[];
}

export interface CardAbility {
  trigger: TriggerType;
  condition?: string; // ▼ 追加: フォームの入力に対応
  costs: EffectAction[];
  actions: EffectAction[];
  raw_text?: string;
}

export interface VerificationCheck {
  targetPlayer: PlayerType;
  targetProperty: string;
  operator: VerificationOperator;
  value: string | number;
}

// --- Report Wrapper ---

export interface EffectReport {
  correction: {
    cardName: string;
    rawText: string;
    ability: CardAbility;
  };
  verification: {
    expectedStateChanges: VerificationCheck[];
  };
  note: string;
}
