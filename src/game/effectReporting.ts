// src/game/effectReporting.ts

export type TriggerType = 
  | 'ON_PLAY' | 'ON_ATTACK' | 'ON_BLOCK' | 'ON_KO' | 'ACTIVATE_MAIN'
  | 'TURN_END' | 'OPP_TURN_END' | 'ON_OPP_ATTACK' | 'TRIGGER' | 'COUNTER' 
  | 'RULE' | 'PASSIVE' | 'UNKNOWN';

export type ActionType = 
  | 'KO' | 'REST' | 'ACTIVE' | 'DRAW' | 'TRASH' | 'RETURN_TO_HAND' | 'MOVE_TO_HAND'
  | 'DECK_BOTTOM' | 'DECK_TOP' | 'PLAY_CARD' | 'ATTACH_DON' | 'REST_DON' | 'RETURN_DON'
  | 'ACTIVE_DON' | 'BUFF' | 'COST_CHANGE' | 'GRANT_KEYWORD' | 'LIFE_MANIPULATE'
  | 'LOOK' | 'SELECT_OPTION' | 'OTHER';

export type Zone = 
  | 'FIELD' | 'HAND' | 'DECK' | 'TRASH' | 'LIFE' | 'DON_DECK' | 'COST_AREA' | 'TEMP' | 'ANY';

export type PlayerType = 'SELF' | 'OPPONENT' | 'OWNER' | 'ALL';

export interface TargetQuery {
  zone: Zone;
  player: PlayerType;
  card_type?: string[]; 
  traits?: string[];
  attributes?: string[];
  colors?: string[];
  names?: string[];
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
  target?: TargetQuery;
  operator: string;
  value: any;
}

export interface EffectAction {
  type: ActionType;
  subject?: PlayerType;
  target?: TargetQuery;
  condition?: Condition;
  value?: number;
  source_zone?: Zone;
  dest_zone?: Zone;
  dest_position?: string;
  raw_text?: string;
  details?: any;
  then_actions?: EffectAction[];
}

export interface CardAbility {
  trigger: TriggerType;
  costs: EffectAction[];
  actions: EffectAction[];
  raw_text?: string;
}

export interface EffectReport {
  correction: {
    cardName: string;
    rawText: string;
    ability: CardAbility;
    unusedTextParts?: string[]; // 追加: 使用されなかったテキスト部分
  };
  note: string;
}
