import * as PIXI from 'pixi.js';
import { createCardContainer } from './CardRenderer';
import type { CardInstance } from '../game/types';

export const createInspectOverlay = (
  type: string,
  cards: CardInstance[],
  W: number,
  H: number,
  onClose: () => void,
  onCardDown: (e: PIXI.FederatedPointerEvent, card: CardInstance, sprite: PIXI.Container) => void
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

  // 5. カードリスト（横スクロールコンテナ）
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

  cards.forEach((card, i) => {
    const baseW = 100; 
    const baseH = 140;
    
    // ★修正: 確認用なので強制的に表向きにする
    // 元のcardオブジェクトを変更せず、表示用の一時オブジェクトを作成
    const displayCard = { ...card, is_face_up: true };
    
    // createCardContainerには表向きのデータ(displayCard)を渡す
    const cardSprite = createCardContainer(displayCard, baseW, baseH, { onClick: () => {} });
    
    const scale = cardH / baseH;
    cardSprite.scale.set(scale);
    
    const x = i * (cardW + gap) + cardW / 2;
    const y = cardH / 2;
    
    cardSprite.position.set(x, y);

    cardSprite.eventMode = 'static';
    cardSprite.cursor = 'grab';
    
    cardSprite.on('pointerdown', (e) => {
      // ドラッグ開始時は元のデータ(card)を渡す（移動処理などで正しく扱うため）
      // ただしゴースト表示時も表向きにしたい場合は、onCardDown側で対処するか、
      // ここで displayCard を渡しても良いが、uuid等は同じなので問題ないはず
      onCardDown(e, card, cardSprite);
    });

    listContainer.addChild(cardSprite);
  });

  // 簡易スクロール機能 (横スクロール)
  let isScrolling = false;
  let startX = 0;
  let scrollStartX = 0;
  const maxScroll = Math.max(0, cards.length * (cardW + gap) - (panelW - 30));

  panel.on('pointerdown', (e) => {
    isScrolling = true;
    startX = e.global.x;
    scrollStartX = listContainer.x;
  });
  
  panel.on('globalpointermove', (e) => {
    if (!isScrolling) return;
    const dx = e.global.x - startX;
    let newX = scrollStartX + dx;
    
    if (newX > 15) newX = 15;
    if (newX < 15 - maxScroll) newX = 15 - maxScroll;
    
    listContainer.x = newX;
  });

  panel.on('pointerup', () => { isScrolling = false; });
  panel.on('pointerupoutside', () => { isScrolling = false; });

  return container;
};
