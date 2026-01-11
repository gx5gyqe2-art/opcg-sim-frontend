import * as PIXI from 'pixi.js';
import { createCardContainer } from './CardRenderer';
import { LAYOUT_CONSTANTS } from '../layout/layout.config';
import type { CardInstance } from '../game/types';

export const createInspectOverlay = (
  type: string,
  cards: CardInstance[],
  W: number,
  H: number,
  onClose: () => void,
  onCardDown: (e: PIXI.FederatedPointerEvent, card: CardInstance, sprite: PIXI.Container) => void
) => {
  const container = new PIXI.Container();

  // 1. 背景 (全画面クリックで閉じる)
  const bg = new PIXI.Graphics();
  bg.beginFill(0x000000, 0.7);
  bg.drawRect(0, 0, W, H);
  bg.endFill();
  bg.eventMode = 'static';
  bg.on('pointerdown', onClose);
  container.addChild(bg);

  // 2. パネル本体
  const panelW = W * 0.9;
  const panelH = Math.min(H * 0.4, 300); 
  const panelX = (W - panelW) / 2;
  const panelY = 60;

  const panel = new PIXI.Graphics();
  panel.beginFill(0x222222, 0.95);
  panel.lineStyle(2, 0x555555);
  panel.drawRoundedRect(0, 0, panelW, panelH, 8);
  panel.endFill();
  panel.position.set(panelX, panelY);
  panel.eventMode = 'static'; 
  // パネル自体のクリックは背景に伝播させない
  panel.on('pointerdown', (e) => e.stopPropagation());
  
  container.addChild(panel);

  // 3. ヘッダーテキスト
  const titleStyle = new PIXI.TextStyle({
    fontFamily: 'Arial',
    fontSize: 18,
    fontWeight: 'bold',
    fill: '#ffffff',
  });
  const title = new PIXI.Text(`${type.toUpperCase()} (${cards.length})`, titleStyle);
  title.position.set(15, 10);
  panel.addChild(title);

  // 4. 閉じるボタン
  const closeBtn = new PIXI.Text('×', { ...titleStyle, fontSize: 24, fill: '#aaaaaa' });
  closeBtn.position.set(panelW - 30, 5);
  closeBtn.eventMode = 'static';
  closeBtn.cursor = 'pointer';
  closeBtn.on('pointerdown', onClose);
  panel.addChild(closeBtn);

  // 5. カードリスト（横スクロールコンテナ）
  const listContainer = new PIXI.Container();
  listContainer.position.set(15, 50);
  
  // マスク
  const mask = new PIXI.Graphics();
  mask.beginFill(0xffffff);
  mask.drawRect(0, 0, panelW - 30, panelH - 60);
  mask.endFill();
  listContainer.mask = mask;
  panel.addChild(mask);
  panel.addChild(listContainer);

  const cardW = 60;
  const cardH = 84;
  const gap = 10;

  // --- 操作判定用変数 ---
  let isScrolling = false;
  let startPos = { x: 0, y: 0 };
  let scrollStartX = 0;
  // 押下中のカード情報
  let pendingCard: { card: CardInstance, sprite: PIXI.Container, e: PIXI.FederatedPointerEvent } | null = null;

  const maxScroll = Math.max(0, cards.length * (cardW + gap) - (panelW - 30));

  cards.forEach((card, i) => {
    const baseW = 100; 
    const baseH = 140;
    
    // 確認用なので表向きにする
    const displayCard = { ...card, is_face_up: true };
    const cardSprite = createCardContainer(displayCard, baseW, baseH, { onClick: () => {} });
    
    const scale = cardH / baseH;
    cardSprite.scale.set(scale);
    
    const x = i * (cardW + gap) + cardW / 2;
    const y = cardH / 2;
    cardSprite.position.set(x, y);

    cardSprite.eventMode = 'static';
    cardSprite.cursor = 'grab';
    
    // カード押下時: 即座にドラッグせず、判定待ち状態にする
    cardSprite.on('pointerdown', (e) => {
      e.stopPropagation();
      pendingCard = { card, sprite: cardSprite, e: e.clone() }; // イベントをクローンして保持
      startPos = { x: e.global.x, y: e.global.y };
      scrollStartX = listContainer.x;
      isScrolling = false; // まだスクロール確定ではない
    });

    listContainer.addChild(cardSprite);
  });

  // パネル背景（カード以外）を押した場合
  panel.on('pointerdown', (e) => {
    isScrolling = true; // カード以外なら即スクロールモード
    startPos = { x: e.global.x, y: e.global.y };
    scrollStartX = listContainer.x;
    pendingCard = null;
  });

  // グローバルムーブイベント（ドラッグ判定）
  panel.on('globalpointermove', (e) => {
    if (!pendingCard && !isScrolling) return;

    const dx = e.global.x - startPos.x;
    const dy = e.global.y - startPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 閾値 (10px) を超えたら判定
    if (dist > 10) {
        // カードを押下中で、まだモード未確定の場合
        if (pendingCard) {
            // 縦移動が大きい -> カード取り出しドラッグ開始
            if (Math.abs(dy) > Math.abs(dx)) {
                // ここで外部のドラッグ開始処理を呼ぶ
                // 保持していたイベント情報を使って開始位置を補正
                onCardDown(e, pendingCard.card, pendingCard.sprite);
                pendingCard = null;
                isScrolling = false;
                return;
            } else {
                // 横移動が大きい -> スクロールモードへ移行
                isScrolling = true;
                pendingCard = null; // カードドラッグはキャンセル
            }
        }
    }

    // スクロール処理
    if (isScrolling) {
        let newX = scrollStartX + dx;
        // 範囲制限 (バウンスなし)
        if (newX > 0) newX = 0;
        if (newX < -maxScroll) newX = -maxScroll;
        listContainer.x = newX;
    }
  });

  const endDrag = () => {
      isScrolling = false;
      pendingCard = null;
  };

  panel.on('pointerup', endDrag);
  panel.on('pointerupoutside', endDrag);

  return container;
};
