import * as PIXI from 'pixi.js';
import { createCardContainer } from './CardRenderer';
import type { CardInstance } from '../game/types';
import { LAYOUT_CONSTANTS } from '../layout/layout.config';

// オーバーレイコンテナに更新用メソッドを追加した型定義
export interface InspectOverlayContainer extends PIXI.Container {
  updateLayout: (draggingGlobalX: number | null, draggingUuid: string | null) => void;
  updateScroll: (x: number) => void;
}

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

  // 背景（クリックで閉じる機能は誤操作防止のため削除し、閉じるボタンのみにするか、エリア外判定を厳密にする）
  const bg = new PIXI.Graphics();
  bg.beginFill(0x000000, 0.85);
  bg.drawRect(0, 0, W, H);
  bg.endFill();
  bg.eventMode = 'static';
  bg.on('pointerdown', onClose); // 背景クリックで閉じる
  container.addChild(bg);

  // --- レイアウト定数 ---
  const PADDING = 20;
  const HEADER_HEIGHT = 60;
  const SCROLL_ZONE_HEIGHT = 80; // 下部のスクロール専用エリア
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
  panel.on('pointerdown', (e) => e.stopPropagation()); // パネルクリックで閉じないようにする
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
  // マスク設定
  const mask = new PIXI.Graphics();
  mask.beginFill(0xffffff);
  mask.drawRect(0, CARD_AREA_Y, PANEL_W, LIST_H);
  mask.endFill();
  panel.addChild(mask);
  listContainer.mask = mask;
  listContainer.y = CARD_AREA_Y;
  panel.addChild(listContainer);

  // カードサイズ計算
  const ASPECT = 1.39;
  let cardH = LIST_H - 20; // 上下余白
  let cardW = cardH / ASPECT;
  const MAX_CARD_W = 120; // 最大幅制限
  if (cardW > MAX_CARD_W) {
    cardW = MAX_CARD_W;
    cardH = cardW * ASPECT;
  }
  const CARD_GAP = 15;
  const TOTAL_CARD_WIDTH = cardW + CARD_GAP;

  // スクロール状態管理
  let currentScrollX = initialScrollX;
  const maxScroll = Math.max(0, cards.length * TOTAL_CARD_WIDTH - PANEL_W + PADDING * 2);
  
  // スプライト参照保持用
  const cardSprites: { sprite: PIXI.Container, card: CardInstance, originalIndex: number }[] = [];

  // カード生成
  cards.forEach((card, i) => {
    const isRevealed = type === 'trash' || type === 'hand' || revealedCardIds.has(card.uuid);
    
    // 表示用カードデータ（裏向きでもInspectなら自分がオーナーなら見えるべきだが、
    // ここでは revealedCardIds に依存させる仕様とする。必要に応じて変更可）
    const displayCard = { ...card, is_face_up: isRevealed };
    
    // カード生成 (CardRenderer使用)
    const cardSprite = createCardContainer(displayCard, LAYOUT_CONSTANTS.CARD_WIDTH, LAYOUT_CONSTANTS.CARD_HEIGHT, { 
      onClick: () => {} // ドラッグ優先のため空
    });

    // スケール調整
    const scale = cardW / LAYOUT_CONSTANTS.CARD_WIDTH;
    cardSprite.scale.set(scale);

    // 裏向きの場合のカバー (CardRendererが表前提で作られている場合)
    if (!isRevealed) {
      const cover = new PIXI.Graphics();
      cover.beginFill(0x34495e);
      cover.lineStyle(2, 0xecf0f1);
      cover.drawRoundedRect(0, 0, LAYOUT_CONSTANTS.CARD_WIDTH, LAYOUT_CONSTANTS.CARD_HEIGHT, 8);
      cover.endFill();
      const txt = new PIXI.Text("?", { fontSize: 60, fill: "white", fontWeight: 'bold' });
      txt.anchor.set(0.5);
      txt.position.set(LAYOUT_CONSTANTS.CARD_WIDTH/2, LAYOUT_CONSTANTS.CARD_HEIGHT/2);
      cover.addChild(txt);
      cardSprite.addChild(cover);
    }

    // デッキ下へボタン
    const btn = new PIXI.Graphics();
    btn.beginFill(0x000000, 0.6);
    btn.drawRoundedRect(10, LAYOUT_CONSTANTS.CARD_HEIGHT - 40, LAYOUT_CONSTANTS.CARD_WIDTH - 20, 30, 4);
    btn.endFill();
    const btnTxt = new PIXI.Text("Bot", { fontSize: 18, fill: 'white' });
    btnTxt.anchor.set(0.5);
    btnTxt.position.set(LAYOUT_CONSTANTS.CARD_WIDTH/2, LAYOUT_CONSTANTS.CARD_HEIGHT - 25);
    btn.addChild(btnTxt);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.visible = isRevealed; // 表向きのみ表示
    btn.on('pointerdown', (e) => { e.stopPropagation(); onMoveToBottom(card.uuid); });
    cardSprite.addChild(btn);

    // イベントリスナー
    cardSprite.eventMode = 'static';
    cardSprite.cursor = 'grab';
    
    // タップで公開 (Deck/Lifeのみ)
    cardSprite.on('pointertap', (e) => {
      // ドラッグと判定されなかった場合のみ
      if (type !== 'trash') onToggleReveal(card.uuid);
    });

    cardSprite.on('pointerdown', (e) => {
      // ドラッグ開始を親に通知
      e.stopPropagation();
      // カードの中心位置などを考慮してオフセット計算したいが、簡易的に
      onCardDown(card, { x: e.global.x, y: e.global.y });
    });

    listContainer.addChild(cardSprite);
    cardSprites.push({ sprite: cardSprite, card, originalIndex: i });
  });

  // --- スクロールゾーン (下部) ---
  const scrollZone = new PIXI.Graphics();
  const szY = PANEL_H - SCROLL_ZONE_HEIGHT;
  scrollZone.beginFill(0x222222);
  scrollZone.drawRect(0, 0, PANEL_W, SCROLL_ZONE_HEIGHT);
  scrollZone.endFill();
  scrollZone.position.set(0, szY);
  scrollZone.eventMode = 'static';
  scrollZone.cursor = 'ew-resize'; // 左右矢印カーソル
  panel.addChild(scrollZone);

  const szText = new PIXI.Text("<<< SWIPE HERE TO SCROLL >>>", { fontSize: 16, fill: 0x888888 });
  szText.anchor.set(0.5);
  szText.position.set(PANEL_W / 2, SCROLL_ZONE_HEIGHT / 2);
  scrollZone.addChild(szText);

  // スクロールバー
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

  // スクロール操作ロジック
  let isScrolling = false;
  let lastX = 0;

  scrollZone.on('pointerdown', (e) => {
    isScrolling = true;
    lastX = e.global.x;
  });

  const onDragMove = (e: PIXI.FederatedPointerEvent) => {
    if (!isScrolling) return;
    const dx = lastX - e.global.x; // 左へ動かすとScrollXが増える（右側のコンテンツが見える）
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


  // --- レイアウト更新メソッドの実装 ---

  container.updateScroll = (x: number) => {
    currentScrollX = x;
    // リストコンテナ自体を動かすのではなく、カードの配置計算時に scrollX を引く
    // または listContainer.x を動かす
    // ここでは listContainer.x を動かす方式にする（簡単のため）
    // ただし、updateLayout で個別に位置計算するので、listContainer.x は 0 固定で、
    // sprite.x = index * W - scrollX のほうがスムーズな並び替えができる。
    
    // updateLayoutを呼び出して再計算させる
    container.updateLayout(null, null);
    updateScrollBar();
  };

  container.updateLayout = (draggingGlobalX: number | null, draggingUuid: string | null) => {
    // 1. ドラッグ中のカードが、リスト上のどのインデックスに相当するか計算
    let gapIndex = -1;

    if (draggingUuid && draggingGlobalX !== null) {
      // グローバルX座標をリストコンテナ内のローカルX座標に変換（スクロール考慮）
      // パネルのX座標 + PADDING がリストの左端
      const listStartX = PANEL_X + container.x; // container.xは通常0
      
      // カーソルの位置 + 現在のスクロール量 - リストの開始位置
      const relativeX = draggingGlobalX + currentScrollX - listStartX;
      
      gapIndex = Math.floor((relativeX + TOTAL_CARD_WIDTH / 2) / TOTAL_CARD_WIDTH);
      gapIndex = Math.max(0, Math.min(gapIndex, cards.length));
    }

    // 2. カード配置
    cardSprites.forEach(({ sprite, card, originalIndex }) => {
      // ドラッグ中のカードはOverlay内では非表示（SandboxGame側でGhostを表示しているため）
      if (card.uuid === draggingUuid) {
        sprite.visible = false;
        return;
      }
      sprite.visible = true;

      let visualIndex = originalIndex;

      // ドラッグ中のカード(Ghost)のための隙間を作る
      if (gapIndex !== -1) {
         // ドラッグ中のカードが元々このリストにいた場合、その分詰める必要がある
         // しかし、今回は配列順序自体は変わっていない（dropするまで）
         // 視覚的に「もしここにドロップしたら」を表現する
         
         if (originalIndex >= gapIndex) {
           visualIndex += 1; // 右にずれる
         }
         
         // 自分がドラッグ対象そのものではないので、
         // もしドラッグしているカードが自分より「前」にあった場合、
         // 自分は本来 -1 の位置にいるはず（詰まるはず）。
         // 厳密なシミュレーションは複雑だが、
         // 「ドラッグ中のカードを一時的にリストから抜いて、gapIndexに挿入した状態」を描画するのが正解。
         
         const draggingItemIndex = cards.findIndex(c => c.uuid === draggingUuid);
         
         if (draggingItemIndex !== -1) {
            // リスト内並び替えの場合
            let adjustedIndex = originalIndex;
            if (originalIndex > draggingItemIndex) adjustedIndex -= 1; // 抜けた分詰める
            
            if (adjustedIndex >= gapIndex) {
                // 挿入位置より後ろなら +1
                // ただし、gapIndexも「抜いた状態」でのインデックスとして扱うべき
                // ここでは簡易的に「カーソル位置より後ろのカードは右へ」とする
            }
            
            // 簡易ロジック:
            // カーソルがある位置(gapIndex)より、
            // - 左にあるカードはそのまま (visualIndex = adjustedIndex)
            // - 右にあるカードは +1 (visualIndex = adjustedIndex + 1)
            // これで隙間ができる
             
             if (adjustedIndex >= gapIndex) {
                 // sprite.x = (adjustedIndex + 1) * TOTAL_CARD_WIDTH - currentScrollX;
                 sprite.position.set((adjustedIndex + 1) * TOTAL_CARD_WIDTH - currentScrollX, cardH / 2 + 10);
             } else {
                 // sprite.x = adjustedIndex * TOTAL_CARD_WIDTH - currentScrollX;
                 sprite.position.set(adjustedIndex * TOTAL_CARD_WIDTH - currentScrollX, cardH / 2 + 10);
             }
             return; // 計算終了
         }
      }

      // 通常配置 (外部からのドラッグ or ドラッグなし)
      let targetX = visualIndex * TOTAL_CARD_WIDTH - currentScrollX;
      
      // 外部からのドラッグで隙間を作る場合
      if (gapIndex !== -1 && draggingUuid && !cards.find(c => c.uuid === draggingUuid)) {
          if (originalIndex >= gapIndex) targetX += TOTAL_CARD_WIDTH;
      }

      sprite.position.set(targetX, cardH / 2 + 10);
    });
  };

  // 初期描画
  container.updateScroll(initialScrollX);

  return container;
};
