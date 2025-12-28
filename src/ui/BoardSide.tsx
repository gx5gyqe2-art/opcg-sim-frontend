// src/ui/BoardSide.tsx
import * as PIXI from 'pixi.js';
import { LayoutCoords } from '../layout/layoutEngine';
import { createCardContainer } from './CardRenderer';

export const createBoardSide = (
  p: any, 
  isOpp: boolean, 
  W: number, 
  coords: LayoutCoords, 
  onCardClick: (card: any) => void
) => {
  const side = new PIXI.Container();
  const z = p?.zones || {};

  // フィールド
  (z.field || []).forEach((c: any, i: number) => {
    const card = createCardContainer(c, coords.CW, coords.CH, isOpp, { onClick: () => onCardClick(c) });
    card.x = coords.getFieldX(i, W, coords.CW, z.field.length);
    card.y = coords.getY(1, coords.CH, coords.V_GAP);
    side.addChild(card);
  });

  const r2Y = coords.getY(2, coords.CH, coords.V_GAP);
  const r3Y = coords.getY(3, coords.CH, coords.V_GAP);

  // リーダー・ライフ・山札
  if (p.leader) {
    const ldr = createCardContainer(p.leader, coords.CW, coords.CH, isOpp, { isWide: true, onClick: () => onCardClick(p.leader) });
    ldr.x = coords.getLeaderX(W); ldr.y = r2Y;
    side.addChild(ldr);
  }

  const life = createCardContainer({ name: 'Life', location: 'life', is_face_up: false }, coords.CW, coords.CH, isOpp, { count: (z.life || []).length, onClick: () => {} });
  life.x = coords.getLifeX(W); life.y = r2Y;
  side.addChild(life);

  if (z.stage?.length > 0) {
    const stage = createCardContainer(z.stage[0], coords.CW, coords.CH, isOpp, { onClick: () => onCardClick(z.stage[0]) });
    stage.x = coords.getStageX(W); stage.y = r2Y;
    side.addChild(stage);
  }

  const deck = createCardContainer({ name: 'Deck', location: 'deck', is_face_up: false }, coords.CW, coords.CH, isOpp, { count: (z.deck || []).length, onClick: () => {} });
  deck.x = coords.getDeckX(W); deck.y = r2Y;
  side.addChild(deck);

  // トラッシュ・ドン
  const trash = createCardContainer({ name: 'Trash', location: 'trash' }, coords.CW, coords.CH, isOpp, { count: (z.trash || []).length, onClick: () => {} });
  trash.x = coords.getTrashX(W); trash.y = r3Y;
  side.addChild(trash);

  const donDeck = createCardContainer({ name: 'Don!!', location: 'don_deck', is_face_up: false }, coords.CW, coords.CH, isOpp, { count: (z.don_deck || []).length, onClick: () => {} });
  donDeck.x = coords.getDonDeckX(W); donDeck.y = r3Y;
  side.addChild(donDeck);

  const donActive = createCardContainer({ name: 'Don!!', location: 'don_active' }, coords.CW, coords.CH, isOpp, { count: (z.don_active || []).length, onClick: () => {} });
  donActive.x = coords.getDonActiveX(W); donActive.y = r3Y;
  side.addChild(donActive);

  // 手札
  (z.hand || []).forEach((c: any, i: number) => {
    const card = createCardContainer(c, coords.CW, coords.CH, isOpp, { onClick: () => onCardClick(c) });
    card.x = coords.getHandX(i, W);
    card.y = coords.getY(4, coords.CH, coords.V_GAP);
    side.addChild(card);
  });

  return side;
};
