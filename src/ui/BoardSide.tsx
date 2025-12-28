import * as PIXI from 'pixi.js';
import type { LayoutCoords } from '../layout/layoutEngine';
import { createCardContainer } from './CardRenderer';

export const createBoardSide = (
  p: any, 
  _isOpp: boolean, // 未使用変数エラー回避のためアンダースコアを付与
  W: number, 
  coords: LayoutCoords, 
  onCardClick: (card: any) => void
) => {
  const side = new PIXI.Container();
  const z = p?.zones || {};

  (z.field || []).forEach((c: any, i: number) => {
    const card = createCardContainer(c, coords.CW, coords.CH, { 
      onClick: () => onCardClick(c) 
    });
    card.x = coords.getFieldX(i, W, coords.CW, z.field.length);
    card.y = coords.getY(1, coords.CH, coords.V_GAP);
    side.addChild(card);
  });

  const r2Y = coords.getY(2, coords.CH, coords.V_GAP);
  const r3Y = coords.getY(3, coords.CH, coords.V_GAP);

  if (p.leader) {
    const ldr = createCardContainer(p.leader, coords.CW, coords.CH, { 
      onClick: () => onCardClick(p.leader) 
    });
    ldr.x = coords.getLeaderX(W); 
    ldr.y = r2Y;
    side.addChild(ldr);
  }

  const life = createCardContainer(
    { name: 'Life', location: 'life', is_face_up: false }, 
    coords.CW, coords.CH, 
    { count: (z.life || []).length, onClick: () => {} }
  );
  life.x = coords.getLifeX(W); 
  life.y = r2Y;
  side.addChild(life);

  if (z.stage && z.stage.length > 0) {
    const s = z.stage[0];
    const stageCard = createCardContainer(s, coords.CW, coords.CH, { 
      onClick: () => onCardClick(s) 
    });
    stageCard.x = coords.getStageX(W); 
    stageCard.y = r2Y;
    side.addChild(stageCard);
  }

  const deck = createCardContainer(
    { name: 'Deck', location: 'deck', is_face_up: false }, 
    coords.CW, coords.CH, 
    { count: (z.deck || []).length, onClick: () => {} }
  );
  deck.x = coords.getDeckX(W); 
  deck.y = r2Y;
  side.addChild(deck);

  const trash = createCardContainer(
    { name: 'Trash', location: 'trash' }, 
    coords.CW, coords.CH, 
    { count: (z.trash || []).length, onClick: () => {} }
  );
  trash.x = coords.getTrashX(W); 
  trash.y = r3Y;
  side.addChild(trash);

  const donDeck = createCardContainer(
    { name: 'Don!!', location: 'don_deck', is_face_up: false }, 
    coords.CW, coords.CH, 
    { count: (z.don_deck || []).length, onClick: () => {} }
  );
  donDeck.x = coords.getDonDeckX(W); 
  donDeck.y = r3Y;
  side.addChild(donDeck);

  const donActive = createCardContainer(
    { name: 'Don!!', location: 'don_active' }, 
    coords.CW, coords.CH, 
    { count: (z.don_active || []).length, onClick: () => {} }
  );
  donActive.x = coords.getDonActiveX(W); 
  donActive.y = r3Y;
  side.addChild(donActive);

  const donRest = createCardContainer(
    { name: 'Don!!', location: 'don_rest' }, 
    coords.CW, coords.CH, 
    { count: (z.don_rest || []).length, onClick: () => {} }
  );
  donRest.x = coords.getDonRestX(W); 
  donRest.y = r3Y;
  side.addChild(donRest);

  (z.hand || []).forEach((c: any, i: number) => {
    const card = createCardContainer(c, coords.CW, coords.CH, { 
      onClick: () => onCardClick(c) 
    });
    card.x = coords.getHandX(i, W);
    card.y = coords.getY(4, coords.CH, coords.V_GAP);
    side.addChild(card);
  });

  return side;
};
