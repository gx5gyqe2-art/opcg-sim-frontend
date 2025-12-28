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
  
  const isOpponent = card?.owner_id === 'p2' || card?.owner === 'p2' || card?.location?.includes('opp');
  const isRest = card?.is_rest === true || card?.location === 'don_rest';

  // 相手側なら180度回転して相殺
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

    // 1. POWER表示
    if (card?.power !== undefined && !isResource) {
      const pTxt = new PIXI.Text(`POWER ${card.power}`, new PIXI.TextStyle({ 
        fontSize: 11, fill: COLORS.TEXT_POWER, fontWeight: 'bold' 
      }));
      pTxt.anchor.set(0.5);
      
      const posY = isOpponent ? (ch / 2 + 10) : (-ch / 2 - 10);

      if (isRest) {
        // レスト時は -90度 + 反転補正
        pTxt.rotation = -Math.PI / 2 + textRotation;
        pTxt.x = posY; 
        pTxt.y = 0;
      } else {
        pTxt.rotation = textRotation;
        pTxt.x = 0; 
        pTxt.y = posY;
      }
      container.addChild(pTxt);
    }

    // 2. カード名 / リソース名 表示
    const nTxt = new PIXI.Text(cardName, new PIXI.TextStyle({ 
      fontSize: isResource ? 11 : 9, fontWeight: 'bold', fill: isResource ? COLORS.TEXT_RESOURCE : COLORS.TEXT_DEFAULT 
    }));
    nTxt.anchor.set(0.5);

    if (isResource) {
      // ドン!!などのリソース系もここで確実に回転補正を適用
      nTxt.rotation = textRotation;
      nTxt.x = 0; 
      nTxt.y = 0; 
    } else {
      const posY = isOpponent ? (-ch / 2 - 2) : (ch / 2 + 2);
      
      if (isRest) {
        nTxt.rotation = -Math.PI / 2 + textRotation;
        nTxt.x = posY; 
        nTxt.y = 0;
      } else {
        nTxt.rotation = textRotation;
        nTxt.x = 0; 
        nTxt.y = posY;
      }
    }
    container.addChild(nTxt);

    // 3. ドン!!付与数バッジ
    if (card?.attached_don && card.attached_don > 0) {
      const bx = isOpponent ? (-cw / 2 + 8) : (cw / 2 - 8);
      const by = isOpponent ? (ch / 2 - 8) : (-ch / 2 + 8);
      
      const donBadge = new PIXI.Graphics().beginFill(0x9370DB, 0.9).drawCircle(bx, by, 10).endFill();
      const dTxt = new PIXI.Text(`+${card.attached_don}`, new PIXI.TextStyle({ fontSize: 10, fill: 0xFFFFFF, fontWeight: 'bold' }));
      dTxt.anchor.set(0.5);
      dTxt.position.set(bx, by);
      dTxt.rotation = textRotation; // 反転補正
      container.addChild(donBadge, dTxt);
    }
  } else {
    // 4. カード裏面テキスト
    const backTxt = new PIXI.Text("ONE\nPIECE", new PIXI.TextStyle({ fontSize: 8, fontWeight: 'bold', fill: 0xFFFFFF, align: 'center' }));
    backTxt.anchor.set(0.5);
    backTxt.rotation = textRotation; // 反転補正
    container.addChild(backTxt);
  }

  // 5. 枚数バッジ
  if (options.count && options.count > 0) {
    const bx = isOpponent ? (-cw / 2 + 10) : (cw / 2 - 10);
    const by = isOpponent ? (-ch / 2 + 10) : (ch / 2 - 10);
    
    const badge = new PIXI.Graphics().beginFill(COLORS.BADGE_BG, 0.8).drawCircle(bx, by, 12).endFill();
    const cTxt = new PIXI.Text(options.count.toString(), new PIXI.TextStyle({ fontSize: 12, fill: COLORS.BADGE_TEXT, fontWeight: 'bold' }));
    cTxt.anchor.set(0.5); 
    cTxt.position.set(bx, by);
    cTxt.rotation = textRotation; // 反転補正
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
