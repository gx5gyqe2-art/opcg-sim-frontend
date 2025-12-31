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
  // トラッシュなどの枠線が見えるように alpha 1.0, 色を調整
  // ZONE_BORDER が薄すぎる場合は少し濃くする対応が必要かもしれませんが、
  // ここでは標準の定数を使用しつつ、描画ロジックを確実にします。
  g.lineStyle(2, COLORS.ZONE_BORDER, 1); 
  g.beginFill(isBack ? COLORS.CARD_BACK : COLORS.ZONE_FILL);
  g.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, 6);
  g.endFill();
  container.addChild(g);

  // --- 3. テキスト描画ヘルパー ---
  const addText = (content: string, style: any, x: number, y: number, rotationMode: 'screen' | 'card' | number = 'screen') => {
    // リソース名などの長いテキスト用にフォントサイズを動的調整
    let fontSize = style.fontSize;
    // リソースカードの場合は枠内に収めるための調整
    const isResource = ['DON!!', 'Trash', 'Deck', 'Don!!', 'Life', 'Stage', 'Don!! Active', 'Don!! Rest', 'Don!! Deck'].some(r => content.includes(r));
    
    // 基本のテキストオブジェクト作成（幅計測用）
    let txt = new PIXI.Text(content, { ...style, fontSize });
    
    const maxWidth = isRest ? ch * 0.9 : cw * 0.9; // 枠内に収めるためマージンをとる

    // 幅が溢れる場合はフォントサイズを小さくする
    if (isResource) {
      while (txt.width > maxWidth && fontSize > 6) {
        fontSize -= 1;
        txt.style.fontSize = fontSize;
      }
    }

    // それでも溢れる場合は文字を詰める
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
    // Resource判定を少し広げる
    const isResource = ['DON!!', 'Trash', 'Deck', 'Don!!', 'Life', 'Stage'].some(r => cardName.includes(r));

    // ■ コスト (左上)
    if (card?.cost !== undefined) {
      const cx = -cw / 2 + 10;
      const cy = -ch / 2 + 10;
      const costBadge = new PIXI.Graphics().beginFill(0x2c3e50, 0.9).drawCircle(cx, cy, 9).endFill();
      container.addChild(costBadge);
      addText(`${card.cost}`, { fontSize: 10, fill: 0xFFFFFF, fontWeight: 'bold' }, cx, cy, 'screen');
    }

    // ■ カウンター (左辺中央)
    if (card?.counter !== undefined && card.counter > 0) {
      const ctx = -cw / 2 + 6;
      const cty = 0; 
      addText(`+${card.counter}`, { fontSize: 9, fill: 0xe67e22, fontWeight: 'bold' }, ctx, cty, -Math.PI / 2);
    }

    // ■ パワー (上辺中央)
    if (card?.power !== undefined && !isResource) {
      if (isRest) {
        const posX = -cw / 2 - 12;
        const posY = 0;
        addText(`${card.power}`, { fontSize: 11, fill: COLORS.TEXT_POWER, fontWeight: 'bold' }, posX, posY, 'screen');
      } else {
        const posY = -ch / 2 - 12;
        addText(`${card.power}`, { fontSize: 11, fill: COLORS.TEXT_POWER, fontWeight: 'bold' }, 0, posY, 'screen');
      }
    }

    // ■ 名前 (下辺中央 or 中央)
    const nameStyle = { 
      fontSize: isResource ? 12 : 9, 
      fontWeight: 'bold', 
      fill: isResource ? COLORS.TEXT_RESOURCE : COLORS.TEXT_DEFAULT,
      align: 'center',
      wordWrap: isResource, // リソース名は折り返しも検討
      wordWrapWidth: cw * 0.9
    };

    if (isResource) {
      // リソース名は常にカード中央、回転はScreen基準
      addText(cardName, nameStyle, 0, 0, 'screen');
    } else {
      if (isRest) {
        const posX = cw / 2 + 4;
        addText(cardName, nameStyle, posX, 0, 'screen'); 
      } else {
        const posY = ch / 2 + 4;
        addText(cardName, nameStyle, 0, posY, 'screen');
      }
    }

    // ■ ドン!!付与 (中央)
    if (card?.attached_don > 0) {
      const bx = isOpponent ? (-cw / 2 + 8) : (cw / 2 - 8);
      const by = isOpponent ? (ch / 2 - 8) : (-ch / 2 + 8);
      const donBadge = new PIXI.Graphics().beginFill(0x9370DB, 0.9).drawCircle(bx, by, 10).endFill();
      container.addChild(donBadge);
      addText(`+${card.attached_don}`, { fontSize: 10, fill: 0xFFFFFF, fontWeight: 'bold' }, bx, by, 'screen');
    }

  } else {
    // 裏面
    addText("ONE\nPIECE", { fontSize: 8, fontWeight: 'bold', fill: 0xFFFFFF, align: 'center' }, 0, 0, 'screen');
  }

  // ■ 重なり枚数バッジ
  // count が undefined でなければ 0 でも表示するように変更
  if (options.count !== undefined) {
    // 0の場合は少し色を変えるなどの調整も可能ですが、一旦表示します
    // 通常カード（キャラなど）の重ね枚数は0なら表示しないほうが自然なので、
    // isResource判定を入れるか、options側で制御します。
    // BoardSide側では常にcountを渡しているため、リソース系は0でも出るようになります。
    // 手札やフィールドのカードは count を渡していない（undefined）ので影響しません。
    
    const bx = isOpponent ? (-cw / 2 + 10) : (cw / 2 - 10);
    const by = isOpponent ? (-ch / 2 + 10) : (ch / 2 - 10);
    const badgeColor = options.count > 0 ? COLORS.BADGE_BG : 0x95a5a6; // 0枚ならグレー
    const badge = new PIXI.Graphics().beginFill(badgeColor, 0.8).drawCircle(bx, by, 12).endFill();
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
