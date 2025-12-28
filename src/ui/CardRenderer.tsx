import * as PIXI from 'pixi.js';
import { LAYOUT_CONSTANTS } from '../layout/layout.config';
import { logger } from '../utils/logger';

const { COLORS } = LAYOUT_CONSTANTS;

export const createCardContainer = (
  card: any,
  cw: number,
  ch: number,
  options: { count?: number; onClick: () => void }
) => {
  const container = new PIXI.Container();
  
  const isOpponent = card?.owner === 'p2' || card?.location?.includes('opp');
  const isRest = card?.is_rest === true || card?.location === 'don_rest';

  const textRotation = isOpponent ? Math.PI : 0;
  
  if (isRest) container.rotation = Math.PI / 2;

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
        const angle = -Math.PI / 2 + textRotation;
        pTxt.rotation = angle;
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
        const angle = -Math.PI / 2 + textRotation;
        nTxt.rotation = angle;
        nTxt.x = ch / 2 + 2; 
        nTxt.y = 0;
      } else {
        nTxt.x = 0; 
        nTxt.y = ch / 2 + 2;
      }
    }
    container.addChild(nTxt);

    if (card?.attached_don && card.attached_don > 0) {
      const donBadge = new PIXI.Graphics()
        .beginFill(0x9370DB, 0.9)
        .drawCircle(cw / 2 - 8, -ch / 2 + 8, 10)
        .endFill();
      const dTxt = new PIXI.Text(`+${card.attached_don}`, new PIXI.TextStyle({ 
        fontSize: 10, 
        fill: 0xFFFFFF, 
        fontWeight: 'bold' 
      }));
      dTxt.anchor.set(0.5);
      dTxt.position.set(cw / 2 - 8, -ch / 2 + 8);
      dTxt.rotation = textRotation;
      container.addChild(donBadge, dTxt);
    }
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
