// src/game/effectReporting.ts

export type TriggerType = 
  | 'ON_PLAY' | 'ON_ATTACK' | 'ON_BLOCK' | 'ON_KO' | 'ACTIVATE_MAIN'
  | 'TURN_END' | 'OPP_TURN_END' | 'ON_OPP_ATTACK' | 'TRIGGER' | 'COUNTER' 
  | 'RULE' | 'PASSIVE' | 'UNKNOWN';

export type ActionType = 
  | 'KO' | 'REST' | 'ACTIVE' | 'DRAW' | 'TRASH' | 'RETURN_TO_HAND' | 'MOVE_TO_HAND'
  | 'DECK_BOTTOM' | 'DECK_TOP' | 'PLAY_CARD' | 'ATTACH_DON' | 'REST_DON' | 'RETURN_DON'
  | 'ACTIVE_DON' | 'BUFF' | 'COST_CHANGE' | 'GRANT_KEYWORD' | 'LIFE_MANIPULATE'
  | 'LOOK' | 'SELECT_OPTION' | 'OTHER' | 'DEAL_DAMAGE' | 'REPLACE_EFFECT' | 'GRANT_EFFECT'
  | 'DISABLE_ABILITY' | 'REVEAL' | 'SHUFFLE' | 'LIFE_RECOVER' | 'FACE_UP_LIFE'
  | 'SET_BASE_POWER' | 'RAMP_DON' | 'NEGATE_EFFECT' | 'SWAP_POWER' | 'KEYWORD'
  | 'ATTACK_DISABLE' | 'EXECUTE_MAIN_EFFECT' | 'VICTORY' | 'RULE_PROCESSING' 
  | 'RESTRICTION' | 'SET_COST' | 'PREVENT_LEAVE' | 'MOVE_ATTACHED_DON' 
  | 'MODIFY_DON_PHASE' | 'REDIRECT_ATTACK';

export type Zone = 
  | 'FIELD' | 'HAND' | 'DECK' | 'TRASH' | 'LIFE' | 'DON_DECK' | 'COST_AREA' | 'TEMP' | 'ANY';

export type PlayerType = 'SELF' | 'OPPONENT' | 'OWNER' | 'ALL';

export type ConditionType = 
  | 'LIFE_COUNT' | 'HAND_COUNT' | 'TRASH_COUNT' | 'FIELD_COUNT' | 'HAS_TRAIT'
  | 'HAS_ATTRIBUTE' | 'HAS_UNIT' | 'IS_RESTED' | 'DON_COUNT' | 'DECK_COUNT'
  | 'LEADER_NAME' | 'LEADER_TRAIT' | 'CONTEXT' | 'OTHER' | 'NONE';

export type CompareOperator = 
  | 'EQ' | 'NEQ' | 'GT' | 'LT' | 'GE' | 'LE' | 'HAS';

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
  select_mode?: string; // "CHOOSE", "ALL", "RANDOM" etc.
  tag?: string;
  filterQuery?: string;
}

export interface Condition {
  type: ConditionType; 
  target?: TargetQuery;
  operator: CompareOperator;
  value: any;
  raw_text?: string;
}

export interface EffectAction {
  type: ActionType;
  subject: PlayerType;
  target?: TargetQuery;
  condition?: Condition;
  value?: number;
  source_zone: Zone;
  dest_zone: Zone;
  dest_position: string; // "BOTTOM", "TOP" etc.
  raw_text?: string;
  details?: Record<string, any>; // Dict
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
    unusedTextParts?: string[];
  };
  note: string;
}
