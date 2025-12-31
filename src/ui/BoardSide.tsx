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

  // Y座標の計算ロジック
  // 自分(Bottom): midY を起点に下(+Y)へ配置
  // 相手(Top): 0 を起点に...ではなく、相手も midY を起点に上(-Y)へ配置する形にする
  // ただし、相手コンテナ自体は RealGame.tsx で y=0 に置かれているため、
  // ここでは「画面下端(midY相当)から上へ」という計算を行う
  const getAdjustedY = (row: number) => {
    // layoutEngine.ts の getY は「上からのオフセット」を返すようになった
    const offset = coords.getY(row);
    
    if (!isOpponent) {
      // 自分: コンテナ原点は midY (RealGame.tsxで設定)
      // フィールド(Row1)が一番上(0に近い)、手札(Row4)が一番下
      // ただし getY は 0 から増えていく値なのでそのまま使える
      return offset;
    } else {
      // 相手: コンテナ原点は 0 (画面上端)
      // ここでの "bottom" は画面中央の境界線 (coords.midY)
      // フィールド(Row1)を境界線近くに置きたい -> midY - offset - CardHeight
      return coords.midY - offset - coords.CH;
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

  // Row 2: リーダー・ライフ・デッキ
  const r2Y = getAdjustedY(2);
  // Row 3: ドン・トラッシュ
  const r3Y = getAdjustedY(3);
  
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
    { uuid: `donrest-${p.player_id}`, name: 'Don!! Rest' } as any, 
    coords.CW, 
    coords.CH, 
    { ...getCardOpts({ uuid: `donrest-${p.player_id}`, name: 'Don!! Rest' } as any), count: donRestCount }
  );
  donRest.x = coords.getDonRestX(W); donRest.y = r3Y;
  side.addChild(donRest);

  // --- 手札エリア (スクロール対応) ---
  const handContainer = new PIXI.Container();
  // 手札コンテナの配置Y座標
  handContainer.y = getAdjustedY(4);
  // 表示エリアの定義 (画面幅いっぱい、高さはカード+少し余裕)
  const handAreaH = coords.CH * 1.2;
  // マスク（表示領域）の作成
  const mask = new PIXI.Graphics();
  mask.beginFill(0xffffff);
  // 手札エリアの左上(0, 0)から描画。
  // ただしhandContainer自体が移動しているので、マスクはローカル座標系かグローバルか注意が必要。
  // コンテナにマスクを適用する場合、マスクの座標はコンテナの親（side）基準になることが多いが
  // ここではシンプルに handContainer の中身をマスクするのではなく、
  // handContainer 自体をマスクしたい。
  mask.drawRect(0, handContainer.y, W, handAreaH);
  mask.endFill();
  side.addChild(mask);
  handContainer.mask = mask;

  // カードを並べる内部コンテナ
  const innerHand = new PIXI.Container();
  handContainer.addChild(innerHand);

  // 手札カードの配置
  const handList = z.hand || [];
  let totalHandWidth = 0;
  
  handList.forEach((c: CardInstance, i: number) => {
    const card = createCardContainer(c, coords.CW, coords.CH, getCardOpts(c));
    // getHandX は絶対座標を返すが、innerHand内での相対座標として扱うため調整が必要
    // layoutEngine の getHandX は width * ratio + i * overlap
    // ここでは innerHand 内で 左端(0) から並べていく形にする
    const xPos = coords.getHandX(i, W);
    // しかし getHandX は画面全体での位置を返している。
    // スクロールさせるなら、最初は画面左端(に近い位置)から並べたい。
    // layoutEngine.getHandX をそのまま使うと、画面幅に応じた初期位置になる。
    card.x = xPos;
    card.y = 0; // handContainer内でのYは0
    innerHand.addChild(card);
    
    // 全体の幅を記録 (最後のカードの右端)
    if (i === handList.length - 1) {
      totalHandWidth = xPos + coords.CW + 20; // 20は余白
    }
  });

  // スクロール機能の実装
  // 手札が画面幅を超えている場合のみ有効化
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

      // 境界チェック
      // 右端: newX は 0 以下になる (左にスクロール)
      // 左端: newX は 0 (初期位置)
      const minX = W - totalHandWidth;
      if (newX > 0) newX = 0;
      if (newX < minX) newX = minX;

      innerHand.x = newX;
    });
  }

  side.addChild(handContainer);

  return side;
};
