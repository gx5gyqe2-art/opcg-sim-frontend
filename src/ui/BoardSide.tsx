import * as PIXI from 'pixi.js';
import type { LayoutCoords } from '../layout/layoutEngine';
import { createCardContainer } from './CardRenderer';

export const createBoardSide = (
  p: any, 
  isOpponent: boolean, 
  W: number, 
  coords: LayoutCoords, 
  onCardClick: (card: any) => void
) => {
  const side = new PIXI.Container();
  const z = p?.zones || {};

  const getCardOpts = (c: any) => ({ 
    onClick: () => onCardClick(c),
    isOpponent: isOpponent 
  });

  // フィールドの描画
  (z.field || []).forEach((c: any, i: number) => {
    const card = createCardContainer(c, coords.CW, coords.CH, getCardOpts(c));
    card.x = coords.getFieldX(i, W, coords.CW, z.field.length);
    card.y = coords.getY(1, coords.CH, coords.V_GAP);
    side.addChild(card);
  });

  const r2Y = coords.getY(2, coords.CH, coords.V_GAP);
  const r3Y = coords.getY(3, coords.CH, coords.V_GAP);

  // リーダー
  if (p.leader) {
    const ldr = createCardContainer(p.leader, coords.CW, coords.CH, getCardOpts(p.leader));
    ldr.x = coords.getLeaderX(W); 
    ldr.y = r2Y;
    side.addChild(ldr);
  }

  // ライフ
  const lifeCount = Array.isArray(z.life) ? z.life.length : 0;
  const life = createCardContainer(
    { name: 'Life', location: isOpponent ? 'opp_life' : 'life', is_face_up: false }, 
    coords.CW, coords.CH, 
    { ...getCardOpts({}), count: lifeCount }
  );
  life.x = coords.getLifeX(W); 
  life.y = r2Y;
  side.addChild(life);

  // トラッシュ
  const trashCount = Array.isArray(z.trash) ? z.trash.length : 0;
  const trash = createCardContainer(
    { name: 'Trash', location: isOpponent ? 'opp_trash' : 'trash' }, 
    coords.CW, coords.CH, 
    { ...getCardOpts({}), count: trashCount }
  );
  trash.x = coords.getTrashX(W); 
  trash.y = r2Y;
  side.addChild(trash);

  // デッキ
  const deckCount = p.deck_count || 0;
  const deck = createCardContainer(
    { name: 'Deck', location: isOpponent ? 'opp_deck' : 'deck', is_face_up: false }, 
    coords.CW, coords.CH, 
    { ...getCardOpts({}), count: deckCount }
  );
  deck.x = coords.getDeckX(W); 
  deck.y = r2Y;
  side.addChild(deck);

  // ドン!!デッキ
  const donDeckCount = p.don_deck_count || 0;
  const donDeck = createCardContainer(
    { name: 'Don!!', location: isOpponent ? 'opp_don_deck' : 'don_deck', is_face_up: false }, 
    coords.CW, coords.CH, 
    { ...getCardOpts({}), count: donDeckCount }
  );
  donDeck.x = coords.getDonDeckX(W); 
  donDeck.y = r3Y;
  side.addChild(donDeck);

  // アクティブなドン!!
  const donActiveCount = Array.isArray(p.don_active) ? p.don_active.length : 0;
  const donActive = createCardContainer(
    { name: 'Don!!', location: isOpponent ? 'opp_don_active' : 'don_active' }, 
    coords.CW, coords.CH, 
    { ...getCardOpts({}), count: donActiveCount }
  );
  donActive.x = coords.getDonActiveX(W); 
  donActive.y = r3Y;
  side.addChild(donActive);

  // レストのドン!!
  const donRestCount = Array.isArray(p.don_rested) ? p.don_rested.length : 0;
  const donRest = createCardContainer(
    { name: 'Don!!', location: isOpponent ? 'opp_don_rest' : 'don_rest' }, 
    coords.CW, coords.CH, 
    { ...getCardOpts({}), count: donRestCount }
  );
  donRest.x = coords.getDonRestX(W); 
  donRest.y = r3Y;
  side.addChild(donRest);

  // 手札の描画（配置の修正）
  const handCards = z.hand || [];
  handCards.forEach((c: any, i: number) => {
    const card = createCardContainer(c, coords.CW, coords.CH, getCardOpts(c));
    // 自分と相手で配置を分ける必要があるため、sideの基準点からのオフセットとして計算
    // 自分の場合は右側に寄せるなどの調整が必要な場合は getHandX のロジックを確認
    card.x = coords.getHandX(i, W);
    card.y = r3Y;
    side.addChild(card);
  });

  return side;
};
