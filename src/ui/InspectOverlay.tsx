import * as PIXI from 'pixi.js';
import { createCardContainer } from './CardRenderer';
import type { CardInstance } from '../game/types';

export const createInspectOverlay = (
  type: string,
  cards: CardInstance[],
  revealedCardIds: Set<string>,
  W: number,
  H: number,
  initialScrollX: number,
  onClose: () => void,
  onCardDown: (card: CardInstance, startPos: { x: number, y: number }) => void,
  onToggleReveal: (uuid: string) => void,
  onRevealAll: () => void,
  onMoveToBottom: (uuid: string) => void,
  onReorder: (uuid: string, newIndex: number) => void,
  onScroll?: (x: number) => void
) => {
  const container = new PIXI.Container();

  const bg = new PIXI.Graphics();
  bg.beginFill(0x000000, 0.7);
  bg.drawRect(0, 0, W, H);
  bg.endFill();
  bg.eventMode = 'static';
  bg.on('pointerdown', onClose);
  container.addChild(bg);

  const panelW = W * 0.95;
  const panelH = Math.min(H * 0.55, 400); 
  const panelX = (W - panelW) / 2;
  const panelY = 50;

  const panel = new PIXI.Graphics();
  panel.beginFill(0x1a1a1a, 0.98);
  panel.lineStyle(2, 0x444444);
  panel.drawRoundedRect(0, 0, panelW, panelH, 12);
  panel.endFill();
  panel.position.set(panelX, panelY);
  panel.eventMode = 'static'; 
  panel.on('pointerdown', (e) => e.stopPropagation());
  container.addChild(panel);

  const titleStyle = new PIXI.TextStyle({ fontFamily: 'serif', fontSize: 18, fontWeight: 'bold', fill: '#ffd700' });
  const title = new PIXI.Text(`${type.toUpperCase()} (${cards.length})`, titleStyle);
  title.position.set(20, 15);
  panel.addChild(title);

  const revealAllBtn = new PIXI.Graphics();
  revealAllBtn.beginFill(0x27ae60);
  revealAllBtn.drawRoundedRect(0, 0, 100, 30, 6);
  revealAllBtn.endFill();
  revealAllBtn.position.set(panelW - 160, 10);
  revealAllBtn.eventMode = 'static';
  revealAllBtn.cursor = 'pointer';
  revealAllBtn.on('pointerdown', (e) => { e.stopPropagation(); onRevealAll(); });
  const raText = new PIXI.Text('すべて表示', { fontSize: 14, fill: '#ffffff', fontWeight: 'bold' });
  raText.anchor.set(0.5);
  raText.position.set(50, 15);
  revealAllBtn.addChild(raText);
  panel.addChild(revealAllBtn);

  const closeBtn = new PIXI.Text('×', { ...titleStyle, fontSize: 28, fill: '#ffffff' });
  closeBtn.position.set(panelW - 40, 8);
  closeBtn.eventMode = 'static';
  closeBtn.cursor = 'pointer';
  closeBtn.on('pointerdown', onClose);
  panel.addChild(closeBtn);

  const listContainer = new PIXI.Container();
  listContainer.position.set(initialScrollX, 60);
  listContainer.sortableChildren = true; // 重要: これがないとzIndexが効かない
  
  const mask = new PIXI.Graphics();
  mask.beginFill(0xffffff);
  mask.drawRect(0, 0, panelW - 40, panelH - 80);
  mask.endFill();
  listContainer.mask = mask;
  panel.addChild(mask);
  panel.addChild(listContainer);

  const cardW = 70;
  const cardH = 98;
  const gap = 20;
  const maxScroll = Math.max(0, cards.length * (cardW + gap) - (panelW - 40));

  let isScrolling = false;
  let startPos = { x: 0, y: 0 };
  let scrollStartX = 0;
  let draggingSprite: PIXI.Container | null = null;
  let draggingCard: CardInstance | null = null;
  let draggingIndex = -1;
  let dragOffset = { x: 0, y: 0 };
  let originalPos = { x: 0, y: 0 };
  let originalScale = { x: 1, y: 1 };

  cards.forEach((card, i) => {
    const baseW = 100; 
    const baseH = 140;
    const isRevealed = revealedCardIds.has(card.uuid) || (card as any).is_face_up;
    const displayCard = { ...card, is_face_up: isRevealed };

    const cardSprite = createCardContainer(displayCard, baseW, baseH, { onClick: () => {} });
    const scale = cardH / baseH;
    cardSprite.scale.set(scale);
    const initialX = i * (cardW + gap) + cardW / 2;
    const initialY = cardH / 2;
    cardSprite.position.set(initialX, initialY);
    cardSprite.eventMode = 'static';
    cardSprite.cursor = 'grab';
    cardSprite.zIndex = 0;
    
    cardSprite.on('pointerdown', (e) => {
      e.stopPropagation();
      draggingCard = card;
      draggingIndex = i;
      draggingSprite = cardSprite;
      startPos = { x: e.global.x, y: e.global.y };
      scrollStartX = listContainer.x;
      originalPos = { x: cardSprite.x, y: cardSprite.y };
      originalScale = { x: cardSprite.scale.x, y: cardSprite.scale.y };
      
      const localPos = listContainer.toLocal(e.global);
      dragOffset = { x: cardSprite.x - localPos.x, y: cardSprite.y - localPos.y };
      
      isScrolling = false;
    });

    const btn = new PIXI.Graphics();
    btn.beginFill(0x2c3e50);
    btn.lineStyle(1, 0x555555);
    btn.drawRoundedRect(-50, baseH / 2 + 25, 100, 45, 8);
    btn.endFill();
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointerdown', (e) => { e.stopPropagation(); onMoveToBottom(card.uuid); });
    const btnText = new PIXI.Text(type === 'deck' ? 'デッキ下' : 'ライフ下', { fontSize: 20, fill: '#ffffff', fontWeight: 'bold' });
    btnText.anchor.set(0.5);
    btnText.position.set(0, baseH / 2 + 47);
    btn.addChild(btnText);
    cardSprite.addChild(btn);

    listContainer.addChild(cardSprite);
  });

  panel.on('pointerdown', (e) => {
    isScrolling = true; 
    startPos = { x: e.global.x, y: e.global.y };
    scrollStartX = listContainer.x;
    draggingSprite = null;
  });

  panel.on('globalpointermove', (e) => {
    if (isScrolling && !draggingSprite) {
      const dx = e.global.x - startPos.x;
      let newX = scrollStartX + dx;
      if (newX > 20) newX = 20;
      if (newX < 20 - maxScroll) newX = 20 - maxScroll;
      listContainer.x = newX;
      if (onScroll) onScroll(newX);
      return;
    }

    if (draggingSprite && draggingCard) {
        const dx = e.global.x - startPos.x;
        const dy = e.global.y - startPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 5) {
            if (Math.abs(dy) > Math.abs(dx) + 20) {
                // 縦方向へ大きく移動 → 盤面へのドラッグとみなす
                const isRevealed = revealedCardIds.has(draggingCard.uuid) || (draggingCard as any).is_face_up;
                if (isRevealed) {
                    // リセットしてからコールバック
                    draggingSprite.position.set(originalPos.x, originalPos.y);
                    draggingSprite.scale.set(originalScale.x, originalScale.y);
                    draggingSprite.zIndex = 0;
                    
                    onCardDown(draggingCard, { x: e.global.x, y: e.global.y });
                    draggingSprite = null; 
                    draggingCard = null;
                    return;
                }
            }
            
            // 横移動 → リオーダー
            draggingSprite.zIndex = 1000;
            draggingSprite.alpha = 0.9;
            draggingSprite.scale.set(originalScale.x * 1.1); // 少し大きくして浮遊感を出す
            const localPos = listContainer.toLocal(e.global);
            draggingSprite.position.set(localPos.x + dragOffset.x, originalPos.y); 
        }
    }
  });

  const endDrag = (e: PIXI.FederatedPointerEvent) => {
      if (draggingSprite && draggingCard) {
          const dx = e.global.x - startPos.x;
          // ドラッグ終了処理
          if (Math.abs(dx) > cardW / 2) {
              const shift = Math.round(dx / (cardW + gap));
              const newIdx = Math.max(0, Math.min(cards.length - 1, draggingIndex + shift));
              if (newIdx !== draggingIndex) {
                  onReorder(draggingCard.uuid, newIdx);
              } else {
                  // 元の位置に戻すアニメーション等は省略、即座にリセット
                  draggingSprite.position.set(originalPos.x, originalPos.y);
              }
          } else {
              draggingSprite.position.set(originalPos.x, originalPos.y);
              // 移動が小さければクリック（裏表反転）とみなす
              if (Math.sqrt(dx*dx) < 5) onToggleReveal(draggingCard.uuid);
          }
          
          // スタイルリセット
          draggingSprite.zIndex = 0;
          draggingSprite.alpha = 1;
          draggingSprite.scale.set(originalScale.x, originalScale.y);
      }
      isScrolling = false;
      draggingSprite = null;
      draggingCard = null;
  };

  panel.on('pointerup', endDrag);
  panel.on('pointerupoutside', endDrag);

  return container;
};
