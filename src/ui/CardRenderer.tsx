import * as PIXI from 'pixi.js';
import { LAYOUT_CONSTANTS, LAYOUT_PARAMS } from '../layout/layout.config';
import { GAME_UI_CONFIG } from '../game/game.config'; // 背面テキスト参照用
import { logger } from '../utils/logger';

const { COLORS, SIZES } = LAYOUT_CONSTANTS;
const { SHAPE, UI_DETAILS, ALPHA, PHYSICS } = LAYOUT_PARAMS;

export const createCardContainer = (
  card: any,
  cw: number,
  ch: number,
  options: { count?: number; onClick: () => void; isOpponent?: boolean }
) => {
  const container = new PIXI.Container();
  const isOpponent = options.isOpponent ?? false;
  const isRest = card?.is_rest === true;
  const isBack = card?.is_face_up === false;

  if (isRest) {
    container.rotation = Math.PI / 2;
  }

  const g = new PIXI.Graphics();
  g.lineStyle(SHAPE.STROKE_WIDTH_ZONE, COLORS.ZONE_BORDER);
  g.beginFill(isBack ? COLORS.CARD_BACK : COLORS.ZONE_FILL);
  g.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, SHAPE.CORNER_RADIUS_CARD);
  g.endFill();
  container.addChild(g);

  const addText = (content: string, style: any, x: number, y: number, rotationMode: 'screen' | 'card' | number = 'screen') => {
    const txt = new PIXI.Text(content, style);
    const maxWidth = isRest ? ch * UI_DETAILS.CARD_TEXT_MAX_WIDTH_RATIO : cw * UI_DETAILS.CARD_TEXT_MAX_WIDTH_RATIO;

    if (txt.width > maxWidth) {
      let fullText = content;
      while (txt.width > maxWidth && fullText.length > 0) {
        fullText = fullText.slice(0, -1);
        txt.text = fullText + "...";
      }
    }

    txt.anchor.set(0.5);
    txt.position.set(x, y);
    
    if (rotationMode === 'screen') {
      txt.rotation = -container.rotation;
    } else if (rotationMode === 'card') {
      txt.rotation = 0;
    } else {
      txt.rotation = rotationMode;
    }
    
    container.addChild(txt);
  };

  if (!isBack) {
    const cardName = card?.name || "";
    const isResource = ['Trash', 'Deck', 'Life'].includes(cardName) || cardName.startsWith('Don!!');
    const isLeader = card?.type === 'LEADER' || card?.type === 'リーダー';

    if (card?.cost !== undefined && !isLeader && !isResource) {
      const cx = -cw / 2 + UI_DETAILS.CARD_BADGE_OFFSET;
      const cy = -ch / 2 + UI_DETAILS.CARD_BADGE_OFFSET;
      const costBadge = new PIXI.Graphics()
        .beginFill(COLORS.BADGE_COST_BG, ALPHA.BADGE_BG)
        .drawCircle(cx, cy, SHAPE.CORNER_RADIUS_BADGE)
        .endFill();
      container.addChild(costBadge);
      addText(`${card.cost}`, { fontSize: SIZES.FONT_COST, fill: COLORS.TEXT_LIGHT, fontWeight: 'bold' }, cx, cy, 'screen');
    }

    if (card?.counter !== undefined && card.counter > 0) {
      const xOffset = isOpponent ? (cw / 2 - UI_DETAILS.CARD_TEXT_PADDING_X) : (-cw / 2 + UI_DETAILS.CARD_TEXT_PADDING_X);
      const cty = 0; 
      addText(`+${card.counter}`, { fontSize: SIZES.FONT_COUNTER, fill: COLORS.TEXT_COUNTER, fontWeight: 'bold' }, xOffset, cty, -Math.PI / 2);
    }

    if (card?.power !== undefined && !isResource) {
      if (isRest) {
        const posX = -cw / 2 - UI_DETAILS.CARD_TEXT_PADDING_X; 
        const posY = 0;
        addText(`${card.power}`, { fontSize: SIZES.FONT_POWER, fill: COLORS.TEXT_POWER, fontWeight: 'bold' }, posX, posY, 'screen');
      } else {
        const posY = -ch / 2 - UI_DETAILS.CARD_TEXT_PADDING_X;
        addText(`${card.power}`, { fontSize: SIZES.FONT_POWER, fill: COLORS.TEXT_POWER, fontWeight: 'bold' }, 0, posY, 'screen');
      }
    }

    const nameStyle = { 
      fontSize: isResource ? SIZES.FONT_NAME_RESOURCE : SIZES.FONT_NAME_NORMAL, 
      fontWeight: 'bold', 
      fill: isResource ? COLORS.TEXT_RESOURCE : COLORS.TEXT_DEFAULT 
    };

    if (isResource) {
      addText(cardName, nameStyle, 0, 0, 'screen');
    } else {
      if (isRest) {
        const posX = cw / 2 + UI_DETAILS.CARD_TEXT_PADDING_Y;
        addText(cardName, nameStyle, posX, 0, 'screen'); 
      } else {
        const posY = ch / 2 + UI_DETAILS.CARD_TEXT_PADDING_Y;
        addText(cardName, nameStyle, 0, posY, 'screen');
      }
    }

    if (card?.attached_don > 0) {
      const bx = isOpponent ? (-cw / 2 + UI_DETAILS.CARD_BADGE_DON_OFFSET) : (cw / 2 - UI_DETAILS.CARD_BADGE_DON_OFFSET);
      const by = isOpponent ? (ch / 2 - UI_DETAILS.CARD_BADGE_DON_OFFSET) : (-ch / 2 + UI_DETAILS.CARD_BADGE_DON_OFFSET);
      const donBadge = new PIXI.Graphics()
        .beginFill(COLORS.BADGE_DON_BG, ALPHA.BADGE_BG)
        .drawCircle(bx, by, SHAPE.CORNER_RADIUS_BADGE)
        .endFill();
      container.addChild(donBadge);
      addText(`+${card.attached_don}`, { fontSize: SIZES.FONT_DON, fill: COLORS.TEXT_LIGHT, fontWeight: 'bold' }, bx, by, 'screen');
    }

  } else {
    addText(GAME_UI_CONFIG.TEXT.BACK_SIDE, { fontSize: SIZES.FONT_BACK, fontWeight: 'bold', fill: COLORS.TEXT_LIGHT, align: 'center' }, 0, 0, 'screen');
  }

  if (options.count !== undefined && options.count > 0) {
    const bx = isOpponent ? (-cw / 2 + UI_DETAILS.CARD_BADGE_OFFSET) : (cw / 2 - UI_DETAILS.CARD_BADGE_OFFSET);
    const by = isOpponent ? (-ch / 2 + UI_DETAILS.CARD_BADGE_OFFSET) : (ch / 2 - UI_DETAILS.CARD_BADGE_OFFSET);
    const badge = new PIXI.Graphics()
        .beginFill(COLORS.BADGE_BG, ALPHA.BADGE_COUNT)
        .drawCircle(bx, by, SHAPE.CORNER_RADIUS_BADGE)
        .endFill();
    container.addChild(badge);
    addText(options.count.toString(), { fontSize: SIZES.FONT_COUNT, fill: COLORS.BADGE_TEXT, fontWeight: 'bold' }, bx, by, 'screen');
  }

  container.eventMode = 'static';
  container.cursor = 'pointer';

  let pointerDownPos = { x: 0, y: 0 };

  container.on('pointerdown', (e) => {
    pointerDownPos = { x: e.global.x, y: e.global.y };
  });

  container.on('pointertap', (e) => {
    const dx = e.global.x - pointerDownPos.x;
    const dy = e.global.y - pointerDownPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > PHYSICS.TAP_THRESHOLD) {
      return;
    }

    e.stopPropagation();
    
    logger.log({
      level: 'info',
      action: 'ui.card_tap',
      msg: `Card tapped: ${card?.name || 'unknown'}`,
      payload: { uuid: card?.uuid, isOpponent, power: card?.power }
    });

    if (options.onClick) options.onClick();
  });

  return container;
};
