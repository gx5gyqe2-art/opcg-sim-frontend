import * as PIXI from 'pixi.js';
import { LAYOUT_CONSTANTS } from '../layout/layout.config';
import { logger } from '../utils/logger';

const { COLORS } = LAYOUT_CONSTANTS;

export const createCardContainer = (
  card: any,
  cw: number,
  ch: number,
  options: { count?: number; onClick: () => void; isOpponent?: boolean }
) => {
  const container = new PIXI.Container();
  
  const loc = (card?.location || "").toLowerCase();
  const isOpponent = options.isOpponent ?? (
    card?.isOpponentFlag === true || 
    card?.owner_id === 'p2' || 
    loc.includes('opp') || 
    loc.includes('p2')
  );

  const textRotation = isOpponent ? Math.PI : 0;
  const isRest = card?.is_rest === true || loc.includes('rest');
  
  if (isRest) container.rotation = Math.PI / 2;

  const isBack = card?.is_face_up === false;

  const g = new PIXI.Graphics();
  g.lineStyle(2, COLORS.ZONE_BORDER);
  g.beginFill(isBack ? COLORS.CARD_BACK : COLORS.ZONE_FILL);
  g.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, 6);
  g.endFill();
  container.addChild(g);

  const addText = (content: string, style: any, x: number, y: number) => {
    const txt = new PIXI.Text(content, style);
    txt.anchor.set(0.5);
    txt.position.set(x, y);
    txt.rotation = isRest ? (-Math.PI / 2 + textRotation) : textRotation;
    container.addChild(txt);
  };

  if (!isBack) {
    const cardName = card?.name || "";
    const isResource = ['DON!!', 'Trash', 'Deck', 'Don!!', 'Life', 'Stage'].includes(cardName) || 
                       loc.includes('don');

    if (card?.power !== undefined && !isResource) {
      const posY = isOpponent ? (ch / 2 + 10) : (-ch / 2 - 10);
      addText(`POWER ${card.power}`, { fontSize: 11, fill: COLORS.TEXT_POWER, fontWeight: 'bold' }, 0, posY);
    }

    const nameStyle = { 
      fontSize: isResource ? 11 : 9, 
      fontWeight: 'bold', 
      fill: isResource ? COLORS.TEXT_RESOURCE : COLORS.TEXT_DEFAULT 
    };

    if (isResource) {
      addText(cardName, nameStyle, 0, 0);
    } else {
      const posY = isOpponent ? (-ch / 2 - 2) : (ch / 2 + 2);
      addText(cardName, nameStyle, 0, posY);
    }

    if (card?.attached_don > 0) {
      const bx = isOpponent ? (-cw / 2 + 8) : (cw / 2 - 8);
      const by = isOpponent ? (ch / 2 - 8) : (-ch / 2 + 8);
      const donBadge = new PIXI.Graphics().beginFill(0x9370DB, 0.9).drawCircle(bx, by, 10).endFill();
      container.addChild(donBadge);
      addText(`+${card.attached_don}`, { fontSize: 10, fill: 0xFFFFFF, fontWeight: 'bold' }, bx, by);
    }
  } else {
    addText("ONE\nPIECE", { fontSize: 8, fontWeight: 'bold', fill: 0xFFFFFF, align: 'center' }, 0, 0);
  }

  if (options.count && options.count > 0) {
    const bx = isOpponent ? (-cw / 2 + 10) : (cw / 2 - 10);
    const by = isOpponent ? (-ch / 2 + 10) : (ch / 2 - 10);
    const badge = new PIXI.Graphics().beginFill(COLORS.BADGE_BG, 0.8).drawCircle(bx, by, 12).endFill();
    container.addChild(badge);
    addText(options.count.toString(), { fontSize: 12, fill: COLORS.BADGE_TEXT, fontWeight: 'bold' }, bx, by);
  }

  container.eventMode = 'static';
  container.cursor = 'pointer';

  container.on('pointertap', (e) => {
    e.stopPropagation();
    logger.info(`[CardRenderer] pointertap fired. card: ${card?.name}, uuid: ${card?.uuid}`);
    if (options.onClick) {
      options.onClick();
    } else {
      logger.warn(`[CardRenderer] options.onClick is missing for card: ${card?.name}`);
    }
  });

  return container;
};
