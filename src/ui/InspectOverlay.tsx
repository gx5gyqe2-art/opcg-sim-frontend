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
  onToggleReveal: (uuid: string) => void, // 復活
  onRevealAll: () => void,
  onMoveToBottom: (uuid: string) => void,
  onMoveToHand: (uuid: string) => void,
  onMoveToTrash: (uuid: string) => void,
  onScrollCallback: (x: number) => void,
  onLongPress: (card: CardInstance) => void // 追加
): InspectOverlayContainer => {
  const container = new PIXI.Container() as InspectOverlayContainer;

  // 背景
  const bg = new PIXI.Graphics();
  bg.beginFill(0x000000, 0.2); 
  bg.drawRect(0, 0, W, H);
  bg.endFill();
  bg.eventMode = 'static';
  bg.on('pointerdown', onClose);
  container.addChild(bg);

  // --- レイアウト定数 ---
  const PADDING = 20;
  const HEADER_HEIGHT = 40; 
  const SCROLL_ZONE_HEIGHT = 70;
  const PANEL_W = Math.min(W * 0.95, 1200);
  const PANEL_X = (W - PANEL_W) / 2;
  const PANEL_Y = 15;
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

  // --- ヘッダー要素 ---
  const titleStyle = new PIXI.TextStyle({ fontFamily: 'Arial', fontSize: 18, fontWeight: 'bold', fill: '#ffd700' });
  const title = new PIXI.Text(`${type.toUpperCase()} (${cards.length})`, titleStyle);
  title.position.set(PADDING, 10);
  panel.addChild(title);

  const closeBtn = new PIXI.Text("×", { ...titleStyle, fontSize: 28, fill: '#ffffff' });
  closeBtn.eventMode = 'static';
  closeBtn.cursor = 'pointer';
  closeBtn.position.set(PANEL_W - PADDING - 15, 5);
  closeBtn.on('pointerdown', onClose);
  panel.addChild(closeBtn);

  if (type !== 'trash') {
    const revealBtn = new PIXI.Container();
    const rBg = new PIXI.Graphics().beginFill(0x27ae60).drawRoundedRect(0, 0, 100, 26, 4).endFill();
    const rTxt = new PIXI.Text("REVEAL ALL", { fontSize: 12, fill: 'white', fontWeight: 'bold' });
    rTxt.anchor.set(0.5); rTxt.position.set(50, 13);
    revealBtn.addChild(rBg, rTxt);
    revealBtn.position.set(PANEL_W - 160, 8);
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

    if (!isRevealed) {
      const backTexture = PIXI.Texture.from(`${API_CONFIG.IMAGE_BASE_URL}/OPCG_back.png`);
      const backSprite = new PIXI.Sprite(backTexture);
      backSprite.width = BASE_CARD_WIDTH;
      backSprite.height = BASE_CARD_HEIGHT;
      backSprite.anchor.set(0.5);
      cardSprite.addChild(backSprite);
    }

    // ボタン生成 (サイズ拡大)
    const createButton = (label: string, color: number, yPos: number, onClick: () => void) => {
      const btn = new PIXI.Graphics();
      btn.beginFill(color, 0.9);
      btn.lineStyle(1, 0xecf0f1);
      
      const btnH = 30;
      const btnW = BASE_CARD_WIDTH + 10;
      
      btn.drawRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 6);
      btn.endFill();
      btn.position.set(0, yPos);

      const btnTxt = new PIXI.Text(label, { fontSize: 16, fill: 'white', fontWeight: 'bold' });
      btnTxt.anchor.set(0.5);
      btn.addChild(btnTxt);
      
      btn.eventMode = 'static';
      btn.cursor = 'pointer';
      btn.on('pointerdown', (e) => { 
          e.stopPropagation(); 
          onClick(); 
      });
      return btn;
    };

    let btnStartY = BASE_CARD_HEIGHT / 2 + 20;
    const btnGap = 35;

    const handBtn = createButton("手札へ", 0x2980b9, btnStartY + btnGap * 0, () => onMoveToHand(card.uuid));
    const trashBtn = createButton("トラッシュ", 0xc0392b, btnStartY + btnGap * 1, () => onMoveToTrash(card.uuid));
    const botBtn = createButton("デッキ下", 0x34495e, btnStartY + btnGap * 2, () => onMoveToBottom(card.uuid));

    if (isRevealed) {
      cardSprite.addChild(handBtn);
      cardSprite.addChild(trashBtn);
      cardSprite.addChild(botBtn);
    }

    cardSprite.eventMode = 'static';
    cardSprite.cursor = 'grab';
    
    // --- 長押し判定 ---
    let pressTimer: any = null;
    let startPos = { x: 0, y: 0 };

    const startPress = (e: PIXI.FederatedPointerEvent) => {
        startPos = { x: e.global.x, y: e.global.y };
        
        pressTimer = setTimeout(() => {
            onLongPress(card);
            pressTimer = null;
        }, 500);
    };

    const checkMove = (e: PIXI.FederatedPointerEvent) => {
        if (!pressTimer) return;
        const dx = e.global.x - startPos.x;
        const dy = e.global.y - startPos.y;
        if (Math.sqrt(dx * dx + dy * dy) > 5) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
    };

    const cancelPress = () => {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
    };

    cardSprite.on('pointerdown', (e) => {
        e.stopPropagation();
        startPress(e);
        // ドラッグ開始
        onCardDown(card, { x: e.global.x, y: e.global.y });
    });

    // タップ判定 (表裏切り替え)
    cardSprite.on('pointertap', () => {
      if (type !== 'trash') onToggleReveal(card.uuid);
    });

    cardSprite.on('pointermove', checkMove);
    cardSprite.on('pointerup', cancelPress);
    cardSprite.on('pointerupoutside', cancelPress);

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
             if (originalIndex >= gapIndex) {
                 visualIndex = originalIndex + 1;
             }
         }
      }

      const X_OFFSET = TOTAL_CARD_WIDTH / 2 + 20;
      const targetX = visualIndex * TOTAL_CARD_WIDTH + X_OFFSET - currentScrollX;
      sprite.position.set(targetX, LIST_H / 2);
    });
  };

  container.updateScroll(initialScrollX);

  return container;
};
