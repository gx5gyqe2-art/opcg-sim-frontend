import * as PIXI from 'pixi.js';
import { createCardContainer } from './CardRenderer';
import type { CardInstance } from '../game/types';
import { LAYOUT_PARAMS } from '../layout/layout.config';
import { getBackImageUrl } from '../utils/imageAssets';

export interface InspectOverlayContainer extends PIXI.Container {
  updateLayout: (draggingGlobalX: number | null, draggingUuid: string | null) => void;
  updateScroll: (x: number) => void;
}

const BASE_CARD_WIDTH = 120;
const BASE_CARD_HEIGHT = BASE_CARD_WIDTH * LAYOUT_PARAMS.CARD.ASPECT_RATIO;

const DISPLAY_CARD_WIDTH = 55; 
const CARD_GAP = 10;
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
  // ▼ 復活: タップ時のコールバック
  onToggleReveal: (uuid: string) => void,
  onRevealAll: () => void,
  onMoveToBottom: (uuid: string) => void,
  onMoveToHand: (uuid: string) => void,
  onMoveToTrash: (uuid: string) => void,
  onScrollCallback: (x: number) => void,
  onShuffle?: () => void,
  onRevealTop?: (count: number) => void 
): InspectOverlayContainer => {
  const container = new PIXI.Container() as InspectOverlayContainer;

  // 背景
  const bg = new PIXI.Graphics();
  bg.beginFill(0x000000, 0.1); 
  bg.drawRect(0, 0, W, H);
  bg.endFill();
  bg.eventMode = 'static';
  bg.on('pointerdown', onClose);
  container.addChild(bg);

  // --- レイアウト定数 ---
  const PADDING = 20;
  const HEADER_HEIGHT = 130; 
  const SCROLL_ZONE_HEIGHT = 50; 
  
  // ボタン配置用の定数
  const BTN_GAP = 38;
  const BTNS_START_Y = BASE_CARD_HEIGHT / 2 + 20;
  
  // 必要高さの計算
  const REQUIRED_LIST_H = 310;
  const PANEL_Y = 40; 
  const PLAYER_AREA_RESERVE = Math.max(250, H * 0.4); 
  const MAX_PANEL_H = H - PANEL_Y - PLAYER_AREA_RESERVE;

  const CALCULATED_REQUIRED_H = HEADER_HEIGHT + SCROLL_ZONE_HEIGHT + REQUIRED_LIST_H;
  const PANEL_H = Math.max(450, Math.min(MAX_PANEL_H, CALCULATED_REQUIRED_H));
  
  const PANEL_W = Math.min(W * 0.95, 1200);
  const PANEL_X = (W - PANEL_W) / 2;

  const CARD_AREA_Y = HEADER_HEIGHT;
  const LIST_H = PANEL_H - HEADER_HEIGHT - SCROLL_ZONE_HEIGHT;
  
  // パネル背景
  const panel = new PIXI.Graphics();
  panel.beginFill(0x1a1a1a, 0.9);
  panel.lineStyle(2, 0x444444);
  panel.drawRoundedRect(0, 0, PANEL_W, PANEL_H, 12);
  panel.endFill();
  panel.position.set(PANEL_X, PANEL_Y);
  panel.eventMode = 'static';
  panel.on('pointerdown', (e) => e.stopPropagation());
  container.addChild(panel);

  // --- 1行目: タイトル ---
  const titleStyle = new PIXI.TextStyle({ fontFamily: 'Arial', fontSize: 18, fontWeight: 'bold', fill: '#ffd700' });
  const title = new PIXI.Text(`${type.toUpperCase()} (${cards.length})`, titleStyle);
  title.position.set(PADDING, 15);
  panel.addChild(title);

  const closeBtn = new PIXI.Text("×", { ...titleStyle, fontSize: 28, fill: '#ffffff' });
  closeBtn.eventMode = 'static';
  closeBtn.cursor = 'pointer';
  closeBtn.position.set(PANEL_W - PADDING - 15, 10);
  closeBtn.on('pointerdown', onClose);
  panel.addChild(closeBtn);

  if (type !== 'trash') {
    // --- 2行目: 基本アクション ---
    const ROW2_Y = 50;
    let btnX = PADDING; 

    // REVEAL ALL
    const revealBtn = new PIXI.Container();
    const rBg = new PIXI.Graphics().beginFill(0x27ae60).drawRoundedRect(0, 0, 100, 30, 4).endFill();
    const rTxt = new PIXI.Text("REVEAL ALL", { fontSize: 12, fill: 'white', fontWeight: 'bold' });
    rTxt.anchor.set(0.5); rTxt.position.set(50, 15);
    revealBtn.addChild(rBg, rTxt);
    revealBtn.position.set(btnX, ROW2_Y);
    revealBtn.eventMode = 'static';
    revealBtn.cursor = 'pointer';
    revealBtn.on('pointerdown', onRevealAll);
    panel.addChild(revealBtn);
    btnX += 110;

    // SHUFFLE
    if (type === 'deck' && onShuffle) {
        const shufBtn = new PIXI.Container();
        const sBg = new PIXI.Graphics().beginFill(0xe67e22).drawRoundedRect(0, 0, 100, 30, 4).endFill();
        const sTxt = new PIXI.Text("SHUFFLE", { fontSize: 12, fill: 'white', fontWeight: 'bold' });
        sTxt.anchor.set(0.5); sTxt.position.set(50, 15);
        shufBtn.addChild(sBg, sTxt);
        shufBtn.position.set(btnX, ROW2_Y);
        shufBtn.eventMode = 'static';
        shufBtn.cursor = 'pointer';
        shufBtn.on('pointerdown', onShuffle);
        panel.addChild(shufBtn);
        btnX += 110;
    }

    // --- 3行目: 枚数指定オープン ---
    if (type === 'deck' && onRevealTop) {
      const ROW3_Y = 90;
      let startX = PADDING;

      const label = new PIXI.Text("上から公開:", { fontSize: 14, fill: '#aaaaaa' });
      label.position.set(startX, ROW3_Y + 5);
      panel.addChild(label);
      startX += 90;

      [3, 4, 5].forEach(count => {
        const btn = new PIXI.Container();
        const bg = new PIXI.Graphics().beginFill(0x3498db).drawRoundedRect(0, 0, 50, 26, 4).endFill();
        const txt = new PIXI.Text(`${count}枚`, { fontSize: 12, fill: 'white', fontWeight: 'bold' });
        txt.anchor.set(0.5); txt.position.set(25, 13);
        btn.addChild(bg, txt);
        btn.position.set(startX, ROW3_Y);
        btn.eventMode = 'static';
        btn.cursor = 'pointer';
        btn.on('pointerdown', () => onRevealTop(count));
        panel.addChild(btn);
        
        startX += 60;
      });
    }
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

  cards.forEach((card, i) => {
    const isRevealed = type === 'trash' || type === 'hand' || revealedCardIds.has(card.uuid);
    const displayCard = { ...card, is_face_up: isRevealed };
    
    const cardSprite = createCardContainer(displayCard, BASE_CARD_WIDTH, BASE_CARD_HEIGHT, { 
      onClick: () => {}
    });

    const scale = DISPLAY_CARD_WIDTH / BASE_CARD_WIDTH;
    cardSprite.scale.set(scale);

    if (!isRevealed) {
      const backTexture = PIXI.Texture.from(getBackImageUrl('MAIN'));
      const backSprite = new PIXI.Sprite(backTexture);
      backSprite.width = BASE_CARD_WIDTH;
      backSprite.height = BASE_CARD_HEIGHT;
      backSprite.anchor.set(0.5);
      cardSprite.addChild(backSprite);
    }

    const createButton = (label: string, color: number, yPos: number, onClick: () => void) => {
      const btn = new PIXI.Graphics();
      btn.beginFill(color, 0.9);
      btn.lineStyle(1, 0xecf0f1);
      const btnH = 35;
      const btnW = BASE_CARD_WIDTH + 20;
      btn.drawRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 6);
      btn.endFill();
      btn.position.set(0, yPos);

      const btnTxt = new PIXI.Text(label, { fontSize: 20, fill: 'white', fontWeight: 'bold' });
      btnTxt.anchor.set(0.5);
      btn.addChild(btnTxt);
      btn.eventMode = 'static';
      btn.cursor = 'pointer';
      btn.on('pointerdown', (e) => { e.stopPropagation(); onClick(); });
      return btn;
    };

    if (isRevealed) {
      cardSprite.addChild(createButton("手札へ", 0x2980b9, BTNS_START_Y + BTN_GAP * 0, () => onMoveToHand(card.uuid)));
      cardSprite.addChild(createButton("トラッシュ", 0xc0392b, BTNS_START_Y + BTN_GAP * 1, () => onMoveToTrash(card.uuid)));
      
      const bottomLabel = type === 'life' ? "ライフ下" : "デッキ下";
      cardSprite.addChild(createButton(bottomLabel, 0x34495e, BTNS_START_Y + BTN_GAP * 2, () => onMoveToBottom(card.uuid)));
    }

    cardSprite.eventMode = 'static';
    cardSprite.cursor = 'grab';
    cardSprite.on('pointerdown', (e) => {
      e.stopPropagation();
      onCardDown(card, { x: e.global.x, y: e.global.y });
    });

    // ▼ 復活: ここでタップイベントを受け取る
    cardSprite.on('pointertap', () => {
      if (type !== 'trash') onToggleReveal(card.uuid);
    });

    listContainer.addChild(cardSprite);
    cardSprites.push({ sprite: cardSprite, card, originalIndex: i });
  });

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
  scrollZone.on('pointerdown', (e) => { isScrolling = true; lastX = e.global.x; });
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
  scrollZone.on('globalpointermove', onDragMove);
  scrollZone.on('pointerup', () => { isScrolling = false; });
  scrollZone.on('pointerupoutside', () => { isScrolling = false; });

  container.updateScroll = (x: number) => { currentScrollX = x; container.updateLayout(null, null); updateScrollBar(); };
  
  container.updateLayout = (draggingGlobalX: number | null, draggingUuid: string | null) => {
    let gapIndex = -1;
    const listStartX = PANEL_X + container.x;
    if (draggingUuid && draggingGlobalX !== null) {
      const relativeX = draggingGlobalX + currentScrollX - listStartX;
      gapIndex = Math.floor(relativeX / TOTAL_CARD_WIDTH);
      gapIndex = Math.max(0, Math.min(gapIndex, cards.length));
    }
    cardSprites.forEach(({ sprite, card, originalIndex }) => {
      if (card.uuid === draggingUuid) { sprite.visible = false; return; }
      sprite.visible = true;
      let visualIndex = originalIndex;
      if (gapIndex !== -1) {
         const draggingItemIndex = cards.findIndex(c => c.uuid === draggingUuid);
         if (draggingItemIndex !== -1) {
            let adjustedIndex = originalIndex;
            if (originalIndex > draggingItemIndex) adjustedIndex -= 1;
            if (adjustedIndex >= gapIndex) visualIndex = adjustedIndex + 1;
            else visualIndex = adjustedIndex;
         } else if (originalIndex >= gapIndex) visualIndex = originalIndex + 1;
      }
      const X_OFFSET = TOTAL_CARD_WIDTH / 2 + 20;
      const targetX = visualIndex * TOTAL_CARD_WIDTH + X_OFFSET - currentScrollX;
      
      const targetY = BASE_CARD_HEIGHT / 2 + 10;
      sprite.position.set(targetX, targetY);
    });
  };
  container.updateScroll(initialScrollX);
  return container;
};
