import type { CardInstance } from './types';
import { normalizeCardType } from './cardTypes';

// カードに対して実行可能なアクションの記述子。
// CardDetailSheet（詳細シート）と CardActionMenu（ミニメニュー）で共有し、
// 「どのカードでどのボタンを出すか」のロジックを一元化する。
export type CardActionKey = 'play' | 'attack' | 'don' | 'activate';

export interface CardActionDescriptor {
  key: CardActionKey;
  label: string;
}

const hasActivateMain = (card: CardInstance): boolean =>
  'text' in card && typeof card.text === 'string' && card.text.includes('起動メイン');

// イベントが手札からメインフェイズに発動できるか＝【メイン】効果を持つか。
// 【カウンター】/【トリガー】のみのイベント（ゴムゴムの巨人 OP09-078 等）は自ターンに
// 発動できない（バックエンドの play_card_action も同条件で拒否する）。
const eventHasMainPlay = (card: CardInstance): boolean =>
  'text' in card && typeof card.text === 'string' && card.text.includes('【メイン】');

// location: RealGame.getPhysicalLocation 由来の物理ロケーション
//   ('hand' | 'field' | 'leader' | 'life' | 'trash' | 'deck' | ... )
// isMyTurn: そのカードが手番プレイヤーの操作可能カードか
export const getAvailableActions = (
  card: CardInstance,
  location: string,
  isMyTurn: boolean,
  activeDonCount: number,
): CardActionDescriptor[] => {
  if (!isMyTurn) return [];

  const actions: CardActionDescriptor[] = [];

  if (location === 'hand') {
    // イベントは【メイン】効果を持つ場合のみ「発動」できる。カウンター/トリガー専用
    // イベントは自ターンに発動不可（発動導線を出さない）。
    if (normalizeCardType(card.type) === 'EVENT') {
      if (eventHasMainPlay(card)) {
        actions.push({ key: 'play', label: '発動する' });
      }
      return actions;
    }
    actions.push({ key: 'play', label: '登場させる' });
    return actions;
  }

  if (location === 'field' || location === 'leader') {
    const type = normalizeCardType(card.type);
    const canBattle = type === 'LEADER' || type === 'CHARACTER';

    // 攻撃・ドン付与はリーダー/キャラクターのみ。
    // ステージ等はここに含めない（従来はロケーションのみで判定し、
    // ステージにも攻撃/ドン付与が表示されるバグがあった）。
    if (canBattle) {
      actions.push({ key: 'attack', label: '攻撃する' });
      if (activeDonCount > 0) {
        actions.push({ key: 'don', label: 'ドン!!付与' });
      }
    }

    // 起動メイン効果はカード種別を問わず（ステージ含む）テキストで判定。
    if (hasActivateMain(card)) {
      actions.push({ key: 'activate', label: '効果起動' });
    }
  }

  return actions;
};
