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
  
  // 相手側のカード（P2）かどうかを判定
  // RealGame.tsx から渡されるプレイヤー情報や location 文字列から判断
  const isOpponent = card?.owner === 'p2' || card?.location?.includes('opp');
  const isRest = card?.is_rest === true || card?.location === 'don_rest';

  // テキストの回転補正角を計算
  // 相手側（PI）かつレスト状態（-PI/2）などを考慮し、常にプレイヤーから見て正位置にする
  const getCorrectionAngle = () => {
    let angle = 0;
    if (isOpponent) angle += Math.PI; // 相手側なら180度回転して相殺
    return angle;
  };

  const textRotation = getCorrectionAngle();
  
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
    
    // POWER表示
    if (card?.power !== undefined) {
      const pTxt = new PIXI.Text(`POWER ${card.power}`, new PIXI.TextStyle({ 
        fontSize: 11, 
        fill: COLORS.TEXT_POWER, 
        fontWeight: 'bold' 
      }));
      pTxt.anchor.set(0.5);
      pTxt.rotation = textRotation; // 文字だけ回転を打ち消す
      pTxt.y = -ch / 2 - 10;
      container.addChild(pTxt);
    }

    // カード名表示
    const nTxt = new PIXI.Text(cardName, new PIXI.TextStyle({ 
      fontSize: 10, 
      fontWeight: 'bold', 
      fill: COLORS.TEXT_DEFAULT 
    }));
    nTxt.anchor.set(0.5);
    nTxt.rotation = textRotation; // 文字だけ回転を打ち消す
    nTxt.y = ch / 2 + 2;
    container.addChild(nTxt);

    // ドン!!付与表示
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
      dTxt.rotation = textRotation; // 数字だけ回転を打ち消す
      container.addChild(donBadge, dTxt);
    }
  } else {
    // カード裏面
    const backTxt = new PIXI.Text("ONE\nPIECE", new PIXI.TextStyle({ 
      fontSize: 8, 
      fontWeight: 'bold', 
      fill: 0xFFFFFF, 
      align: 'center' 
    }));
    backTxt.anchor.set(0.5);
    backTxt.rotation = textRotation; // 裏面の文字も正位置にする
    container.addChild(backTxt);
  }

  // 枚数バッジ (デッキやライフなど)
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
    cTxt.rotation = textRotation; // 枚数表示も正位置にする
    container.addChild(badge, cTxt);
  }

  container.eventMode = 'static';
  container.cursor = 'pointer';
  container.on('pointerdown', (e) => { 
    e.stopPropagation(); 
    options.onClick(); 
  });

  // ロギング（デバッグ用）
  if (isOpponent) {
    logger.log({
      level: 'debug',
      action: 'ui.card_render_opponent',
      msg: `Rendering opponent card with rotation correction: ${card?.name}`,
      payload: { textRotation }
    });
  }

  return container;
};
