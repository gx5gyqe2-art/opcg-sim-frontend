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

  (z.field || []).forEach((c: BoardCard, i: number) => {
    const card = createCardContainer(c, coords.CW, coords.CH, getCardOpts(c));
    card.x = coords.getFieldX(i, W, coords.CW, z.field.length);
    card.y = getAdjustedY(1);
    side.addChild(card);
  });

  const r2Y = getAdjustedY(2);
  const r3Y = getAdjustedY(3);
  const r4Y = getAdjustedY(4);

  if (p.leader) {
    const ldr = createCardContainer(p.leader, coords.CW, coords.CH, getCardOpts(p.leader));
    ldr.x = coords.getLeaderX(W); 
    ldr.y = r2Y;
    side.addChild(ldr);
  }

  const lifeCount = z.life?.length || 0;
  const life = createCardContainer({ uuid: `life-${p.player_id}`, name: 'Life' } as any, coords.CW, coords.CH, { ...getCardOpts({ uuid: `life-${p.player_id}`, name: 'Life' } as any), count: lifeCount });
  life.x = coords.getLifeX(W); life.y = r2Y;
  side.addChild(life);

  const trashCount = z.trash?.length || 0;
  const trash = createCardContainer({ uuid: `trash-${p.player_id}`, name: 'Trash' } as any, coords.CW, coords.CH, { ...getCardOpts({ uuid: `trash-${p.player_id}`, name: 'Trash' } as any), count: trashCount });
  trash.x = coords.getTrashX(W); trash.y = r2Y;
  side.addChild(trash);

  const deckCount = p.don_count ?? 0; 
  const deck = createCardContainer({ uuid: `deck-${p.player_id}`, name: 'Deck' } as any, coords.CW, coords.CH, { ...getCardOpts({ uuid: `deck-${p.player_id}`, name: 'Deck' } as any), count: deckCount });
  deck.x = coords.getDeckX(W); deck.y = r2Y;
  side.addChild(deck);

  const donDeckCount = 10 - (p.don_count ?? 0); 
  const donDeck = createCardContainer({ uuid: `dondeck-${p.player_id}`, name: 'Don!! Deck' } as any, coords.CW, coords.CH, { ...getCardOpts({ uuid: `dondeck-${p.player_id}`, name: 'Don!! Deck' } as any), count: donDeckCount });
  donDeck.x = coords.getDonDeckX(W); donDeck.y = r3Y;
  side.addChild(donDeck);

  const donActiveCount = p.active_don ?? 0;
  const donActive = createCardContainer({ uuid: `donactive-${p.player_id}`, name: 'Don!! Active' } as any, coords.CW, coords.CH, { ...getCardOpts({ uuid: `donactive-${p.player_id}`, name: 'Don!! Active' } as any), count: donActiveCount });
  donActive.x = coords.getDonActiveX(W); donActive.y = r3Y;
  side.addChild(donActive);

  const donRestCount = (p.don_count ?? 0) - (p.active_don ?? 0);
  // 【修正】is_rest: true を付与して横向きにする
  const donRest = createCardContainer(
    { uuid: `donrest-${p.player_id}`, name: 'Don!! Rest', is_rest: true } as any, 
    coords.CW, coords.CH, 
    { ...getCardOpts({ uuid: `donrest-${p.player_id}`, name: 'Don!! Rest' } as any), count: donRestCount }
  );
  donRest.x = coords.getDonRestX(W); donRest.y = r3Y;
  side.addChild(donRest);

  (z.hand || []).forEach((c: CardInstance, i: number) => {
    const card = createCardContainer(c, coords.CW, coords.CH, getCardOpts(c));
    card.x = coords.getHandX(i, W);
    card.y = r4Y;
    side.addChild(card);
  });

  return side;
};
