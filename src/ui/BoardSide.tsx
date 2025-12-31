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
    const offset = coords.getY(row);
    if (!isOpponent) {
      // 自分: midY から下へ配置
      // カードの中心(CH/2)分だけ下にずらして、カードの上辺がoffset位置に来るようにする
      return offset + coords.CH / 2;
    } else {
      // 相手: midY から上へ配置
      // midY - offset でカードの下辺位置を決め、そこから CH/2 上にずらして中心を合わせる
      return coords.midY - offset - coords.CH / 2;
    }
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

  const r2Y = getAdjustedY(2);
  const r3Y = getAdjustedY(3);
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

  // デッキ
  const deck = createCardContainer(
    { uuid: `deck-${p.player_id}`, name: 'Deck' } as any, 
    coords.CW, 
    coords.CH, 
    { ...getCardOpts({ uuid: `deck-${p.player_id}`, name: 'Deck' } as any) }
  );
  deck.x = coords.getDeckX(W); deck.y = r2Y;
  side.addChild(deck);

  // トラッシュ
  const trashCount = z.trash?.length || 0;
  const trash = createCardContainer(
    { uuid: `trash-${p.player_id}`, name: 'Trash' } as any, 
    coords.CW, 
    coords.CH, 
    { ...getCardOpts({ uuid: `trash-${p.player_id}`, name: 'Trash' } as any), count: trashCount }
  );
  trash.x = coords.getTrashX(W); trash.y = r3Y;
  side.addChild(trash);

  // ドン!!デッキ
  const donDeckCount = (p as any).don_deck_count ?? 0;
  const donDeck = createCardContainer(
    { uuid: `dondeck-${p.player_id}`, name: 'Don!! Deck' } as any, 
    coords.CW, 
    coords.CH, 
    { ...getCardOpts({ uuid: `dondeck-${p.player_id}`, name: 'Don!! Deck' } as any), count: donDeckCount }
  );
  donDeck.x = coords.getDonDeckX(W); donDeck.y = r3Y;
  side.addChild(donDeck);

  // アクティブドン
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

  // レストドン
  const donRestList = (p as any).don_rested || [];
  const donRestCount = donRestList.length;
  const donRest = createCardContainer(
    { uuid: `donrest-${p.player_id}`, name: 'Don!! Rest', is_rest: true } as any, 
    coords.CW, 
    coords.CH, 
    { ...getCardOpts({ uuid: `donrest-${p.player_id}`, name: 'Don!! Rest' } as any), count: donRestCount }
  );
  donRest.x = coords.getDonRestX(W); donRest.y = r3Y;
  side.addChild(donRest);

  // 手札処理
  const handList = z.hand || [];

  if (isOpponent) {
    handList.forEach((c: CardInstance, i: number) => {
      const card = createCardContainer(c, coords.CW, coords.CH, getCardOpts(c));
      card.x = coords.getHandX(i, W);
      card.y = r4Y;
      side.addChild(card);
    });
  } else {
    // 自分の手札（スクロール対応）
    const handContainer = new PIXI.Container();
    handContainer.y = r4Y;
    
    // マスク（表示領域）設定
    // カード中心から上下に余裕を持たせる
    const handAreaH = coords.CH * 2; 
    const maskTopOffset = coords.CH; 
    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff);
    mask.drawRect(0, r4Y - maskTopOffset, W, handAreaH); 
    mask.endFill();
    side.addChild(mask);
    handContainer.mask = mask;

    const innerHand = new PIXI.Container();
    handContainer.addChild(innerHand);

    let totalHandWidth = 0;
    
    handList.forEach((c: CardInstance, i: number) => {
      const card = createCardContainer(c, coords.CW, coords.CH, getCardOpts(c));
      const xPos = coords.getHandX(i, W);
      card.x = xPos;
      card.y = 0;
      innerHand.addChild(card);
      
      if (i === handList.length - 1) {
        totalHandWidth = xPos + coords.CW + 20;
      }
    });

    if (totalHandWidth > W) {
      handContainer.eventMode = 'static';
      handContainer.cursor = 'grab';
      
      let isDragging = false;
      let startX = 0;
      let containerStartX = 0;

      handContainer.on('pointerdown', (e) => {
        isDragging = true;
        startX = e.global.x;
        containerStartX = innerHand.x;
        handContainer.cursor = 'grabbing';
      });

      const onEnd = () => {
        isDragging = false;
        handContainer.cursor = 'grab';
      };
      handContainer.on('pointerup', onEnd);
      handContainer.on('pointerupoutside', onEnd);

      handContainer.on('pointermove', (e) => {
        if (!isDragging) return;
        const dx = e.global.x - startX;
        let newX = containerStartX + dx;

        const minX = W - totalHandWidth;
        if (newX > 0) newX = 0;
        if (newX < minX) newX = minX;

        innerHand.x = newX;
      });
    }
    side.addChild(handContainer);
  }

  return side;
};
