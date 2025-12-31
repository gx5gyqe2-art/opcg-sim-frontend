import * as PIXI from 'pixi.js';
import type { LayoutCoords } from '../layout/layoutEngine';
import { createCardContainer } from './CardRenderer';
import type { PlayerState, CardInstance, BoardCard } from '../game/types';

export const createBoardSide = (
  p: PlayerState, 
  isOpponent: boolean, 
  W: number, 
  coords: LayoutCoords, 
  onCardClick: (card: CardInstance) => void
) => {
  const side = new PIXI.Container();
  const z = p.zones;

  const getAdjustedY = (row: number) => {
    const y = coords.getY(row, coords.CH, coords.V_GAP);
    if (!isOpponent) return y;
    const boardHeight = coords.getY(4, coords.CH, coords.V_GAP) + coords.CH;
    return boardHeight - y - coords.CH;
  };

  const getCardOpts = (c: Partial<CardInstance>) => ({ 
    onClick: () => onCardClick(c as CardInstance),
    isOpponent: isOpponent 
  });

  // Row 1: フィールド
  (z.field || []).forEach((c: BoardCard, i: number) => {
    const card = createCardContainer(c, coords.CW, coords.CH, getCardOpts(c));
    card.x = coords.getFieldX(i, W, coords.CW, z.field.length);
    card.y = getAdjustedY(1);
    side.addChild(card);
  });

  // Row 2: リーダー・ライフ・デッキ
  const r2Y = getAdjustedY(2);
  // Row 3: ドン・トラッシュ
  const r3Y = getAdjustedY(3);
  // Row 4: 手札
  const r4Y = getAdjustedY(4);

  // リーダー
  if (p.leader) {
    const ldr = createCardContainer(p.leader, coords.CW, coords.CH, getCardOpts(p.leader));
    ldr.x = coords.getLeaderX(W); 
    ldr.y = r2Y;
    side.addChild(ldr);
  }

  // ライフ
  const lifeCount = z.life?.length || 0;
  const life = createCardContainer(
    { uuid: `life-${p.player_id}`, name: 'Life' } as any, 
    coords.CW, 
    coords.CH, 
    { ...getCardOpts({ uuid: `life-${p.player_id}`, name: 'Life' } as any), count: lifeCount }
  );
  life.x = coords.getLifeX(W); life.y = r2Y;
  side.addChild(life);

  // デッキ (カウント削除対応済み)
  const deck = createCardContainer(
    { uuid: `deck-${p.player_id}`, name: 'Deck' } as any, 
    coords.CW, 
    coords.CH, 
    { ...getCardOpts({ uuid: `deck-${p.player_id}`, name: 'Deck' } as any) }
  );
  deck.x = coords.getDeckX(W); deck.y = r2Y;
  side.addChild(deck);

  // トラッシュ (位置を r3Y に修正済み)
  const trashCount = z.trash?.length || 0;
  const trash = createCardContainer(
    { uuid: `trash-${p.player_id}`, name: 'Trash' } as any, 
    coords.CW, 
    coords.CH, 
    { ...getCardOpts({ uuid: `trash-${p.player_id}`, name: 'Trash' } as any), count: trashCount }
  );
  trash.x = coords.getTrashX(W); trash.y = r3Y;
  side.addChild(trash);

  // ドン!!デッキ (プロパティ名修正済み)
  const donDeckCount = (p as any).don_deck_count ?? 0;
  const donDeck = createCardContainer(
    { uuid: `dondeck-${p.player_id}`, name: 'Don!! Deck' } as any, 
    coords.CW, 
    coords.CH, 
    { ...getCardOpts({ uuid: `dondeck-${p.player_id}`, name: 'Don!! Deck' } as any), count: donDeckCount }
  );
  donDeck.x = coords.getDonDeckX(W); donDeck.y = r3Y;
  side.addChild(donDeck);

  // アクティブドン (配列参照に修正済み)
  const donActiveList = (p as any).don_active || [];
  const donActiveCount = donActiveList.length;
  const donActive = createCardContainer(
    { uuid: `donactive-${p.player_id}`, name: 'Don!! Active' } as any, 
    coords.CW, 
    coords.CH, 
    { ...getCardOpts({ uuid: `donactive-${p.player_id}`, name: 'Don!! Active' } as any), count: donActiveCount }
  );
  donActive.x = coords.getDonActiveX(W); donActive.y = r3Y;
  side.addChild(donActive);

  // レストドン (配列参照に修正済み)
  const donRestList = (p as any).don_rested || [];
  const donRestCount = donRestList.length;
  const donRest = createCardContainer(
    { uuid: `donrest-${p.player_id}`, name: 'Don!! Rest' } as any, 
    coords.CW, 
    coords.CH, 
    { ...getCardOpts({ uuid: `donrest-${p.player_id}`, name: 'Don!! Rest' } as any), count: donRestCount }
  );
  donRest.x = coords.getDonRestX(W); donRest.y = r3Y;
  side.addChild(donRest);

  // 手札
  (z.hand || []).forEach((c: CardInstance, i: number) => {
    const card = createCardContainer(c, coords.CW, coords.CH, getCardOpts(c));
    card.x = coords.getHandX(i, W);
    card.y = r4Y;
    side.addChild(card);
  });

  return side;
};
