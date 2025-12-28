// src/ui/CardRenderer.tsx
import * as PIXI from 'pixi.js';
import { LAYOUT_CONSTANTS } from '../layout/layout.config';

const { COLORS } = LAYOUT_CONSTANTS;

export const createCardContainer = (
  card: any,
  cw: number,
  ch: number,
  isOpp: boolean,
  options: { isWide?: boolean; count?: number; onClick: () => void }
) => {
  const container = new PIXI.Container();
  const isRest = card?.is_rest === true || card?.location === 'don_rest';
  const textRotation = isRest ? -Math.PI / 2 : 0;
  
  if (isRest) container.rotation = Math.PI / 2;

  const isBack = card?.is_face_up === false && 
                 card?.location !== 'leader' && 
                 !(!isOpp && card?.location === 'hand');

  // 背景描画
  const g = new PIXI.Graphics();
  g.lineStyle(2, COLORS.ZONE_BORDER);
  g.beginFill(isBack ? COLORS.CARD_BACK : COLORS.ZONE_FILL);
  g.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, 6);
  g.endFill();
  container.addChild(g);

  if (!isBack) {
    const cardName = card?.name || "";
    const isResource = ['DON!!', 'Trash', 'Deck', 'Don!!', 'Life', 'Stage'].includes(cardName);

    // パワー表示
    if (card?.power !== undefined) {
      const pTxt = new PIXI.Text(`POWER ${card.power}`, { fontSize: 11, fill: COLORS.TEXT_POWER, fontWeight: 'bold' });
      pTxt.anchor.set(0.5);
      pTxt.rotation = textRotation;
      if (isRest) { pTxt.x = -ch / 2 - 10; pTxt.y = 0; }
      else { pTxt.x = 0; pTxt.y = -ch / 2 - 10; }
      container.addChild(pTxt);
    }

    // 名前表示 (ドン!!等は中央)
    const nameStyle = { fontSize: isResource ? 11 : 9, fontWeight: 'bold', fill: isResource ? COLORS.TEXT_RESOURCE : COLORS.TEXT_DEFAULT };
    const nTxt = new PIXI.Text(cardName, nameStyle);
    nTxt.anchor.set(0.5);
    nTxt.rotation = textRotation;
    if (isResource) { nTxt.x = 0; nTxt.y = 0; }
    else if (isRest) { nTxt.x = ch / 2 + 2; nTxt.y = 0; }
    else { nTxt.x = 0; nTxt.y = ch / 2 + 2; }
    container.addChild(nTxt);
  }

  // 枚数バッジ
  if (options.count && options.count > 0) {
    const badge = new PIXI.Graphics().beginFill(COLORS.BADGE_BG, 0.8).drawCircle(cw / 2 - 10, ch / 2 - 10, 12).endFill();
    const cTxt = new PIXI.Text(options.count.toString(), { fontSize: 12, fill: COLORS.BADGE_TEXT, fontWeight: 'bold' });
    cTxt.anchor.set(0.5); cTxt.position.set(cw / 2 - 10, ch / 2 - 10);
    cTxt.rotation = textRotation;
    container.addChild(badge, cTxt);
  }

  container.eventMode = 'static';
  container.cursor = 'pointer';
  container.on('pointerdown', (e) => { e.stopPropagation(); options.onClick(); });

  return container;
};
