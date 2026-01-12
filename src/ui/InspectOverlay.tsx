import * as PIXI from 'pixi.js';
import { createCardContainer } from './CardRenderer';
import type { CardInstance } from '../game/types';
import { LAYOUT_PARAMS } from '../layout/layout.config';

// オーバーレイコンテナに更新用メソッドを追加した型定義
export interface InspectOverlayContainer extends PIXI.Container {
  updateLayout: (draggingGlobalX: number | null, draggingUuid: string | null) => void;
  updateScroll: (x: number) => void;
}

// レンダリング用の基準解像度（きれいに表示するための内部サイズ）
const BASE_CARD_WIDTH = 120;
const BASE_CARD_HEIGHT = BASE_CARD_WIDTH * LAYOUT_PARAMS.CARD.ASPECT_RATIO;

// 実際に表示するサイズ（以前のサイズ感に合わせる）
const DISPLAY_CARD_WIDTH = 70; 
const CARD_GAP = 15;
const TOTAL_CARD_WIDTH = DISPLAY_CARD_WIDTH + CARD_GAP;

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
  onScrollCallback: (x: number) => void
): InspectOverlayContainer => {
  const container = new PIXI.Container() as InspectOverlayContainer;

  // 背景
  const bg = new PIXI.Graphics();
  bg.beginFill(0x000000, 0.85);
  bg.drawRect(0, 0, W, H);
  bg.endFill();
  bg.eventMode = 'static';
  bg.on('pointerdown', onClose);
  container.addChild(bg);

  // --- レイアウト定数 ---
  const PADDING = 20;
  const HEADER_HEIGHT = 60;
  const SCROLL_ZONE_HEIGHT = 80;
  const PANEL_W = Math.min(W * 0.95, 1200);
  const PANEL_X = (W - PANEL_W) / 2;
  const PANEL_Y = 50;
  const PANEL_H = Math.min(H * 0.7, 500);

  const CARD_AREA_Y = HEADER_HEIGHT + PADDING;
  const LIST_H = PANEL_H - HEADER_HEIGHT - SCROLL_ZONE_HEIGHT;
  
  // パネル背景
  const panel = new PIXI.Graphics();
  panel.beginFill(0x1a1a1a, 0.98);
  panel.lineStyle(2, 0x444444);
  panel.drawRoundedRect(0, 0, PANEL_W, PANEL_H, 12);
  panel.endFill();
  panel.position.set(PANEL_X, PANEL_Y);
  panel.eventMode = 'static';
  panel.on('pointerdown', (e) => e.stopPropagation());
  container.addChild(panel);

  // --- ヘッダー要素 ---
  const titleStyle = new PIXI.TextStyle({ fontFamily: 'Arial', fontSize: 20, fontWeight: 'bold', fill: '#ffd700' });
  const title = new PIXI.Text(`${type.toUpperCase()} INSPECT (${cards.length})`, titleStyle);
  title.position.set(PADDING, PADDING);
  panel.addChild(title);

  const closeBtn = new PIXI.Text("×", { ...titleStyle, fontSize: 30, fill: '#ffffff' });
  closeBtn.eventMode = 'static';
  closeBtn.cursor = 'pointer';
  closeBtn.position.set(PANEL_W - PADDING - 10, 10);
  closeBtn.on('pointerdown', onClose);
  panel.addChild(closeBtn);

  if (type !== 'trash') {
    const revealBtn = new PIXI.Container();
    const rBg = new PIXI.Graphics().beginFill(0x27ae60).drawRoundedRect(0, 0, 120, 30, 4).endFill();
    const rTxt = new PIXI.Text("REVEAL ALL", { fontSize: 14, fill: 'white', fontWeight: 'bold' });
    rTxt.anchor.set(0.5); rTxt.position.set(60, 15);
    revealBtn.addChild(rBg, rTxt);
    revealBtn.position.set(PANEL_W - 200, 15);
    revealBtn.eventMode = 'static';
    revealBtn.cursor = 'pointer';
    revealBtn.on('pointerdown', onRevealAll);
    panel.addChild(revealBtn);
  }

  // --- カードリストエリア ---
  const listContainer = new PIXI.Container();
  const mask = new PIXI.Graphics();
  mask.beginFill(0xffffff);
  mask.drawRect(0, CARD_AREA_Y, PANEL_W, LIST_H);
  mask.endFill();
  panel.addChild(mask);
  listContainer.mask = mask;
  listContainer.y = CARD_AREA_Y;
  panel.addChild(listContainer);

  let currentScrollX = initialScrollX;
  const maxScroll = Math.max(0, cards.length * TOTAL_CARD_WIDTH - PANEL_W + PADDING * 2);
  
  const cardSprites: { sprite: PIXI.Container, card: CardInstance, originalIndex: number }[] = [];

  // カード生成
  cards.forEach((card, i) => {
    const isRevealed = type === 'trash' || type === 'hand' || revealedCardIds.has(card.uuid);
    const displayCard = { ...card, is_face_up: isRevealed };
    
    // 基準解像度で作成（CardRendererは中心基準で描画）
    const cardSprite = createCardContainer(displayCard, BASE_CARD_WIDTH, BASE_CARD_HEIGHT, { 
      onClick: () => {}
    });

    // 表示サイズに合わせてスケール (70px / 120px)
    const scale = DISPLAY_CARD_WIDTH / BASE_CARD_WIDTH;
    cardSprite.scale.set(scale);

    // 裏向きカバー
    if (!isRevealed) {
      const cover = new PIXI.Graphics();
      cover.beginFill(0x34495e);
      cover.lineStyle(2, 0xecf0f1);
      // 【修正】中心基準で描画するように座標を修正 (-w/2, -h/2)
      cover.drawRoundedRect(-BASE_CARD_WIDTH / 2, -BASE_CARD_HEIGHT / 2, BASE_CARD_WIDTH, BASE_CARD_HEIGHT, 8);
      cover.endFill();
      
      const txt = new PIXI.Text("?", { fontSize: 60, fill: "white", fontWeight: 'bold' });
      txt.anchor.set(0.5);
      // 【修正】中心基準なので (0, 0)
      txt.position.set(0, 0);
      cover.addChild(txt);
      cardSprite.addChild(cover);
    }

    // デッキ下へボタン
    const btn = new PIXI.Graphics();
    btn.beginFill(0x000000, 0.6);
    // 【修正】中心基準で座標計算 (下部マージン考慮)
    const btnH = 30;
    const btnW = BASE_CARD_WIDTH - 20;
    const btnY = BASE_CARD_HEIGHT / 2 - 25; // 中心から下に配置
    btn.drawRoundedRect(-btnW / 2, btnY - btnH / 2, btnW, btnH, 4);
    btn.endFill();

    const btnTxt = new PIXI.Text("Bot", { fontSize: 18, fill: 'white' });
    btnTxt.anchor.set(0.5);
    btnTxt.position.set(0, btnY);
    btn.addChild(btnTxt);
    
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.visible = isRevealed;
    btn.on('pointerdown', (e) => { e.stopPropagation(); onMoveToBottom(card.uuid); });
    cardSprite.addChild(btn);

    cardSprite.eventMode = 'static';
    cardSprite.cursor = 'grab';
    
    cardSprite.on('pointertap', () => {
      if (type !== 'trash') onToggleReveal(card.uuid);
    });

    cardSprite.on('pointerdown', (e) => {
      e.stopPropagation();
      onCardDown(card, { x: e.global.x, y: e.global.y });
    });

    listContainer.addChild(cardSprite);
    cardSprites.push({ sprite: cardSprite, card, originalIndex: i });
  });

  // --- スクロールゾーン ---
  const scrollZone = new PIXI.Graphics();
  const szY = PANEL_H - SCROLL_ZONE_HEIGHT;
  scrollZone.beginFill(0x222222);
  scrollZone.drawRect(0, 0, PANEL_W, SCROLL_ZONE_HEIGHT);
  scrollZone.endFill();
  scrollZone.position.set(0, szY);
  scrollZone.eventMode = 'static';
  scrollZone.cursor = 'ew-resize';
  panel.addChild(scrollZone);

  const szText = new PIXI.Text("<<< SWIPE HERE TO SCROLL >>>", { fontSize: 16, fill: 0x888888 });
  szText.anchor.set(0.5);
  szText.position.set(PANEL_W / 2, SCROLL_ZONE_HEIGHT / 2);
  scrollZone.addChild(szText);

  const scrollBar = new PIXI.Graphics();
  scrollZone.addChild(scrollBar);

  const updateScrollBar = () => {
    scrollBar.clear();
    const totalW = cards.length * TOTAL_CARD_WIDTH;
    if (totalW <= PANEL_W) return;
    
    const barW = (PANEL_W / totalW) * PANEL_W;
    const barX = (currentScrollX / (totalW - PANEL_W)) * (PANEL_W - barW);
    
    scrollBar.beginFill(0x666666);
    scrollBar.drawRoundedRect(Math.max(0, Math.min(barX, PANEL_W - barW)), 10, barW, 6, 3);
    scrollBar.endFill();
  };

  let isScrolling = false;
  let lastX = 0;

  scrollZone.on('pointerdown', (e) => {
    isScrolling = true;
    lastX = e.global.x;
  });

  const onDragMove = (e: PIXI.FederatedPointerEvent) => {
    if (!isScrolling) return;
    const dx = lastX - e.global.x;
    lastX = e.global.x;
    
    let nextX = currentScrollX + dx;
    nextX = Math.max(0, Math.min(nextX, maxScroll));
    
    container.updateScroll(nextX);
    onScrollCallback(nextX);
  };

  const onDragEnd = () => {
    isScrolling = false;
  };

  scrollZone.on('globalpointermove', onDragMove);
  scrollZone.on('pointerup', onDragEnd);
  scrollZone.on('pointerupoutside', onDragEnd);

  container.updateScroll = (x: number) => {
    currentScrollX = x;
    container.updateLayout(null, null);
    updateScrollBar();
  };

  container.updateLayout = (draggingGlobalX: number | null, draggingUuid: string | null) => {
    let gapIndex = -1;

    if (draggingUuid && draggingGlobalX !== null) {
      const listStartX = PANEL_X + container.x;
      const relativeX = draggingGlobalX + currentScrollX - listStartX;
      gapIndex = Math.floor((relativeX + TOTAL_CARD_WIDTH / 2) / TOTAL_CARD_WIDTH);
      gapIndex = Math.max(0, Math.min(gapIndex, cards.length));
    }

    cardSprites.forEach(({ sprite, card, originalIndex }) => {
      if (card.uuid === draggingUuid) {
        sprite.visible = false;
        return;
      }
      sprite.visible = true;

      let visualIndex = originalIndex;

      if (gapIndex !== -1) {
         if (originalIndex >= gapIndex) {
           visualIndex += 1;
         }
         
         const draggingItemIndex = cards.findIndex(c => c.uuid === draggingUuid);
         
         if (draggingItemIndex !== -1) {
            let adjustedIndex = originalIndex;
            if (originalIndex > draggingItemIndex) adjustedIndex -= 1;
            
             if (adjustedIndex >= gapIndex) {
                 sprite.position.set((adjustedIndex + 1) * TOTAL_CARD_WIDTH - currentScrollX, LIST_H / 2);
             } else {
                 sprite.position.set(adjustedIndex * TOTAL_CARD_WIDTH - currentScrollX, LIST_H / 2);
             }
             return;
         }
      }

      let targetX = visualIndex * TOTAL_CARD_WIDTH - currentScrollX;
      
      if (gapIndex !== -1 && draggingUuid && !cards.find(c => c.uuid === draggingUuid)) {
          if (originalIndex >= gapIndex) targetX += TOTAL_CARD_WIDTH;
      }

      sprite.position.set(targetX, LIST_H / 2);
    });
  };

  container.updateScroll(initialScrollX);

  return container;
};
