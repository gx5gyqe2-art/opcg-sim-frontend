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
  const addText = (content: string, style: any, x: number, y: number, rotationMode: 'screen' | 'card' | number = 'screen') => {
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
    
    if (rotationMode === 'screen') {
      txt.rotation = -container.rotation;
    } else if (rotationMode === 'card') {
      txt.rotation = 0;
    } else {
      txt.rotation = rotationMode;
    }
    
    container.addChild(txt);
  };

  // --- 4. コンテンツ配置ロジック ---
  if (!isBack) {
    const cardName = card?.name || "";
    const isResource = ['DON!!', 'Trash', 'Deck', 'Don!!', 'Life', 'Stage'].includes(cardName);
    const isLeader = card?.type === 'LEADER' || card?.type === 'リーダー';

    // ■ コスト (左上) - リーダーは表示しない
    if (card?.cost !== undefined && !isLeader) {
      const cx = -cw / 2 + 10;
      const cy = -ch / 2 + 10;
      // 半径9に統一
      const costBadge = new PIXI.Graphics().beginFill(0x2c3e50, 0.9).drawCircle(cx, cy, 9).endFill();
      container.addChild(costBadge);
      addText(`${card.cost}`, { fontSize: 10, fill: 0xFFFFFF, fontWeight: 'bold' }, cx, cy, 'screen');
    }

    // ■ カウンター (自分:左辺 / 相手:右辺)
    if (card?.counter !== undefined && card.counter > 0) {
      // 相手なら右側(x正)、自分なら左側(x負)
      const xOffset = isOpponent ? (cw / 2 - 6) : (-cw / 2 + 6);
      const cty = 0; 
      addText(`+${card.counter}`, { fontSize: 9, fill: 0xe67e22, fontWeight: 'bold' }, xOffset, cty, -Math.PI / 2);
    }

    // ■ パワー (上辺中央) - カードに近づける (-12 -> -6)
    if (card?.power !== undefined && !isResource) {
      if (isRest) {
        // レスト時: 画面左側（上）中央
        const posX = -cw / 2 - 6; // カードに近づける
        const posY = 0;
        addText(`${card.power}`, { fontSize: 11, fill: COLORS.TEXT_POWER, fontWeight: 'bold' }, posX, posY, 'screen');
      } else {
        // 通常時: カード上
        const posY = -ch / 2 - 6; // カードに近づける
        addText(`${card.power}`, { fontSize: 11, fill: COLORS.TEXT_POWER, fontWeight: 'bold' }, 0, posY, 'screen');
      }
    }

    // ■ 名前 (下辺中央) - カードから離す (+4 -> +12)
    const nameStyle = { 
      fontSize: isResource ? 11 : 9, 
      fontWeight: 'bold', 
      fill: isResource ? COLORS.TEXT_RESOURCE : COLORS.TEXT_DEFAULT 
    };

    if (isResource) {
      addText(cardName, nameStyle, 0, 0, 'screen');
    } else {
      if (isRest) {
        // レスト時: 画面右側（下）中央
        const posX = cw / 2 + 12; // カードから離す
        addText(cardName, nameStyle, posX, 0, 'screen'); 
      } else {
        // 通常時: カード下
        const posY = ch / 2 + 12; // カードから離す
        addText(cardName, nameStyle, 0, posY, 'screen');
      }
    }

    // ■ ドン!!付与 (中央) - バッジサイズ統一
    if (card?.attached_don > 0) {
      const bx = isOpponent ? (-cw / 2 + 8) : (cw / 2 - 8);
      const by = isOpponent ? (ch / 2 - 8) : (-ch / 2 + 8);
      // 半径9に統一
      const donBadge = new PIXI.Graphics().beginFill(0x9370DB, 0.9).drawCircle(bx, by, 9).endFill();
      container.addChild(donBadge);
      addText(`+${card.attached_don}`, { fontSize: 10, fill: 0xFFFFFF, fontWeight: 'bold' }, bx, by, 'screen');
    }

  } else {
    // 裏面
    addText("ONE\nPIECE", { fontSize: 8, fontWeight: 'bold', fill: 0xFFFFFF, align: 'center' }, 0, 0, 'screen');
  }

  // ■ 重なり枚数バッジ - バッジサイズ統一
  if (options.count && options.count > 0) {
    const bx = isOpponent ? (-cw / 2 + 10) : (cw / 2 - 10);
    const by = isOpponent ? (-ch / 2 + 10) : (ch / 2 - 10);
    // 半径9に統一
    const badge = new PIXI.Graphics().beginFill(COLORS.BADGE_BG, 0.8).drawCircle(bx, by, 9).endFill();
    container.addChild(badge);
    addText(options.count.toString(), { fontSize: 12, fill: COLORS.BADGE_TEXT, fontWeight: 'bold' }, bx, by, 'screen');
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
