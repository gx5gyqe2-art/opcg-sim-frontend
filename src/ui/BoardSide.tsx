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
      return offset + coords.CH / 2;
    } else {
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

  // ★追加: ステージカード
  if (p.stage) {
    const stg = createCardContainer(p.stage, coords.CW, coords.CH, getCardOpts(p.stage));
    stg.x = coords.getStageX(W);
    stg.y = r2Y; // リーダーと同じ列に配置
    side.addChild(stg);
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
    { 
      uuid: `trash-${p.player_id}`, 
      name: 'Trash', 
      cards: z.trash
    } as any, 
    coords.CW, 
    coords.CH, 
    { ...getCardOpts({ uuid: `trash-${p.player_id}`, name: 'Trash', cards: z.trash } as any), count: trashCount }
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

  // 手札
  const handList = z.hand || [];

  if (isOpponent) {
    handList.forEach((c: CardInstance, i: number) => {
      const card = createCardContainer(c, coords.CW, coords.CH, getCardOpts(c));
      card.x = coords.getHandX(i, W);
      card.y = r4Y;
      side.addChild(card);
    });
  } else {
    const handContainer = new PIXI.Container();
    handContainer.y = r4Y;
    
    // マスク領域
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
      
      // ★修正: 慣性スクロール変数の追加
      let isDragging = false;
      let startX = 0;
      let lastX = 0; // 前回のX座標
      let velocity = 0; // 速度
      let containerStartX = 0;

      // ★修正: 慣性ループ用のTicker
      const inertiaTicker = () => {
        if (isDragging) return;
        
        // 速度が十分小さい場合は停止
        if (Math.abs(velocity) < 0.1) {
            // 境界外にいる場合は戻すアニメーション（簡易的にlerp）
            const minX = W - totalHandWidth;
            if (innerHand.x > 0) {
                innerHand.x += (0 - innerHand.x) * 0.2;
                if (Math.abs(innerHand.x) < 1) innerHand.x = 0;
            } else if (innerHand.x < minX) {
                innerHand.x += (minX - innerHand.x) * 0.2;
                if (Math.abs(innerHand.x - minX) < 1) innerHand.x = minX;
            }
            return;
        }

        // 慣性移動
        innerHand.x += velocity;
        velocity *= 0.92; // 減衰率（摩擦）

        // 境界チェック（バウンス効果のために少しはみ出しを許容してから戻す処理は上記で行う）
        // ドラッグ中でないとき、大きくはみ出していたら減衰を強める
        const minX = W - totalHandWidth;
        if (innerHand.x > 0 || innerHand.x < minX) {
            velocity *= 0.5; // 端に達したら急減速
        }
      };
      
      // Tickerへの登録とクリーンアップ
      PIXI.Ticker.shared.add(inertiaTicker);
      handContainer.on('destroyed', () => {
        PIXI.Ticker.shared.remove(inertiaTicker);
      });

      handContainer.on('pointerdown', (e) => {
        isDragging = true;
        startX = e.global.x;
        lastX = startX;
        containerStartX = innerHand.x;
        velocity = 0; // ドラッグ開始時は速度リセット
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
        const currentX = e.global.x;
        const dx = currentX - startX;
        
        // 速度計算
        velocity = currentX - lastX;
        lastX = currentX;

        let newX = containerStartX + dx;

        // 端での抵抗感
        const minX = W - totalHandWidth;
        if (newX > 0) {
            newX = newX * 0.5;
        } else if (newX < minX) {
            newX = minX + (newX - minX) * 0.5;
        }

        innerHand.x = newX;
      });
    }
    side.addChild(handContainer);
  }

  return side;
};
