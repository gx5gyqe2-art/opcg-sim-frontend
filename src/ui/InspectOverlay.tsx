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
  const panelH = Math.min(H * 0.55, 420); 
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
  let pendingCard: { card: CardInstance, index: number, e: PIXI.FederatedPointerEvent } | null = null;

  cards.forEach((card, i) => {
    const baseW = 100; 
    const baseH = 140;
    const isRevealed = revealedCardIds.has(card.uuid) || (card as any).is_face_up;
    const displayCard = { ...card, is_face_up: isRevealed };

    const cardSprite = createCardContainer(displayCard, baseW, baseH, { onClick: () => {} });
    cardSprite.scale.set(cardH / baseH);
    cardSprite.position.set(i * (cardW + gap) + cardW / 2, cardH / 2);
    cardSprite.eventMode = 'static';
    cardSprite.cursor = 'grab';
    
    cardSprite.on('pointerdown', (e) => {
      e.stopPropagation();
      pendingCard = { card, index: i, e }; 
      startPos = { x: e.global.x, y: e.global.y };
      scrollStartX = listContainer.x;
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
    pendingCard = null;
  });

  panel.on('globalpointermove', (e) => {
    if (!pendingCard && !isScrolling) return;
    const dx = e.global.x - startPos.x;
    const dy = e.global.y - startPos.y;

    if (pendingCard && Math.sqrt(dx*dx + dy*dy) > 10) {
        if (Math.abs(dy) > Math.abs(dx) + 20) {
            if ((pendingCard.card as any).is_face_up || revealedCardIds.has(pendingCard.card.uuid)) {
                onCardDown(pendingCard.card, { x: e.global.x, y: e.global.y });
                pendingCard = null; isScrolling = false; return;
            }
        }
        if (Math.abs(dx) > 15) isScrolling = false;
    }

    if (isScrolling) {
        let newX = scrollStartX + dx;
        if (newX > 20) newX = 20;
        if (newX < 20 - maxScroll) newX = 20 - maxScroll;
        listContainer.x = newX;
        if (onScroll) onScroll(newX);
    }
  });

  const endDrag = (e: PIXI.FederatedPointerEvent) => {
      if (pendingCard) {
          const dx = e.global.x - startPos.x;
          if (Math.abs(dx) > cardW / 2) {
              const shift = Math.round(dx / (cardW + gap));
              const newIdx = Math.max(0, Math.min(cards.length - 1, pendingCard.index + shift));
              if (newIdx !== pendingCard.index) {
                  onReorder(pendingCard.card.uuid, newIdx);
                  pendingCard = null; return;
              }
          }
          onToggleReveal(pendingCard.card.uuid);
      }
      isScrolling = false; pendingCard = null;
  };

  panel.on('pointerup', endDrag);
  panel.on('pointerupoutside', endDrag);

  return container;
};
