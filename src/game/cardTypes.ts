// カード種別の正規化。バックエンドは英語/日本語の両表記
// ('STAGE'|'ステージ' 等) を返し得るため、UI 側で一意な型に揃える。
export type NormalizedCardType = 'LEADER' | 'CHARACTER' | 'EVENT' | 'STAGE' | 'DON' | 'UNKNOWN';

export const normalizeCardType = (t?: string): NormalizedCardType => {
  switch (t?.toUpperCase()) {
    case 'LEADER':
    case 'リーダー':
      return 'LEADER';
    case 'CHARACTER':
    case 'キャラクター':
      return 'CHARACTER';
    case 'EVENT':
    case 'イベント':
      return 'EVENT';
    case 'STAGE':
    case 'ステージ':
      return 'STAGE';
    case 'DON':
    case 'DON!!':
    case 'ドン!!':
      return 'DON';
    default:
      return 'UNKNOWN';
  }
};
