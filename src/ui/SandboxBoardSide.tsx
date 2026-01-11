import * as PIXI from 'pixi.js';
import type { LayoutCoords } from '../layout/layoutEngine';
import { createCardContainer } from './CardRenderer';
import type { PlayerState, CardInstance, BoardCard } from '../game/types';

export const createSandboxBoardSide = (
  p: PlayerState, 
  isOpponent: boolean, 
  W: number, 
  coords: LayoutCoords, 
  onCardDown: (e: PIXI.FederatedPointerEvent, card: CardInstance, container: PIXI.Container) => void,
  onInspect: (type: 'deck' | 'life', cards: CardInstance[]) => void // ★追加
) => {
  const side = new PIXI.Container();
  const z = p.zones;

  const getAdjustedY = (row: number) => {
    const offset = coords.getY(row);
    if (!isOpponent) {
      return offset + coords.CH / 2;
    } else {
      return coords.midY - offset - coords.CH / 2;
    }
  };

  const getCardOpts = (_c: Partial<CardInstance>) => ({ 
    onClick: () => {}, 
    isOpponent: isOpponent 
  });

  const setupInteractive = (container: PIXI.Container, card: CardInstance) => {
    container.eventMode = 'static';
    container.cursor = 'grab';
    container.on('pointerdown', (e) => onCardDown(e, card, container));
  };

  let stageCard = p.stage;
  let fieldCards = [...(z.field || [])]; 

  if (!stageCard) {
    const sIdx = fieldCards.findIndex(c => {
      const t = c.type?.toUpperCase();
      return t === 'STAGE' || t === 'ステージ';
    });
    if (sIdx >= 0) {
      stageCard = fieldCards[sIdx];
      fieldCards.splice(sIdx, 1);
    }
  }

  // Row 1: フィールド
  fieldCards.forEach((c: BoardCard, i: number) => {
    const card = createCardContainer(c, coords.CW, coords.CH, getCardOpts(c));
    card.x = coords.getFieldX(i, W, coords.CW, fieldCards.length);
    card.y = getAdjustedY(1);
    setupInteractive(card, c);
    side.addChild(card);
  });

  const r2Y = getAdjustedY(2);
  const r3Y = getAdjustedY(3);
  const r4Y = getAdjustedY(4);

  // リーダー (★修正: setupInteractive を削除し、移動不可にする)
  if (p.leader) {
    const ldr = createCardContainer(p.leader, coords.CW, coords.CH, getCardOpts(p.leader));
    ldr.x = coords.getLeaderX(W); 
    ldr.y = r2Y;
    // リーダーは固定なのでドラッグ設定しない
    side.addChild(ldr);
  }

  // ステージ
  if (stageCard) {
    const stg = createCardContainer(stageCard, coords.CW, coords.CH, getCardOpts(stageCard));
    stg.x = coords.getStageX(W);
    stg.y = r2Y; 
    setupInteractive(stg, stageCard);
    side.addChild(stg);
  }

  // ライフ (★修正: クリックで中身確認)
  const lifeList = z.life || [];
  const lifeCard = { uuid: `life-${p.player_id}`, name: 'Life' } as any;
  const life = createCardContainer(lifeCard, coords.CW, coords.CH, { 
      ...getCardOpts(lifeCard), 
      count: lifeList.length,
      onClick: () => onInspect('life', lifeList) // クリックで確認
  });
  life.x = coords.getLifeX(W); life.y = r2Y;
  // 一番上もドラッグは可能にしておく（そのまま手札に加えたい場合など）
  // ただし確認モーダルがメインならドラッグは不要かもしれないが、一応残す
  const topLife = lifeList.length > 0 ? lifeList[0] : null;
  if (topLife) setupInteractive(life, topLife); 
  side.addChild(life);

  // デッキ (★修正: クリックで中身確認)
  const deckList = z.deck || [];
  const deckCard = { uuid: `deck-${p.player_id}`, name: 'Deck' } as any;
  const deck = createCardContainer(deckCard, coords.CW, coords.CH, {
      ...getCardOpts(deckCard),
      onClick: () => onInspect('deck', deckList) // クリックで確認
  });
  deck.x = coords.getDeckX(W); deck.y = r2Y;
  
  const topDeck = deckList.length > 0 ? deckList[0] : null;
  if (topDeck) setupInteractive(deck, topDeck);
  side.addChild(deck);

  // トラッシュ
  const topTrash = z.trash && z.trash.length > 0 ? z.trash[z.trash.length - 1] : null;
  const trash = createCardContainer(
    { uuid: `trash-${p.player_id}`, name: 'Trash', card_id: topTrash?.card_id } as any, 
    coords.CW, coords.CH, 
    { ...getCardOpts({} as any), count: z.trash?.length || 0 }
  );
  trash.x = coords.getTrashX(W); trash.y = r3Y;
  if (topTrash) setupInteractive(trash, topTrash);
  side.addChild(trash);

  // ドン!!デッキ
  const donDeckList = z.don_deck || []; 
  const donDeckCount = (p as any).don_deck_count ?? donDeckList.length;

  const donDeck = createCardContainer(
    { uuid: `dondeck-${p.player_id}`, name: 'Don!! Deck' } as any, 
    coords.CW, coords.CH, 
    { ...getCardOpts({} as any), count: donDeckCount }
  );
  donDeck.x = coords.getDonDeckX(W); donDeck.y = r3Y;

  const topDon = donDeckList.length > 0 ? donDeckList[0] : null;
  if (topDon) setupInteractive(donDeck, topDon);

  side.addChild(donDeck);

  // アクティブドン
  const donActiveList = (p as any).don_active || [];
  const donActive = createCardContainer(
    { uuid: `donactive-${p.player_id}`, name: 'Don!! Active', card_id: 'DON' } as any, 
    coords.CW, coords.CH, 
    { ...getCardOpts({} as any), count: donActiveList.length }
  );
  donActive.x = coords.getDonActiveX(W); donActive.y = r3Y;
  const topActiveDon = donActiveList.length > 0 ? donActiveList[donActiveList.length - 1] : null;
  if (topActiveDon) setupInteractive(donActive, topActiveDon);
  side.addChild(donActive);

  // レストドン
  const donRestList = (p as any).don_rested || [];
  const donRest = createCardContainer(
    { uuid: `donrest-${p.player_id}`, name: 'Don!! Rest', is_rest: true, card_id: 'DON' } as any, 
    coords.CW, coords.CH, 
    { ...getCardOpts({} as any), count: donRestList.length }
  );
  donRest.x = coords.getDonRestX(W); donRest.y = r3Y;
  const topRestDon = donRestList.length > 0 ? donRestList[donRestList.length - 1] : null;
  if (topRestDon) setupInteractive(donRest, topRestDon);
  side.addChild(donRest);

  // 手札
  const handList = z.hand || [];
  handList.forEach((c: CardInstance, i: number) => {
    const card = createCardContainer(c, coords.CW, coords.CH, getCardOpts(c));
    card.x = coords.getHandX(i, W);
    card.y = r4Y;
    setupInteractive(card, c);
    side.addChild(card);
  });

  return side;
};
