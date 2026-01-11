import * as PIXI from 'pixi.js';
import { createCardContainer } from './CardRenderer';
import type { CardInstance } from '../game/types';

export const createInspectOverlay = (
  type: string,
  cards: CardInstance[],
  W: number,
  H: number,
  onClose: () => void,
  onCardDown: (card: CardInstance, startPos: { x: number, y: number }) => void
) => {
  const container = new PIXI.Container();

  // 1. 背景
  const bg = new PIXI.Graphics();
  bg.beginFill(0x000000, 0.7);
  bg.drawRect(0, 0, W, H);
  bg.endFill();
  bg.eventMode = 'static';
  bg.on('pointerdown', onClose);
  container.addChild(bg);

  // 2. パネル本体
  const panelW = W * 0.9;
  const panelH = Math.min(H * 0.4, 300); 
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

  // 3. ヘッダーテキスト
  const titleStyle = new PIXI.TextStyle({
    fontFamily: 'Arial',
    fontSize: 18,
    fontWeight: 'bold',
    fill: '#ffffff',
  });
  const title = new PIXI.Text(`${type.toUpperCase()} (${cards.length})`, titleStyle);
  title.position.set(15, 10);
  panel.addChild(title);

  // 4. 閉じるボタン
  const closeBtn = new PIXI.Text('×', { ...titleStyle, fontSize: 24, fill: '#aaaaaa' });
  closeBtn.position.set(panelW - 30, 5);
  closeBtn.eventMode = 'static';
  closeBtn.cursor = 'pointer';
  closeBtn.on('pointerdown', onClose);
  panel.addChild(closeBtn);

  // 5. カードリスト
  const listContainer = new PIXI.Container();
  listContainer.position.set(15, 50);
  
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

  // --- 操作判定用変数 ---
  let isScrolling = false;
  let startPos = { x: 0, y: 0 };
  let scrollStartX = 0;
  
  // 判定待ちのカード情報
  // flipAction: タップと判定された時に実行する「裏返し」関数
  let pendingCard: { 
      card: CardInstance, 
      e: PIXI.FederatedPointerEvent,
      flipAction: () => void 
  } | null = null;

  const maxScroll = Math.max(0, cards.length * (cardW + gap) - (panelW - 30));

  // カード生成ループ
  cards.forEach((card, i) => {
    const baseW = 100; 
    const baseH = 140;
    
    const x = i * (cardW + gap) + cardW / 2;
    const y = cardH / 2;

    // スプライト生成・入替用関数
    const createSprite = (isFaceUp: boolean): PIXI.Container => {
        const displayCard = { ...card, is_face_up: isFaceUp };
        const sprite = createCardContainer(displayCard, baseW, baseH, { onClick: () => {} });
        
        const scale = cardH / baseH;
        sprite.scale.set(scale);
        sprite.position.set(x, y);
        sprite.eventMode = 'static';
        sprite.cursor = 'grab';

        sprite.on('pointerdown', (e) => {
            e.stopPropagation();

            // 裏向きの場合 -> 即座に表向きにする (ドラッグ開始はしない)
            if (!isFaceUp) {
                const newSprite = createSprite(true);
                const index = listContainer.getChildIndex(sprite);
                listContainer.removeChild(sprite);
                listContainer.addChildAt(newSprite, index);
                sprite.destroy({ children: true });
                return;
            }

            // 表向きの場合 -> ドラッグ判定待ち (pending)
            // タップ（移動なしで指を離す）なら裏向きに戻すアクションを登録
            const flipBack = () => {
                const newSprite = createSprite(false);
                const index = listContainer.getChildIndex(sprite);
                listContainer.removeChild(sprite);
                listContainer.addChildAt(newSprite, index);
                sprite.destroy({ children: true });
            };

            pendingCard = { 
                card, 
                e: e,
                flipAction: flipBack 
            };
            startPos = { x: e.global.x, y: e.global.y };
            scrollStartX = listContainer.x;
            isScrolling = false;
        });

        return sprite;
    };

    // 初期状態は裏向き (false)
    const initialSprite = createSprite(false);
    listContainer.addChild(initialSprite);
  });

  // --- パネル全体のイベント ---

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

    // 一定距離動いたら「ドラッグ」または「スクロール」と確定
    if (dist > 10) {
        if (pendingCard) {
            if (Math.abs(dy) > Math.abs(dx)) {
                // 縦移動 -> カード取り出し (外部へ通知)
                onCardDown(pendingCard.card, { x: e.global.x, y: e.global.y });
                pendingCard = null; // ドラッグ開始したのでフリップアクションは破棄
                isScrolling = false;
                return;
            } else {
                // 横移動 -> スクロール開始
                isScrolling = true;
                pendingCard = null; // スクロールなのでフリップアクションは破棄
            }
        }
    }

    if (isScrolling) {
        let newX = scrollStartX + dx;
        if (newX > 0) newX = 0;
        if (newX < -maxScroll) newX = -maxScroll;
        listContainer.x = newX;
    }
  });

  const endDrag = () => {
      // 指を離した時、まだ pendingCard が残っている = 移動していない
      // つまり「表向きカードのタップ」なので、裏向きに戻す
      if (pendingCard) {
          pendingCard.flipAction();
      }

      isScrolling = false;
      pendingCard = null;
  };

  panel.on('pointerup', endDrag);
  panel.on('pointerupoutside', endDrag);

  return container;
};
