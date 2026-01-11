import * as PIXI from 'pixi.js';
import { createCardContainer } from './CardRenderer';
import type { CardInstance } from '../game/types';

export const createInspectOverlay = (
  type: string,
  cards: CardInstance[],
  revealedCardIds: Set<string>,
  W: number,
  H: number,
  onClose: () => void,
  onCardDown: (card: CardInstance, startPos: { x: number, y: number }) => void,
  onToggleReveal: (uuid: string) => void
) => {
  const container = new PIXI.Container();

  // 1. 背景
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

  // 5. カードリスト
  const listContainer = new PIXI.Container();
  listContainer.position.set(15, 50);
  
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

  let isScrolling = false;
  let startPos = { x: 0, y: 0 };
  let scrollStartX = 0;
  let pendingCard: { card: CardInstance, e: PIXI.FederatedPointerEvent } | null = null;

  const maxScroll = Math.max(0, cards.length * (cardW + gap) - (panelW - 30));

  cards.forEach((card, i) => {
    const baseW = 100; 
    const baseH = 140;
    
    // 型キャストで is_face_up にアクセス
    const currentFaceUp = (card as any).is_face_up;
    const isFaceUp = revealedCardIds.has(card.uuid) || currentFaceUp;
    const displayCard = { ...card, is_face_up: isFaceUp };

    const cardSprite = createCardContainer(displayCard, baseW, baseH, { onClick: () => {} });
    
    const scale = cardH / baseH;
    cardSprite.scale.set(scale);
    
    const x = i * (cardW + gap) + cardW / 2;
    const y = cardH / 2;
    cardSprite.position.set(x, y);

    cardSprite.eventMode = 'static';
    cardSprite.cursor = 'grab';
    
    cardSprite.on('pointerdown', (e) => {
      e.stopPropagation();
      pendingCard = { card, e }; 
      startPos = { x: e.global.x, y: e.global.y };
      scrollStartX = listContainer.x;
      isScrolling = false;
    });

    listContainer.addChild(cardSprite);
  });

  panel.on('pointerdown', (e) => {
    isScrolling = true; 
    startPos = { x: e.global.x, y: e.global.y };
    scrollStartX = listContainer.x;
    pendingCard = null;
  });

  panel.on('globalpointermove', (e) => {
    if (!pendingCard && !isScrolling) return;

    const dx = e.global.x - startPos.x;
    const dy = e.global.y - startPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 10) {
        if (pendingCard) {
            if (Math.abs(dy) > Math.abs(dx)) {
                // 縦移動: ドラッグ開始
                // 型キャスト
                const currentFaceUp = (pendingCard.card as any).is_face_up;
                const isRevealed = revealedCardIds.has(pendingCard.card.uuid) || currentFaceUp;
                
                if (isRevealed) {
                    onCardDown(pendingCard.card, { x: e.global.x, y: e.global.y });
                    pendingCard = null;
                    isScrolling = false;
                } else {
                    pendingCard = null;
                    isScrolling = false;
                }
                return;
            } else {
                isScrolling = true;
                pendingCard = null; 
            }
        }
    }

    if (isScrolling) {
        let newX = scrollStartX + dx;
        if (newX > 0) newX = 0;
        if (newX < -maxScroll) newX = -maxScroll;
        listContainer.x = newX;
    }
  });

  const endDrag = () => {
      if (pendingCard) {
          onToggleReveal(pendingCard.card.uuid);
      }

      isScrolling = false;
      pendingCard = null;
  };

  panel.on('pointerup', endDrag);
  panel.on('pointerupoutside', endDrag);

  return container;
};
