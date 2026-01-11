import * as PIXI from 'pixi.js';
import { createCardContainer } from './CardRenderer';
import { LAYOUT_CONSTANTS } from '../layout/layout.config';
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
  const { COLORS } = LAYOUT_CONSTANTS;

  // 1. 背景（半透明の黒）- 全画面クリックで閉じる
  const bg = new PIXI.Graphics();
  bg.beginFill(0x000000, 0.7);
  bg.drawRect(0, 0, W, H);
  bg.endFill();
  bg.eventMode = 'static';
  bg.on('pointerdown', onClose);
  container.addChild(bg);

  // 2. パネル本体
  const panelW = W * 0.9;
  const panelH = Math.min(H * 0.4, 300); // 画面の40% または Max 300px
  const panelX = (W - panelW) / 2;
  const panelY = 60; // 上部の余白

  const panel = new PIXI.Graphics();
  panel.beginFill(0x222222, 0.95);
  panel.lineStyle(2, 0x555555);
  panel.drawRoundedRect(0, 0, panelW, panelH, 8);
  panel.endFill();
  panel.position.set(panelX, panelY);
  // パネル自体のクリックは背景に伝播させない
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

  // 4. 閉じるボタン (×)
  const closeBtn = new PIXI.Text('×', { ...titleStyle, fontSize: 24, fill: '#aaaaaa' });
  closeBtn.position.set(panelW - 30, 5);
  closeBtn.eventMode = 'static';
  closeBtn.cursor = 'pointer';
  closeBtn.on('pointerdown', onClose);
  panel.addChild(closeBtn);

  // 5. カードリスト（横スクロールコンテナ）
  const listContainer = new PIXI.Container();
  listContainer.position.set(15, 50);
  
  // マスク（はみ出し部分を隠す）
  const mask = new PIXI.Graphics();
  mask.beginFill(0xffffff);
  mask.drawRect(0, 0, panelW - 30, panelH - 60);
  mask.endFill();
  listContainer.mask = mask;
  panel.addChild(mask);
  panel.addChild(listContainer);

  // カード配置
  const cardW = 60; // 少し小さめに
  const cardH = 84;
  const gap = 10;

  cards.forEach((card, i) => {
    // createCardContainerは通常サイズ(CW, CH)で作られるためスケール調整が必要
    // ここでは簡易的にカードコンテナを作成してスケールダウン
    // ※createCardContainerは裏面やドンなどの画像URL解決ロジックを持っているので再利用
    // ただしサイズ指定が効くように内部実装に依存するが、
    // ここでは標準サイズで作って scale で調整するアプローチをとる
    
    // 標準サイズ (layout.config参照、ここでは仮に 100x140 程度と想定し、比率で合わせる)
    const baseW = 100; 
    const baseH = 140;
    
    // 既存の createCardContainer を流用
    // onClick は空関数、isOpponent は false
    const cardSprite = createCardContainer(card, baseW, baseH, { onClick: () => {} });
    
    // スケール調整
    const scale = cardH / baseH;
    cardSprite.scale.set(scale);
    
    // 位置設定 (アンカーが0.5, 0.5 なので中心座標を指定)
    // リスト内座標
    const x = i * (cardW + gap) + cardW / 2;
    const y = cardH / 2;
    
    cardSprite.position.set(x, y);

    // インタラクション設定
    cardSprite.eventMode = 'static';
    cardSprite.cursor = 'grab';
    
    // ドラッグ開始イベント
    // 親のスクロールと競合しないように、縦ドラッグ(フィールドへ)を優先検知するロジックが必要だが、
    // 今回は「掴んだら即座にゴーストを作ってフィールド操作へ移行」する形にする
    cardSprite.on('pointerdown', (e) => {
      // 座標変換: パネル内のローカル座標 -> グローバル座標
      // const globalPos = cardSprite.getGlobalPosition(); // これでも良いが、イベントの global が正確
      onCardDown(e, card, cardSprite);
    });

    listContainer.addChild(cardSprite);
  });

  // 簡易スクロール機能 (横スクロール)
  // 背景部分をドラッグでスクロール
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
    
    // 範囲制限 (15pxは初期オフセット)
    if (newX > 15) newX = 15;
    if (newX < 15 - maxScroll) newX = 15 - maxScroll;
    
    listContainer.x = newX;
  });

  panel.on('pointerup', () => { isScrolling = false; });
  panel.on('pointerupoutside', () => { isScrolling = false; });

  return container;
};
