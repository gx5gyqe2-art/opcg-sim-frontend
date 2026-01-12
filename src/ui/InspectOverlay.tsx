import * as PIXI from 'pixi.js';
import { createCardContainer } from './CardRenderer';
import type { CardInstance } from '../game/types';
import { LAYOUT_PARAMS } from '../layout/layout.config';
import { API_CONFIG } from '../api/api.config';

export interface InspectOverlayContainer extends PIXI.Container {
  updateLayout: (draggingGlobalX: number | null, draggingUuid: string | null) => void;
  updateScroll: (x: number) => void;
}

const BASE_CARD_WIDTH = 120;
const BASE_CARD_HEIGHT = BASE_CARD_WIDTH * LAYOUT_PARAMS.CARD.ASPECT_RATIO;

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

  // --- レイアウト定数 (修正: 縦幅を縮小) ---
  const PADDING = 20;
  const HEADER_HEIGHT = 50; // ヘッダー高さを少し縮小
  const SCROLL_ZONE_HEIGHT = 70; // スクロールエリアも少し縮小
  const PANEL_W = Math.min(W * 0.95, 1200);
  const PANEL_X = (W - PANEL_W) / 2;
  const PANEL_Y = 20; // 上部マージンを詰める
  // 高さ: 画面の48%程度に制限し、相手エリア(上半分)に収まるようにする
  const PANEL_H = Math.min(H * 0.48, 450); 

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

  // --- ヘッダー要素 (修正: 被り防止) ---
  const titleStyle = new PIXI.TextStyle({ fontFamily: 'Arial', fontSize: 18, fontWeight: 'bold', fill: '#ffd700' });
  const title = new PIXI.Text(`${type.toUpperCase()} (${cards.length})`, titleStyle);
  title.position.set(PADDING, PADDING);
  panel.addChild(title);

  const closeBtn = new PIXI.Text("×", { ...titleStyle, fontSize: 28, fill: '#ffffff' });
  closeBtn.eventMode = 'static';
  closeBtn.cursor = 'pointer';
  closeBtn.position.set(PANEL_W - PADDING - 15, 10);
  closeBtn.on('pointerdown', onClose);
  panel.addChild(closeBtn);

  if (type !== 'trash') {
    const revealBtn = new PIXI.Container();
    const rBg = new PIXI.Graphics().beginFill(0x27ae60).drawRoundedRect(0, 0, 100, 26, 4).endFill();
    const rTxt = new PIXI.Text("REVEAL ALL", { fontSize: 12, fill: 'white', fontWeight: 'bold' });
    rTxt.anchor.set(0.5); rTxt.position.set(50, 13);
    revealBtn.addChild(rBg, rTxt);
    // 閉じるボタンの左側に配置
    revealBtn.position.set(PANEL_W - 160, 12);
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
  const cardSprites: { sprite: PIXI.Container, card: CardInstance, originalIndex: number }[] = [];

  // カード生成
  cards.forEach((card, i) => {
    const isRevealed = type === 'trash' || type === 'hand' || revealedCardIds.has(card.uuid);
    const displayCard = { ...card, is_face_up: isRevealed };
    
    const cardSprite = createCardContainer(displayCard, BASE_CARD_WIDTH, BASE_CARD_HEIGHT, { 
      onClick: () => {}
    });

    const scale = DISPLAY_CARD_WIDTH / BASE_CARD_WIDTH;
    cardSprite.scale.set(scale);

    // 裏面画像
    if (!isRevealed) {
      const backTexture = PIXI.Texture.from(`${API_CONFIG.IMAGE_BASE_URL}/OPCG_back.png`);
      const backSprite = new PIXI.Sprite(backTexture);
      backSprite.width = BASE_CARD_WIDTH;
      backSprite.height = BASE_CARD_HEIGHT;
      backSprite.anchor.set(0.5);
      cardSprite.addChild(backSprite);
    }

    // デッキ下へボタン
    const btn = new PIXI.Graphics();
    btn.beginFill(0x34495e, 0.9);
    btn.lineStyle(1, 0xecf0f1);
    const btnH = 24;
    const btnW = BASE_CARD_WIDTH;
    const btnY = BASE_CARD_HEIGHT / 2 + 15 + btnH / 2; 
    btn.drawRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 4);
    btn.endFill();
    btn.position.set(0, btnY);

    const btnTxt = new PIXI.Text("デッキ下", { fontSize: 16, fill: 'white', fontWeight: 'bold' });
    btnTxt.anchor.set(0.5);
    btn.addChild(btnTxt);
    
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.visible = isRevealed;
    btn.on('pointerdown', (e) => { e.stopPropagation(); onMoveToBottom(card.uuid); });
    
    cardSprite.addChild(btn);

    cardSprite.eventMode = 'static';
    cardSprite.cursor = 'grab';
    
    // SandboxGame側でタップ判定を行うため、ここではstopPropagationせず、
    // 親への伝播を許可するか、もしくはdrag開始として扱う
    // ここでは onCardDown (ドラッグ開始) のみをバインド
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

  const szText = new PIXI.Text("<<< SWIPE HERE TO SCROLL >>>", { fontSize: 14, fill: 0x888888 });
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
    
    // スクロール範囲の計算
    // 右端：カード総幅 - パネル幅 + 余白
    const maxScroll = Math.max(0, cards.length * TOTAL_CARD_WIDTH - PANEL_W + PADDING * 2);
    
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
    const listStartX = PANEL_X + container.x;

    if (draggingUuid && draggingGlobalX !== null) {
      const relativeX = draggingGlobalX + currentScrollX - listStartX;
      gapIndex = Math.floor((relativeX) / TOTAL_CARD_WIDTH);
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
         const draggingItemIndex = cards.findIndex(c => c.uuid === draggingUuid);
         
         if (draggingItemIndex !== -1) {
            let adjustedIndex = originalIndex;
            if (originalIndex > draggingItemIndex) adjustedIndex -= 1;
            
             if (adjustedIndex >= gapIndex) {
                 visualIndex = adjustedIndex + 1;
             } else {
                 visualIndex = adjustedIndex;
             }
         } else {
             // リスト外からのドラッグの場合
             if (originalIndex >= gapIndex) {
                 visualIndex = originalIndex + 1;
             }
         }
      }

      const targetX = visualIndex * TOTAL_CARD_WIDTH + TOTAL_CARD_WIDTH / 2 - currentScrollX;
      sprite.position.set(targetX, LIST_H / 2);
    });
  };

  container.updateScroll(initialScrollX);

  return container;
};
