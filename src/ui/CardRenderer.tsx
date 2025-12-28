import * as PIXI from 'pixi.js';
import { LAYOUT_CONSTANTS } from '../layout/layout.config';
import { logger } from '../utils/logger';

const { COLORS } = LAYOUT_CONSTANTS;

export const createCardContainer = (
  card: any,
  cw: number,
  ch: number,
  // 削除: isOpp はもう必要ないので消去しました
  options: { count?: number; onClick: () => void }
) => {
  logger.log({
    level: 'debug',
    action: 'debug.card_render_process',
    msg: `Card rendering: ${card?.name || 'Unknown'}`,
    payload: { 
      uuid: card?.uuid,
      location: card?.location,
      type: card?.type,
      power: card?.power,
      cost: card?.cost,
      is_face_up: card?.is_face_up,
      raw: card 
    }
  });

  const container = new PIXI.Container();
  const isRest = card?.is_rest === true || card?.location === 'don_rest';
  const textRotation = isRest ? -Math.PI / 2 : 0;
  
  if (isRest) container.rotation = Math.PI / 2;

  // 修正: 場所や陣営のロジックをすべて消去し、カードのステータスのみに従います
  const isBack = card?.is_face_up === false;

  const g = new PIXI.Graphics();
  g.lineStyle(2, COLORS.ZONE_BORDER);
  g.beginFill(isBack ? COLORS.CARD_BACK : COLORS.ZONE_FILL);
  g.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, 6);
  g.endFill();
  container.addChild(g);

  if (!isBack) {
    const cardName = card?.name || "";
    const isResource = ['DON!!', 'Trash', 'Deck', 'Don!!', 'Life', 'Stage'].includes(cardName) || 
                       card?.location?.includes('don');

    if (card?.power !== undefined && !isResource) {
      const pTxt = new PIXI.Text(`POWER ${card.power}`, new PIXI.TextStyle({ 
        fontSize: 11, 
        fill: COLORS.TEXT_POWER, 
        fontWeight: 'bold' 
      }));
      pTxt.anchor.set(0.5);
      pTxt.rotation = textRotation;
      if (isRest) { 
        pTxt.x = -ch / 2 - 10; 
        pTxt.y = 0; 
      } else { 
        pTxt.x = 0; 
        pTxt.y = -ch / 2 - 10; 
      }
      container.addChild(pTxt);
    }

    const nTxt = new PIXI.Text(cardName, new PIXI.TextStyle({ 
      fontSize: isResource ? 11 : 9, 
      fontWeight: 'bold', 
      fill: isResource ? COLORS.TEXT_RESOURCE : COLORS.TEXT_DEFAULT 
    }));
    nTxt.anchor.set(0.5);
    nTxt.rotation = textRotation;
    if (isResource) {
      nTxt.x = 0; 
      nTxt.y = 0; 
    } else {
      if (isRest) { 
        nTxt.x = ch / 2 + 2; 
        nTxt.y = 0; 
      } else { 
        nTxt.x = 0; 
        nTxt.y = ch / 2 + 2; 
      }
    }
    container.addChild(nTxt);
  } else {
    const backTxt = new PIXI.Text("ONE\nPIECE", new PIXI.TextStyle({ 
      fontSize: 8, 
      fontWeight: 'bold', 
      fill: 0xFFFFFF, 
      align: 'center' 
    }));
    backTxt.anchor.set(0.5);
    backTxt.rotation = textRotation;
    container.addChild(backTxt);
  }

  if (options.count && options.count > 0) {
    const badge = new PIXI.Graphics()
      .beginFill(COLORS.BADGE_BG, 0.8)
      .drawCircle(cw / 2 - 10, ch / 2 - 10, 12)
      .endFill();
    const cTxt = new PIXI.Text(options.count.toString(), new PIXI.TextStyle({ 
      fontSize: 12, 
      fill: COLORS.BADGE_TEXT, 
      fontWeight: 'bold' 
    }));
    cTxt.anchor.set(0.5); 
    cTxt.position.set(cw / 2 - 10, ch / 2 - 10);
    cTxt.rotation = textRotation;
    container.addChild(badge, cTxt);
  }

  container.eventMode = 'static';
  container.cursor = 'pointer';
  container.on('pointerdown', (e) => { 
    e.stopPropagation(); 
    options.onClick(); 
  });

  return container;
};
