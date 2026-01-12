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

  const panelW = W * 0.9;
  const panelH = Math.min(H * 0.45, 320); 
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

  const titleStyle = new PIXI.TextStyle({ fontFamily: 'serif', fontSize: 18, fontWeight: 'bold', fill: '#ffffff' });
  const title = new PIXI.Text(`${type.toUpperCase()} (${cards.length})`, titleStyle);
  title.position.set(15, 10);
  panel.addChild(title);

  const revealAllBtn = new PIXI.Graphics();
  revealAllBtn.beginFill(0x27ae60);
  revealAllBtn.drawRoundedRect(0, 0, 90, 26, 4);
  revealAllBtn.endFill();
  revealAllBtn.position.set(panelW - 130, 8);
  revealAllBtn.eventMode = 'static';
  revealAllBtn.cursor = 'pointer';
  revealAllBtn.on('pointerdown', (e) => { e.stopPropagation(); onRevealAll(); });
  
  const raText = new PIXI.Text('すべて表示', { fontSize: 14, fill: '#ffffff', fontWeight: 'bold' });
  raText.anchor.set(0.5);
  raText.position.set(45, 13);
  revealAllBtn.addChild(raText);
  panel.addChild(revealAllBtn);

  const closeBtn = new PIXI.Text('×', { ...titleStyle, fontSize: 24, fill: '#aaaaaa' });
  closeBtn.position.set(panelW - 30, 5);
  closeBtn.eventMode = 'static';
  closeBtn.cursor = 'pointer';
  closeBtn.on('pointerdown', onClose);
  panel.addChild(closeBtn);

  const listContainer = new PIXI.Container();
  listContainer.position.set(initialScrollX, 50);
  
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

    const btn = new PIXI.Graphics();
    btn.beginFill(0x34495e);
    btn.drawRoundedRect(-cardW / 2, 45, cardW, 24, 4);
    btn.endFill();
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointerdown', (e) => {
      e.stopPropagation();
      onMoveToBottom(card.uuid);
    });

    const btnLabel = type === 'deck' ? 'デッキ下' : 'ライフ下';
    const btnText = new PIXI.Text(btnLabel, { fontSize: 18, fill: '#ffffff' });
    btnText.anchor.set(0.5);
    btnText.position.set(0, 57);
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
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 10) {
        if (pendingCard) {
            if (Math.abs(dy) > Math.abs(dx)) {
                const currentFaceUp = (pendingCard.card as any).is_face_up;
                const isRevealed = revealedCardIds.has(pendingCard.card.uuid) || currentFaceUp;
                if (isRevealed) {
                    onCardDown(pendingCard.card, { x: e.global.x, y: e.global.y });
                    pendingCard = null; isScrolling = false;
                } else {
                    pendingCard = null; isScrolling = false;
                }
                return;
            } else {
                isScrolling = true; pendingCard = null; 
            }
        }
    }
    if (isScrolling) {
        let newX = scrollStartX + dx;
        if (newX > 15) newX = 15;
        if (newX < 15 - maxScroll) newX = 15 - maxScroll;
        listContainer.x = newX;
        if (onScroll) onScroll(newX);
    }
  });

  const endDrag = () => {
      if (pendingCard) onToggleReveal(pendingCard.card.uuid);
      isScrolling = false; pendingCard = null;
  };
  panel.on('pointerup', endDrag);
  panel.on('pointerupoutside', endDrag);

  return container;
};
