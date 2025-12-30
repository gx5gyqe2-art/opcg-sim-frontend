import * as PIXI from 'pixi.js';
import { LAYOUT_CONSTANTS } from '../layout/layout.config';
import { logger } from '../utils/logger';

const { COLORS } = LAYOUT_CONSTANTS;

// 修正案
export const createCardContainer = (
  card: any,
  cw: number,
  ch: number,
  options: { count?: number; onClick: () => void; isOpponent?: boolean }
) => {
  const container = new PIXI.Container();
  
  const isOpponent = options.isOpponent ?? false;

  // 相手側であっても、文字は常に操作ユーザーから見て正位置（0度）に固定
  const textRotation = 0; 
  
  const isRest = card?.is_rest === true;

  if (isRest) container.rotation = Math.PI / 2;

  const isBack = card?.is_face_up === false;

  const g = new PIXI.Graphics();
  g.lineStyle(2, COLORS.ZONE_BORDER);
  g.beginFill(isBack ? COLORS.CARD_BACK : COLORS.ZONE_FILL);
  g.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, 6);
  g.endFill();
  container.addChild(g);

  const addText = (content: string, style: any, x: number, y: number, customRotation?: number) => {
    const txt = new PIXI.Text(content, style);
    const maxWidth = cw * 1.1;

    if (txt.width > maxWidth) {
      let fullText = content;
      while (txt.width > maxWidth && fullText.length > 0) {
        fullText = fullText.slice(0, -1);
        txt.text = fullText + "...";
      }
    }

    txt.anchor.set(0.5);
    txt.position.set(x, y);
    
    // カスタム回転（カウンター等）がない場合は、状態に合わせて回転
    if (customRotation !== undefined) {
      txt.rotation = customRotation + textRotation;
    } else {
      txt.rotation = isRest ? (-Math.PI / 2 + textRotation) : textRotation;
    }
    
    container.addChild(txt);
  };


  if (!isBack) {
    const cardName = card?.name || "";
    const isResource = ['DON!!', 'Trash', 'Deck', 'Don!!', 'Life', 'Stage'].includes(cardName);

    if (card?.cost !== undefined) {
      const cx = -cw / 2 + 10;
      const cy = -ch / 2 + 10;
      const costBadge = new PIXI.Graphics().beginFill(0x2c3e50, 0.9).drawCircle(cx, cy, 9).endFill();
      container.addChild(costBadge);
      addText(`${card.cost}`, { fontSize: 10, fill: 0xFFFFFF, fontWeight: 'bold' }, cx, cy);
    }

    if (card?.counter !== undefined && card.counter > 0) {
      const ctx = -cw / 2 + 6;
      const cty = 0;
      // カウンターは横に-90度回転させた状態で配置
      addText(`+${card.counter}`, { fontSize: 9, fill: 0xe67e22, fontWeight: 'bold' }, ctx, cty, -Math.PI / 2);
    }

    if (card?.power !== undefined && !isResource) {
      // 常にカードの上側にパワーを表示
      const posY = -ch / 2 - 12;
      addText(`${card.power}`, { fontSize: 11, fill: COLORS.TEXT_POWER, fontWeight: 'bold' }, 0, posY);
    }

    const nameStyle = { 
      fontSize: isResource ? 11 : 9, 
      fontWeight: 'bold', 
      fill: isResource ? COLORS.TEXT_RESOURCE : COLORS.TEXT_DEFAULT 
    };

    if (isResource) {
      addText(cardName, nameStyle, 0, 0);
    } else {
      // 常にカードの下側に名前を配置
      const posY = ch / 2 + 4;
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
