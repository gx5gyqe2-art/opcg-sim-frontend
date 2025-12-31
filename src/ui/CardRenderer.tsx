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
  const isOpponent = options.isOpponent ?? false;
  const isRest = card?.is_rest === true;
  const isBack = card?.is_face_up === false;

  // --- 1. コンテナの回転設定 ---
  if (isRest) {
    container.rotation = Math.PI / 2;
  }

  // --- 2. カード背景の描画 ---
  const g = new PIXI.Graphics();
  g.lineStyle(2, COLORS.ZONE_BORDER);
  g.beginFill(isBack ? COLORS.CARD_BACK : COLORS.ZONE_FILL);
  g.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, 6);
  g.endFill();
  container.addChild(g);

  // --- 3. テキスト描画ヘルパー ---
  const addText = (content: string, style: any, x: number, y: number, customRotation: number = 0) => {
    const txt = new PIXI.Text(content, style);
    const maxWidth = isRest ? ch * 1.1 : cw * 1.1;

    if (txt.width > maxWidth) {
      let fullText = content;
      while (txt.width > maxWidth && fullText.length > 0) {
        fullText = fullText.slice(0, -1);
        txt.text = fullText + "...";
      }
    }

    txt.anchor.set(0.5);
    txt.position.set(x, y);
    
    // 文字の回転補正
    const baseRotation = isRest ? -Math.PI / 2 : 0;
    txt.rotation = baseRotation + customRotation;
    
    container.addChild(txt);
  };

  // --- 4. コンテンツ配置ロジック ---
  if (!isBack) {
    const cardName = card?.name || "";
    const isResource = ['DON!!', 'Trash', 'Deck', 'Don!!', 'Life', 'Stage'].includes(cardName);

    // ■ コスト (常に左上)
    if (card?.cost !== undefined) {
      const cx = -cw / 2 + 10;
      const cy = -ch / 2 + 10;
      const costBadge = new PIXI.Graphics().beginFill(0x2c3e50, 0.9).drawCircle(cx, cy, 9).endFill();
      container.addChild(costBadge);
      addText(`${card.cost}`, { fontSize: 10, fill: 0xFFFFFF, fontWeight: 'bold' }, cx, cy);
    }

    // ■ カウンター
    if (card?.counter !== undefined && card.counter > 0) {
      if (isRest) {
        // 【レスト時】画面上側の「左寄り」に配置
        // ローカル座標: x(カード左辺)=-cw/2, y(画面左方向)=+ch/4
        const ctx = -cw / 2 + 8; 
        const cty = ch / 4; 
        // レスト時は文字を水平(0度)で見せたいので、カスタム回転で相殺する
        // baseRotation(-90) + custom(90) = 0
        addText(`+${card.counter}`, { fontSize: 9, fill: 0xe67e22, fontWeight: 'bold' }, ctx, cty, Math.PI / 2);
      } else {
        // 【通常時】カード左辺の中央
        const ctx = -cw / 2 + 6;
        const cty = 0; 
        // 縦書き風 (-90度)
        addText(`+${card.counter}`, { fontSize: 9, fill: 0xe67e22, fontWeight: 'bold' }, ctx, cty, -Math.PI / 2);
      }
    }

    // ■ パワー
    if (card?.power !== undefined && !isResource) {
      if (isRest) {
        // 【レスト時】画面上側の「右寄り」に配置
        // ローカル座標: x(カード左辺)=-cw/2, y(画面右方向)=-ch/4
        const posX = -cw / 2 - 12; // カードの外側へ少し出す
        const posY = -ch / 4;
        addText(`${card.power}`, { fontSize: 11, fill: COLORS.TEXT_POWER, fontWeight: 'bold' }, posX, posY);
      } else {
        // 【通常時】カード上辺の外側
        const posY = -ch / 2 - 12;
        addText(`${card.power}`, { fontSize: 11, fill: COLORS.TEXT_POWER, fontWeight: 'bold' }, 0, posY);
      }
    }

    // ■ 名前
    const nameStyle = { 
      fontSize: isResource ? 11 : 9, 
      fontWeight: 'bold', 
      fill: isResource ? COLORS.TEXT_RESOURCE : COLORS.TEXT_DEFAULT 
    };

    if (isResource) {
      addText(cardName, nameStyle, 0, 0);
    } else {
      if (isRest) {
        // 【レスト時】画面下側（カード右辺）に配置
        // ローカル座標: x(カード右辺)=cw/2
        const posX = cw / 2 + 4;
        addText(cardName, nameStyle, posX, 0); 
      } else {
        // 【通常時】カード下辺の外側
        const posY = ch / 2 + 4;
        addText(cardName, nameStyle, 0, posY);
      }
    }

    // ■ ドン!!付与 (中央)
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

  // ■ 重なり枚数バッジ
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
