import * as PIXI from 'pixi.js';
import { LAYOUT_CONSTANTS, LAYOUT_PARAMS } from '../layout/layout.config';
import { GAME_UI_CONFIG } from '../game/game.config';
import { logger } from '../utils/logger';
import { getCardImageUrl, getBackImageUrl } from '../utils/imageAssets';

const { COLORS, SIZES } = LAYOUT_CONSTANTS;
const { SHAPE, UI_DETAILS, PHYSICS } = LAYOUT_PARAMS;

export const createCardContainer = (
  card: any,
  cw: number,
  ch: number,
  options: { count?: number; onClick: () => void; isOpponent?: boolean }
) => {
  const container = new PIXI.Container();
  if (card?.uuid) {
    container.name = card.uuid;
  }

  const isOpponent = options.isOpponent ?? false;
  const isRest = card?.is_rest === true;
  const isBack = card?.is_face_up === false;
  const isEmpty = options.count !== undefined && options.count <= 0;

  if (isRest) {
    container.rotation = Math.PI / 2;
  }

  // --- 画像URLの決定 ---
  let imageUrl = null;
  const cardName = card?.name || "";

  if (!isEmpty) {
    if (cardName === 'Don!! Deck') {
      // ドンデッキ裏面
      imageUrl = getBackImageUrl('DON');
    } else if (cardName === 'Deck' || cardName === 'Life') {
      // デッキ・ライフ裏面
      imageUrl = getBackImageUrl('MAIN');
    } else if (isBack) {
      // その他の裏面カード（手札など）
      imageUrl = getBackImageUrl('MAIN');
    } else if (card?.card_id) {
      // 表面: IDがある場合 (DONを含む)
      imageUrl = getCardImageUrl(card.card_id);
    }
  }

  // --- 描画処理 ---
  if (isEmpty) {
    // 0枚時は枠のみ
    const g = new PIXI.Graphics();
    g.lineStyle(2, 0x666666, 0.5);
    g.beginFill(0x000000, 0.2);
    g.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, SHAPE.CORNER_RADIUS_CARD);
    g.endFill();
    container.addChild(g);
    
    const txt = new PIXI.Text("EMPTY", { fontSize: 14, fill: 0x666666 });
    txt.anchor.set(0.5);
    container.addChild(txt);

  } else if (imageUrl) {
    // --- 画像表示モード (非同期読み込み対応版) ---
    
    // 1. まずフォールバック（裏面）用のテクスチャを用意
    const fallbackUrl = getBackImageUrl('MAIN');
    const fallbackTexture = PIXI.Texture.from(fallbackUrl);
    
    // 2. スプライトを生成（最初はフォールバックで初期化しても良いが、targetTextureが既にあればそちらを使う）
    const targetTexture = PIXI.Texture.from(imageUrl);
    
    // ロード済みかどうかで初期テクスチャを決定
    const initialTexture = targetTexture.valid ? targetTexture : fallbackTexture;
    const sprite = new PIXI.Sprite(initialTexture);
    
    sprite.width = cw;
    sprite.height = ch;
    sprite.anchor.set(0.5);

    // 3. ロード未完了の場合、完了イベントを待機して差し替え
    if (!targetTexture.valid) {
      targetTexture.baseTexture.once('loaded', () => {
        sprite.texture = targetTexture;
        // テクスチャ差し替えでサイズが変わる可能性があるため再設定
        sprite.width = cw;
        sprite.height = ch;
      });
      
      targetTexture.baseTexture.once('error', () => {
        logger.warn('ui.card_image_error', `Failed to load image: ${imageUrl}`);
        // エラー時はフォールバックのままにする（必要ならここで再セット）
        sprite.texture = fallbackTexture;
        sprite.width = cw;
        sprite.height = ch;
      });
    }
    
    const mask = new PIXI.Graphics();
    mask.beginFill(0xFFFFFF);
    mask.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, SHAPE.CORNER_RADIUS_CARD);
    mask.endFill();
    sprite.mask = mask;
    
    container.addChild(sprite);
    container.addChild(mask);

    // 枠線
    const border = new PIXI.Graphics();
    border.lineStyle(SHAPE.STROKE_WIDTH_ZONE, COLORS.ZONE_BORDER);
    border.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, SHAPE.CORNER_RADIUS_CARD);
    container.addChild(border);

  } else {
    // 画像なし & 裏面でない場合のフォールバック（色塗り）
    const g = new PIXI.Graphics();
    g.lineStyle(SHAPE.STROKE_WIDTH_ZONE, COLORS.ZONE_BORDER);
    g.beginFill(isBack ? COLORS.CARD_BACK : COLORS.ZONE_FILL);
    g.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, SHAPE.CORNER_RADIUS_CARD);
    g.endFill();
    container.addChild(g);
  }

  if (isEmpty) return container;

  // テキスト追加ヘルパー
  const addText = (content: string, style: any, x: number, y: number, rotationMode: 'screen' | 'card' | number = 'screen') => {
    const txt = new PIXI.Text(content, style);
    if (!isBack && imageUrl) {
      style.stroke = '#000000';
      style.strokeThickness = 3;
      txt.style = style;
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

  // --- 情報表示 (画像がある場合はテキストを非表示にする) ---
  if (!isBack) {
    const isResource = ['Trash', 'Deck', 'Life'].includes(cardName) || cardName.startsWith('Don!!');
    const isLeader = card?.type === 'LEADER' || card?.type === 'リーダー';

    // バッジ（コスト）
    if (card?.cost !== undefined && !isLeader && !isResource) {
      const cx = -cw / 2 + UI_DETAILS.CARD_BADGE_OFFSET;
      const cy = -ch / 2 + UI_DETAILS.CARD_BADGE_OFFSET;
      const costBadge = new PIXI.Graphics()
        .beginFill(COLORS.BADGE_COST_BG, 1)
        .lineStyle(1, 0xFFFFFF)
        .drawCircle(cx, cy, SHAPE.CORNER_RADIUS_BADGE)
        .endFill();
      container.addChild(costBadge);
      addText(`${card.cost}`, { fontSize: SIZES.FONT_COST, fill: COLORS.TEXT_LIGHT, fontWeight: 'bold' }, cx, cy, 'screen');
    }

    // カウンター
    if (card?.counter !== undefined && card.counter > 0) {
      const xOffset = isOpponent ? (cw / 2 - UI_DETAILS.CARD_TEXT_PADDING_X) : (-cw / 2 + UI_DETAILS.CARD_TEXT_PADDING_X);
      addText(`+${card.counter}`, { fontSize: SIZES.FONT_COUNTER, fill: '#ffff00', fontWeight: 'bold', stroke: 'black', strokeThickness: 4 }, xOffset, 0, -Math.PI / 2);
    }

    // パワー
    if (card?.power !== undefined && !isResource) {
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

    // ★重要: カード名テキストの制御
    if (!imageUrl) {
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
    }

  } else {
    // 裏面テキスト
    if (!imageUrl) {
      addText(GAME_UI_CONFIG.TEXT.BACK_SIDE, { fontSize: SIZES.FONT_BACK, fontWeight: 'bold', fill: COLORS.TEXT_LIGHT, align: 'center' }, 0, 0, 'screen');
    }
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