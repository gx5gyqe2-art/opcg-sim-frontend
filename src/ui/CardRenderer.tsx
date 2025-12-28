// src/ui/CardRenderer.tsx

import * as PIXI from 'pixi.js';
import { LAYOUT_CONSTANTS } from '../layout/layout.config';

const { COLORS } = LAYOUT_CONSTANTS;

export const createCardContainer = (
  card: any,
  cw: number,
  ch: number,
  options: { count?: number; onClick: () => void }
) => {
  const container = new PIXI.Container();
  
  const loc = (card?.location || "").toLowerCase();
  const isOpponent = 
    card?.isOpponentFlag === true || 
    card?.owner_id === 'p2' || 
    card?.owner === 'p2' || 
    loc.includes('opp') || 
    loc.includes('p2');

  // 相手のカードなら180度回転(Math.PI)させて文字を自分に向ける
  const textRotation = isOpponent ? Math.PI : 0;
  const isRest = card?.is_rest === true || card?.location === 'don_rest';
  
  if (isRest) container.rotation = Math.PI / 2;

  const isBack = card?.is_face_up === false;

  const g = new PIXI.Graphics();
  g.lineStyle(2, COLORS.ZONE_BORDER);
  g.beginFill(isBack ? COLORS.CARD_BACK : COLORS.ZONE_FILL);
  g.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, 6);
  g.endFill();
  container.addChild(g);

  // 全てのテキスト描画で rotation を適用するための共通関数
  const addText = (val: string | number, style: any, x: number, y: number) => {
    const t = new PIXI.Text(String(val), style);
    t.anchor.set(0.5);
    t.position.set(x, y);
    // 親コンテナの回転を打ち消す
    t.rotation = textRotation; 
    container.addChild(t);
    return t;
  };

  if (!isBack) {
    if (card?.type === 'LEADER') {
      // TEXT_MAIN ではなく 0xFFFFFF (白) を直接指定してビルドエラーを回避
      addText(card.name, { fontSize: 12, fontWeight: 'bold', fill: 0xFFFFFF }, 0, 0);
    } else {
      // コスト表示
      if (card?.cost !== undefined) {
        addText(card.cost, { fontSize: 14, fontWeight: 'bold', fill: 0xFFD700 }, -cw / 2 + 12, -ch / 2 + 12);
      }
      // パワー表示
      if (card?.power !== undefined) {
        addText(card.power, { fontSize: 12, fontWeight: 'bold', fill: 0xFFFFFF }, cw / 2 - 15, ch / 2 - 12);
      }
      // カード名 (相手の時は表示位置も調整)
      const nameStyle = { fontSize: 10, fill: 0xFFFFFF, wordWrap: true, wordWrapWidth: cw - 10, align: 'center' };
      const posY = isOpponent ? (ch / 2 - 18) : (-ch / 2 + 18);
      addText(card.name || "CARD", nameStyle, 0, posY);
    }

    // ドン!!付与バッジ
    if (card?.attached_don > 0) {
      const bx = isOpponent ? (-cw / 2 + 8) : (cw / 2 - 8);
      const by = isOpponent ? (ch / 2 - 8) : (-ch / 2 + 8);
      const donBadge = new PIXI.Graphics().beginFill(0x9370DB, 0.9).drawCircle(bx, by, 10).endFill();
      container.addChild(donBadge);
      addText(`+${card.attached_don}`, { fontSize: 10, fill: 0xFFFFFF, fontWeight: 'bold' }, bx, by);
    }
  } else {
    // 裏面
    addText("ONE\nPIECE", { fontSize: 8, fontWeight: 'bold', fill: 0xFFFFFF, align: 'center' }, 0, 0);
  }

  // 枚数バッジ (デッキやトラッシュ用)
  if (options.count && options.count > 0) {
    const bx = isOpponent ? (-cw / 2 + 10) : (cw / 2 - 10);
    const by = isOpponent ? (-ch / 2 + 10) : (ch / 2 - 10);
    const badge = new PIXI.Graphics().beginFill(0x000000, 0.8).drawCircle(bx, by, 9).endFill();
    container.addChild(badge);
    addText(options.count, { fontSize: 10, fill: 0xFFFFFF }, bx, by);
  }

  container.interactive = true;
  container.cursor = 'pointer';
  container.on('pointertap', (e) => {
    e.stopPropagation();
    options.onClick();
  });

  return container;
};
