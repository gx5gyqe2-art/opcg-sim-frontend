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
  listContainer.sortableChildren = true; // zIndexを有効化
  
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
  
  // ドラッグ中の状態管理
  let draggingSprite: PIXI.Container | null = null;
  let draggingCard: CardInstance | null = null;
  let draggingIndex = -1;
  let dragOffset = { x: 0, y: 0 };
  let originalPos = { x: 0, y: 0 };

  cards.forEach((card, i) => {
    const baseW = 100; 
    const baseH = 140;
    const isRevealed = revealedCardIds.has(card.uuid) || (card as any).is_face_up;
    const displayCard = { ...card, is_face_up: isRevealed };

    const cardSprite = createCardContainer(displayCard, baseW, baseH, { onClick: () => {} });
    cardSprite.scale.set(cardH / baseH);
    const initialX = i * (cardW + gap) + cardW / 2;
    const initialY = cardH / 2;
    cardSprite.position.set(initialX, initialY);
    cardSprite.eventMode = 'static';
    cardSprite.cursor = 'grab';
    cardSprite.zIndex = 0; // デフォルトのzIndex
    
    cardSprite.on('pointerdown', (e) => {
      e.stopPropagation();
      draggingCard = card;
      draggingIndex = i;
      draggingSprite = cardSprite;
      startPos = { x: e.global.x, y: e.global.y };
      scrollStartX = listContainer.x;
      originalPos = { x: cardSprite.x, y: cardSprite.y };
      
      // コンテナ内でのローカル座標に変換してオフセットを保持
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
    // 1. スクロール処理
    if (isScrolling && !draggingSprite) {
      const dx = e.global.x - startPos.x;
      let newX = scrollStartX + dx;
      if (newX > 20) newX = 20;
      if (newX < 20 - maxScroll) newX = 20 - maxScroll;
      listContainer.x = newX;
      if (onScroll) onScroll(newX);
      return;
    }

    // 2. カードドラッグ処理
    if (draggingSprite && draggingCard) {
        const dx = e.global.x - startPos.x;
        const dy = e.global.y - startPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // 一定距離動くまでは判定しない
        if (dist > 5) {
            // 縦移動が大きい場合 -> 盤面へのドラッグ開始とみなす
            if (Math.abs(dy) > Math.abs(dx) + 20) {
                const currentFaceUp = (draggingCard as any).is_face_up;
                const isRevealed = revealedCardIds.has(draggingCard.uuid) || currentFaceUp;
                if (isRevealed) {
                    onCardDown(draggingCard, { x: e.global.x, y: e.global.y });
                    draggingSprite = null; 
                    draggingCard = null;
                    return;
                }
            }
            
            // 横移動が大きい場合 -> リオーダーのための移動アニメーション
            // zIndexを上げて浮いているように見せる
            draggingSprite.zIndex = 100;
            const localPos = listContainer.toLocal(e.global);
            draggingSprite.position.set(localPos.x + dragOffset.x, originalPos.y); // Y軸は固定
        }
    }
  });

  const endDrag = (e: PIXI.FederatedPointerEvent) => {
      if (draggingSprite && draggingCard) {
          const dx = e.global.x - startPos.x;
          const dy = e.global.y - startPos.y;
          
          // ドラッグ終了時、移動量が十分大きければリオーダーを実行
          if (Math.abs(dx) > cardW / 2 && Math.abs(dy) < 50) {
              const shift = Math.round(dx / (cardW + gap));
              const newIdx = Math.max(0, Math.min(cards.length - 1, draggingIndex + shift));
              if (newIdx !== draggingIndex) {
                  onReorder(draggingCard.uuid, newIdx);
              } else {
                  // 元の位置に戻す
                  draggingSprite.position.set(originalPos.x, originalPos.y);
                  draggingSprite.zIndex = 0;
                  // クリック判定（移動なし）なら裏表反転
                  if (Math.sqrt(dx*dx + dy*dy) < 5) onToggleReveal(draggingCard.uuid);
              }
          } else {
              // 元の位置に戻す
              draggingSprite.position.set(originalPos.x, originalPos.y);
              draggingSprite.zIndex = 0;
              // クリック判定
              if (Math.sqrt(dx*dx + dy*dy) < 5) onToggleReveal(draggingCard.uuid);
          }
      }
      isScrolling = false;
      draggingSprite = null;
      draggingCard = null;
  };

  panel.on('pointerup', endDrag);
  panel.on('pointerupoutside', endDrag);

  return container;
};
