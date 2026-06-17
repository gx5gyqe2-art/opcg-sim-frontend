import * as PIXI from 'pixi.js';
import type { VirtualZoneCard } from '../game/types';
import { LAYOUT_CONSTANTS, LAYOUT_PARAMS } from '../layout/layout.config';
import { GAME_UI_CONFIG } from '../game/game.config';
import { getCardImageUrl, getBackImageUrl } from '../utils/imageAssets';

const { COLORS, SIZES } = LAYOUT_CONSTANTS;
const { SHAPE, UI_DETAILS, PHYSICS } = LAYOUT_PARAMS;

// カード描画で使うテキストスタイル（config 由来の string fontWeight 等を許容する緩めの型）。
// PIXI.Text へ渡す際は ITextStyle としてキャストする。
type CardTextStyle = {
  fontSize?: number;
  fill?: string | number;
  fontWeight?: string;
  stroke?: string | number;
  strokeThickness?: number;
  align?: string;
  [key: string]: unknown;
};

export const createCardContainer = (
  card: VirtualZoneCard,
  cw: number,
  ch: number,
  options: { count?: number; onClick: (pos: { x: number; y: number }) => void; isOpponent?: boolean; isSelectable?: boolean; isSelected?: boolean }
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

  // リーダーカードのデバッグログ
  const isLeader = card?.type === 'LEADER' || card?.type === 'リーダー';

  // --- 画像URLの決定 ---
  let imageUrl: string | null = null;
  const cardName = card?.name || "";

  if (!isEmpty) {
    if (cardName === 'Don!! Deck') {
      imageUrl = getBackImageUrl('DON');
    } else if (cardName === 'Deck' || cardName === 'Life') {
      imageUrl = getBackImageUrl('MAIN');
    } else if (isBack) {
      imageUrl = getBackImageUrl('MAIN');
    } else {
      const targetId = card?.card_id || card?.uuid || card?.id;
      if (targetId) {
        imageUrl = getCardImageUrl(targetId);
      }
    }
  }

  // --- 描画処理 ---
  if (isEmpty) {
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
    const fallbackUrl = getBackImageUrl('MAIN');
    const fallbackTexture = PIXI.Texture.from(fallbackUrl);
    const webglUrl = imageUrl + '?format=webgl'; 
    const targetTexture = PIXI.Texture.from(webglUrl);

    const initialTexture = targetTexture.valid ? targetTexture : fallbackTexture;
    const sprite = new PIXI.Sprite(initialTexture);
    
    sprite.width = cw;
    sprite.height = ch;
    sprite.anchor.set(0.5);

    if (!targetTexture.valid && imageUrl !== fallbackUrl) {
        const updateTexture = () => {
            if (!sprite.destroyed) {
                sprite.texture = targetTexture;
                sprite.width = cw;
                sprite.height = ch;
            }
        };
        targetTexture.baseTexture.on('update', updateTexture);
        targetTexture.baseTexture.on('loaded', updateTexture);
        // sprite破棄時に共有baseTextureからリスナーを解除し、蓄積（リーク）を防ぐ
        sprite.once('destroyed', () => {
            targetTexture.baseTexture.off('update', updateTexture);
            targetTexture.baseTexture.off('loaded', updateTexture);
        });
    }
    
    const mask = new PIXI.Graphics();
    mask.beginFill(0xFFFFFF);
    mask.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, SHAPE.CORNER_RADIUS_CARD);
    mask.endFill();
    sprite.mask = mask;
    
    container.addChild(sprite);
    container.addChild(mask);

    const border = new PIXI.Graphics();
    border.lineStyle(SHAPE.STROKE_WIDTH_ZONE, COLORS.ZONE_BORDER);
    border.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, SHAPE.CORNER_RADIUS_CARD);
    container.addChild(border);

  } else {
    const g = new PIXI.Graphics();
    g.lineStyle(SHAPE.STROKE_WIDTH_ZONE, COLORS.ZONE_BORDER);
    g.beginFill(isBack ? COLORS.CARD_BACK : COLORS.ZONE_FILL);
    g.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, SHAPE.CORNER_RADIUS_CARD);
    g.endFill();
    container.addChild(g);
  }

  if (isEmpty) return container;

  const addText = (content: string, style: CardTextStyle, x: number, y: number, rotationMode: 'screen' | 'card' | number = 'screen') => {
    const txt = new PIXI.Text(content, style as Partial<PIXI.ITextStyle>);
    if (!isBack && imageUrl && style.fill !== '#ffffff') {
      style.stroke = '#000000';
      style.strokeThickness = 3;
      txt.style = style as Partial<PIXI.ITextStyle>;
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

  // --- 情報表示 ---
  if (!isBack) {
    const isResource = ['Trash', 'Deck', 'Life'].includes(cardName) || cardName.startsWith('Don!!');
    
    // 1. コストバッジ (左上)
    let hasCost = false;
    if (card?.cost !== undefined && !isLeader && !isResource) {
      hasCost = true;
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

    // 2. パワー表示 (カードサイズ比率で自動計算)
    if (card?.power !== undefined && !isResource) {
      // --- サイズ・位置の計算 ---
      // 高さ: カード高さの約16%
      const boxHeight = ch * 0.16; 
      // 上マージン: カード高さの約5%
      const marginY = ch * 0.05;
      const boxY = -ch / 2 + marginY;

      // 左端位置 (コストバッジの右、なければ左端マージン)
      // コストバッジ半径等は定数参照だが、簡易的に cw の比率でマージンを取る
      const marginX = cw * 0.08; 
      const badgeSpace = hasCost ? (UI_DETAILS.CARD_BADGE_OFFSET + SHAPE.CORNER_RADIUS_BADGE * 2) : 0;
      
      const startX = -cw / 2 + marginX + (hasCost ? badgeSpace * 0.8 : 0);
      
      // 右端限界 (カード右端から5%内側)
      const limitX = cw / 2 - (cw * 0.05);
      
      // 幅を算出 (最大幅を使用)
      let boxWidth = limitX - startX;
      // 幅が極端に狭くなる場合(コストありでカードが細い等)の最低保証は考慮してもよいが
      // 基本レイアウトなら十分な幅になるはず
      if (boxWidth < cw * 0.3) boxWidth = cw * 0.3; // 最低でも3割確保

      // --- 描画 ---
      // 黒い背景ボックス
      const powerBox = new PIXI.Graphics()
        .beginFill(0x000000, 1)
        .drawRoundedRect(0, 0, boxWidth, boxHeight, 4)
        .endFill();
      powerBox.position.set(startX, boxY);
      container.addChild(powerBox);

      // パワー数値テキスト
      // フォントサイズもボックス高さに合わせて決定 (高さの80%程度)
      const baseFontSize = boxHeight * 0.85;
      
      const pText = new PIXI.Text(`${card.power}`, {
        fontSize: baseFontSize,
        fill: 0xFFFFFF,
        fontWeight: 'bold',
        fontFamily: 'Arial',
        align: 'center'
      });
      pText.anchor.set(0.5);
      pText.position.set(startX + boxWidth / 2, boxY + boxHeight / 2);
      pText.rotation = 0; 

      // --- 文字サイズの自動縮小 (Width Fit) ---
      const maxTextWidth = boxWidth * 0.9; // 左右マージン考慮
      if (pText.width > maxTextWidth) {
        const scale = maxTextWidth / pText.width;
        pText.scale.set(scale);
      }

      container.addChild(pText);
    }

    // 3. カウンター (右端中央)
    if (card?.counter !== undefined && card.counter > 0) {
      const xOffset = isOpponent ? (cw / 2 - UI_DETAILS.CARD_TEXT_PADDING_X) : (-cw / 2 + UI_DETAILS.CARD_TEXT_PADDING_X);
      addText(`+${card.counter}`, { fontSize: SIZES.FONT_COUNTER, fill: '#ffff00', fontWeight: 'bold', stroke: 'black', strokeThickness: 4 }, xOffset, 0, -Math.PI / 2);
    }

    // 4. ドン!!付与数 (右下)
    if ((card?.attached_don ?? 0) > 0) {
      const bx = isOpponent ? (-cw / 2 + UI_DETAILS.CARD_BADGE_DON_OFFSET) : (cw / 2 - UI_DETAILS.CARD_BADGE_DON_OFFSET);
      const by = isOpponent ? (-ch / 2 + UI_DETAILS.CARD_BADGE_DON_OFFSET) : (ch / 2 - UI_DETAILS.CARD_BADGE_DON_OFFSET);
      const donBadge = new PIXI.Graphics()
        .beginFill(COLORS.BADGE_DON_BG, 1)
        .lineStyle(1, 0xFFFFFF)
        .drawCircle(bx, by, SHAPE.CORNER_RADIUS_BADGE)
        .endFill();
      container.addChild(donBadge);
      addText(`+${card.attached_don}`, { fontSize: SIZES.FONT_DON, fill: COLORS.TEXT_LIGHT, fontWeight: 'bold' }, bx, by, 'screen');
    }

    // カード名テキスト (画像がない場合のみ)
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

  // --- 状態オーバーレイ (FREEZE / NEGATE) ---
  if (card?.is_frozen) {
    const overlay = new PIXI.Graphics();
    overlay.beginFill(COLORS.BADGE_FROZEN_BG, 0.3);
    overlay.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, SHAPE.CORNER_RADIUS_CARD);
    overlay.endFill();
    container.addChild(overlay);
    const labelY = card?.ability_disabled ? -ch * 0.12 : 0;
    addText('凍結', { fontSize: SIZES.FONT_COUNT, fill: COLORS.TEXT_LIGHT, fontWeight: 'bold' }, 0, labelY, 'screen');
  }

  if (card?.ability_disabled) {
    const overlay = new PIXI.Graphics();
    overlay.beginFill(COLORS.BADGE_NEGATE_BG, 0.3);
    overlay.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, SHAPE.CORNER_RADIUS_CARD);
    overlay.endFill();
    container.addChild(overlay);
    const labelY = card?.is_frozen ? ch * 0.12 : 0;
    addText('効果無効', { fontSize: SIZES.FONT_COUNT, fill: COLORS.TEXT_LIGHT, fontWeight: 'bold' }, 0, labelY, 'screen');
  }

  // 選択可能ハイライト: ゴールド枠線
  if (options.isSelectable) {
    const border = new PIXI.Graphics();
    border.lineStyle(3, COLORS.HIGHLIGHT_SELECTABLE, 1.0);
    border.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, SHAPE.CORNER_RADIUS_CARD);
    container.addChild(border);
  }

  // 選択済みオーバーレイ: 緑半透明 + チェックマーク
  if (options.isSelected) {
    const overlay = new PIXI.Graphics();
    overlay.beginFill(COLORS.HIGHLIGHT_SELECTED, 0.45);
    overlay.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, SHAPE.CORNER_RADIUS_CARD);
    overlay.endFill();
    container.addChild(overlay);
    addText('✓', { fontSize: 22, fill: 0xFFFFFF, fontWeight: 'bold' }, 0, 0, 'screen');
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
      // autoDensity + 全画面キャンバスのため e.global は CSS ピクセル座標と一致。
      // DOM オーバーレイ(ミニメニュー)の配置にそのまま渡せる。
      if (options.onClick) options.onClick({ x: e.global.x, y: e.global.y });
    }
  });

  return container;
};
