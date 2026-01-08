import * as PIXI from 'pixi.js';
import { LAYOUT_CONSTANTS, LAYOUT_PARAMS } from '../layout/layout.config';
import { GAME_UI_CONFIG } from '../game/game.config';
import { logger } from '../utils/logger';
import { API_CONFIG } from '../api/api.config'; // 追加

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

  // --- ベースの描画 (背景色または画像) ---
  if (!isBack && card?.card_id) {
    // ▼▼▼ 画像表示モード ▼▼▼
    const imageUrl = `${API_CONFIG.IMAGE_BASE_URL}/${card.card_id}.png`;
    
    // 画像スプライトを作成
    const sprite = PIXI.Sprite.from(imageUrl);
    sprite.width = cw;
    sprite.height = ch;
    sprite.anchor.set(0.5);
    
    // 角丸マスクを作成
    const mask = new PIXI.Graphics();
    mask.beginFill(0xFFFFFF);
    mask.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, SHAPE.CORNER_RADIUS_CARD);
    mask.endFill();
    sprite.mask = mask;
    
    container.addChild(sprite);
    container.addChild(mask); // マスクもコンテナに追加が必要

    // 枠線だけ上から描画
    const border = new PIXI.Graphics();
    border.lineStyle(SHAPE.STROKE_WIDTH_ZONE, COLORS.ZONE_BORDER);
    border.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, SHAPE.CORNER_RADIUS_CARD);
    container.addChild(border);

  } else {
    // ▼▼▼ 従来通りの色塗りモード (裏面など) ▼▼▼
    const g = new PIXI.Graphics();
    g.lineStyle(SHAPE.STROKE_WIDTH_ZONE, COLORS.ZONE_BORDER);
    g.beginFill(isBack ? COLORS.CARD_BACK : COLORS.ZONE_FILL);
    g.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, SHAPE.CORNER_RADIUS_CARD);
    g.endFill();
    container.addChild(g);
  }

  // テキスト追加ヘルパー
  const addText = (content: string, style: any, x: number, y: number, rotationMode: 'screen' | 'card' | number = 'screen') => {
    const txt = new PIXI.Text(content, style);
    // 画像の上だと文字が見えにくいので、縁取り(ストローク)を追加して視認性を上げる
    if (!isBack) {
      style.stroke = '#000000';
      style.strokeThickness = 3;
      txt.style = style; // スタイル再適用
    }

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

  // --- 情報バッジの描画 (画像の上に重ねる) ---
  if (!isBack) {
    const cardName = card?.name || "";
    const isResource = ['Trash', 'Deck', 'Life'].includes(cardName) || cardName.startsWith('Don!!');
    const isLeader = card?.type === 'LEADER' || card?.type === 'リーダー';

    // 画像があれば中央の大きなテキスト(カード名やパワー)は非表示にしてスッキリさせる
    // ただし、パワーやカウンターなどの「数値」は見えたほうがプレイしやすいので残す
    
    if (card?.cost !== undefined && !isLeader && !isResource) {
      const cx = -cw / 2 + UI_DETAILS.CARD_BADGE_OFFSET;
      const cy = -ch / 2 + UI_DETAILS.CARD_BADGE_OFFSET;
      const costBadge = new PIXI.Graphics()
        .beginFill(COLORS.BADGE_COST_BG, 1) // 不透明度を上げて視認性確保
        .lineStyle(1, 0xFFFFFF)
        .drawCircle(cx, cy, SHAPE.CORNER_RADIUS_BADGE)
        .endFill();
      container.addChild(costBadge);
      addText(`${card.cost}`, { fontSize: SIZES.FONT_COST, fill: COLORS.TEXT_LIGHT, fontWeight: 'bold' }, cx, cy, 'screen');
    }

    if (card?.counter !== undefined && card.counter > 0) {
      const xOffset = isOpponent ? (cw / 2 - UI_DETAILS.CARD_TEXT_PADDING_X) : (-cw / 2 + UI_DETAILS.CARD_TEXT_PADDING_X);
      addText(`+${card.counter}`, { fontSize: SIZES.FONT_COUNTER, fill: '#ffff00', fontWeight: 'bold', stroke: 'black', strokeThickness: 4 }, xOffset, 0, -Math.PI / 2);
    }

    if (card?.power !== undefined && !isResource) {
      // パワーは重要なので画像の上でも目立つように表示
      const pStyle = { fontSize: SIZES.FONT_POWER, fill: COLORS.TEXT_POWER, fontWeight: 'bold', stroke: 'black', strokeThickness: 4 };
      if (isRest) {
        addText(`${card.power}`, pStyle, -cw / 2 - UI_DETAILS.CARD_TEXT_PADDING_X, 0, 'screen');
      } else {
        addText(`${card.power}`, pStyle, 0, -ch / 2 - UI_DETAILS.CARD_TEXT_PADDING_X, 'screen');
      }
    }

    // ドン!!付与数
    if (card?.attached_don > 0) {
      const bx = isOpponent ? (-cw / 2 + UI_DETAILS.CARD_BADGE_DON_OFFSET) : (cw / 2 - UI_DETAILS.CARD_BADGE_DON_OFFSET);
      const by = isOpponent ? (ch / 2 - UI_DETAILS.CARD_BADGE_DON_OFFSET) : (-ch / 2 + UI_DETAILS.CARD_BADGE_DON_OFFSET);
      const donBadge = new PIXI.Graphics()
        .beginFill(COLORS.BADGE_DON_BG, 1)
        .lineStyle(1, 0xFFFFFF)
        .drawCircle(bx, by, SHAPE.CORNER_RADIUS_BADGE)
        .endFill();
      container.addChild(donBadge);
      addText(`+${card.attached_don}`, { fontSize: SIZES.FONT_DON, fill: COLORS.TEXT_LIGHT, fontWeight: 'bold' }, bx, by, 'screen');
    }

  } else {
    // 裏面テキスト
    addText(GAME_UI_CONFIG.TEXT.BACK_SIDE, { fontSize: SIZES.FONT_BACK, fontWeight: 'bold', fill: COLORS.TEXT_LIGHT, align: 'center' }, 0, 0, 'screen');
  }

  // --- 重なり枚数バッジ ---
  if (options.count !== undefined && options.count > 0) {
    const bx = isOpponent ? (-cw / 2 + UI_DETAILS.CARD_BADGE_OFFSET) : (cw / 2 - UI_DETAILS.CARD_BADGE_OFFSET);
    const by = isOpponent ? (-ch / 2 + UI_DETAILS.CARD_BADGE_OFFSET) : (ch / 2 - UI_DETAILS.CARD_BADGE_OFFSET);
    const badge = new PIXI.Graphics()
        .beginFill(COLORS.BADGE_BG, 1)
        .lineStyle(1, 0xFFFFFF)
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
    if (Math.sqrt(dx * dx + dy * dy) <= PHYSICS.TAP_THRESHOLD) {
      e.stopPropagation();
      logger.log({
        level: 'info',
        action: 'ui.card_tap',
        msg: `Card tapped: ${card?.name || 'unknown'}`,
        payload: { uuid: card?.uuid, isOpponent }
      });
      if (options.onClick) options.onClick();
    }
  });

  return container;
};
