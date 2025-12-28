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
  
  // ログ分析に基づき、判定条件を location 優先に修正
  // 相手のドン、トラッシュ、デッキ、ライフは location 名に必ず 'opp' か 'p2' が含まれる仕様を利用
  const loc = (card?.location || "").toLowerCase();
  const isOpponent = 
    card?.isOpponentFlag === true || 
    card?.owner_id === 'p2' || 
    card?.owner === 'p2' || 
    loc.includes('opp') || 
    loc.includes('p2');

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

  // テキスト描画共通関数（回転を確実に適用するため）
  const addText = (content: string, style: any, x: number, y: number, isLabel: boolean = false) => {
    const txt = new PIXI.Text(content, style);
    txt.anchor.set(0.5);
    
    if (isLabel && !isBack) {
      // パワーや名前の配置位置補正
      txt.position.set(x, y);
      txt.rotation = isRest ? (-Math.PI / 2 + textRotation) : textRotation;
    } else {
      // ドン!!、トラッシュ、裏面ロゴなど中央要素の回転
      txt.position.set(0, 0);
      txt.rotation = textRotation;
    }
    container.addChild(txt);
  };

  if (!isBack) {
    const cardName = card?.name || "";
    const isResource = ['DON!!', 'Trash', 'Deck', 'Don!!', 'Life', 'Stage'].includes(cardName) || 
                       loc.includes('don');

    // POWER
    if (card?.power !== undefined && !isResource) {
      const posY = isOpponent ? (ch / 2 + 10) : (-ch / 2 - 10);
      addText(`POWER ${card.power}`, { fontSize: 11, fill: COLORS.TEXT_POWER, fontWeight: 'bold' }, 0, posY, true);
    }

    // NAME / RESOURCE (ドン!! や トラッシュ はここ)
    const nameStyle = { fontSize: isResource ? 11 : 9, fontWeight: 'bold', fill: isResource ? COLORS.TEXT_RESOURCE : COLORS.TEXT_DEFAULT };
    if (isResource) {
      addText(cardName, nameStyle, 0, 0, false);
    } else {
      const posY = isOpponent ? (-ch / 2 - 2) : (ch / 2 + 2);
      addText(cardName, nameStyle, 0, posY, true);
    }

    // ドン!!付与
    if (card?.attached_don > 0) {
      const bx = isOpponent ? (-cw / 2 + 8) : (cw / 2 - 8);
      const by = isOpponent ? (ch / 2 - 8) : (-ch / 2 + 8);
      const donBadge = new PIXI.Graphics().beginFill(0x9370DB, 0.9).drawCircle(bx, by, 10).endFill();
      container.addChild(donBadge);
      
      const dTxt = new PIXI.Text(`+${card.attached_don}`, { fontSize: 10, fill: 0xFFFFFF, fontWeight: 'bold' });
      dTxt.anchor.set(0.5);
      dTxt.position.set(bx, by);
      dTxt.rotation = textRotation;
      container.addChild(dTxt);
    }
  } else {
    // 裏面ロゴ
    addText("ONE\nPIECE", { fontSize: 8, fontWeight: 'bold', fill: 0xFFFFFF, align: 'center' }, 0, 0, false);
  }

  // 枚数バッジ
  if (options.count && options.count > 0) {
    const bx = isOpponent ? (-cw / 2 + 10) : (cw / 2 - 10);
    const by = isOpponent ? (-ch / 2 + 10) : (ch / 2 - 10);
    const badge = new PIXI.Graphics().beginFill(COLORS.BADGE_BG, 0.8).drawCircle(bx, by, 12).endFill();
    container.addChild(badge);
    
    const cTxt = new PIXI.Text(options.count.toString(), { fontSize: 12, fill: COLORS.BADGE_TEXT, fontWeight: 'bold' });
    cTxt.anchor.set(0.5);
    cTxt.position.set(bx, by);
    cTxt.rotation = textRotation;
    container.addChild(cTxt);
  }

  container.eventMode = 'static';
  container.cursor = 'pointer';
  container.on('pointerdown', (e) => { e.stopPropagation(); options.onClick(); });

  return container;
};
