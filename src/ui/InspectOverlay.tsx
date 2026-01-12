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
  mask.drawRect(0, 0, panelW - 40, panelH - 120);
  mask.endFill();
  listContainer.mask = mask;
  panel.addChild(mask);
  panel.addChild(listContainer);

  const cardW = 70;
  const cardH = 98;
  const gap = 20;
  const innerW = cards.length * (cardW + gap);
  const viewW = panelW - 40;
  const maxScroll = Math.max(0, innerW - viewW);

  // --- スクロールバーの実装 ---
  const barTrack = new PIXI.Graphics();
  const barY = panelH - 45;
  barTrack.beginFill(0x333333);
  barTrack.drawRoundedRect(20, barY, viewW, 10, 5);
  barTrack.endFill();
  panel.addChild(barTrack);

  const thumbW = Math.max(40, (viewW / innerW) * viewW);
  const barThumb = new PIXI.Graphics();
  barThumb.beginFill(0x888888);
  barThumb.drawRoundedRect(0, 0, thumbW, 10, 5);
  barThumb.endFill();
  barThumb.position.set(20, barY);
  barThumb.eventMode = 'static';
  barThumb.cursor = 'pointer';
  panel.addChild(barThumb);

  const updateListPosFromThumb = (thumbX: number) => {
    const ratio = (thumbX - 20) / (viewW - thumbW);
    const newX = 20 - ratio * maxScroll;
    listContainer.x = newX;
    if (onScroll) onScroll(newX);
  };

  const updateThumbPosFromList = (listX: number) => {
    const ratio = (20 - listX) / maxScroll;
    const thumbX = 20 + ratio * (viewW - thumbW);
    barThumb.x = thumbX;
  };

  updateThumbPosFromList(initialScrollX);

  let thumbDragging = false;
  barThumb.on('pointerdown', (e) => { e.stopPropagation(); thumbDragging = true; });
  window.addEventListener('pointerup', () => { thumbDragging = false; });
  window.addEventListener('pointermove', (e) => {
    if (!thumbDragging) return;
    const rect = panel.getBounds();
    let newThumbX = (e.clientX - rect.x) - thumbW / 2;
    if (newThumbX < 20) newThumbX = 20;
    if (newThumbX > 20 + viewW - thumbW) newThumbX = 20 + viewW - thumbW;
    barThumb.x = newThumbX;
    updateListPosFromThumb(newThumbX);
  });

  // --- カード描画とドラッグ入れ替え ---
  cards.forEach((card, i) => {
    const baseW = 100; 
    const baseH = 140;
    const currentFaceUp = (card as any).is_face_up;
    const isRevealed = revealedCardIds.has(card.uuid) || currentFaceUp;
    const displayCard = { ...card, is_face_up: isRevealed };

    const cardSprite = createCardContainer(displayCard, baseW, baseH, { onClick: () => {} });
    cardSprite.scale.set(cardH / baseH);
    cardSprite.position.set(i * (cardW + gap) + cardW / 2, cardH / 2);
    cardSprite.eventMode = 'static';
    cardSprite.cursor = 'grab';

    let cardDragging = false;
    let dragStartPos = { x: 0, y: 0 };
    let hasMoved = false;

    cardSprite.on('pointerdown', (e) => {
      e.stopPropagation();
      cardDragging = true;
      dragStartPos = { x: e.global.x, y: e.global.y };
      hasMoved = false;
    });

    cardSprite.on('globalpointermove', (e) => {
      if (!cardDragging) return;
      const dx = e.global.x - dragStartPos.x;
      const dy = e.global.y - dragStartPos.y;
      if (Math.sqrt(dx*dx + dy*dy) > 10) hasMoved = true;

      if (hasMoved && Math.abs(dy) > Math.abs(dx) + 20 && isRevealed) {
          onCardDown(card, { x: e.global.x, y: e.global.y });
          cardDragging = false;
      }
    });

    cardSprite.on('pointerup', (e) => {
      if (!cardDragging) return;
      if (hasMoved) {
          const dx = e.global.x - dragStartPos.x;
          const shift = Math.round(dx / (cardW + gap));
          if (shift !== 0) {
              const newIdx = Math.max(0, Math.min(cards.length - 1, i + shift));
              onReorder(card.uuid, newIdx);
          } else {
              onToggleReveal(card.uuid);
          }
      } else {
          onToggleReveal(card.uuid);
      }
      cardDragging = false;
    });

    const btn = new PIXI.Graphics();
    btn.beginFill(0x2c3e50);
    btn.lineStyle(1, 0x555555);
    btn.drawRoundedRect(-45, 75, 90, 30, 4);
    btn.endFill();
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointerdown', (e) => { e.stopPropagation(); onMoveToBottom(card.uuid); });

    const btnText = new PIXI.Text(type === 'deck' ? 'デッキ下' : 'ライフ下', { fontSize: 18, fill: '#ffffff', fontWeight: 'bold' });
    btnText.anchor.set(0.5);
    btnText.position.set(0, 90);
    btn.addChild(btnText);
    cardSprite.addChild(btn);

    listContainer.addChild(cardSprite);
  });

  return container;
};
