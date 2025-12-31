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
  // レスト時は90度回転 (時計回り)
  // PixiJSの回転: +は時計回り。
  // 座標系: 0度(上が-y, 右が+x) -> 90度(上が+x, 右が+y)
  if (isRest) {
    container.rotation = Math.PI / 2;
  }

  // --- 2. カード背景の描画 ---
  const g = new PIXI.Graphics();
  g.lineStyle(2, COLORS.ZONE_BORDER);
  g.beginFill(isBack ? COLORS.CARD_BACK : COLORS.ZONE_FILL);
  // 中心をアンカーにして描画 (-cw/2, -ch/2 から開始)
  g.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, 6);
  g.endFill();
  container.addChild(g);

  // --- 3. テキスト描画ヘルパー ---
  // x, y: ローカル座標（カードの中心が 0,0）
  // textRot: テキスト自体の追加回転（基本はコンテナの逆回転で正位置に戻す）
  const addText = (content: string, style: any, x: number, y: number, customRotation: number = 0) => {
    const txt = new PIXI.Text(content, style);
    const maxWidth = isRest ? ch * 1.1 : cw * 1.1; // 横向きなら高さが幅になるため

    if (txt.width > maxWidth) {
      let fullText = content;
      while (txt.width > maxWidth && fullText.length > 0) {
        fullText = fullText.slice(0, -1);
        txt.text = fullText + "...";
      }
    }

    txt.anchor.set(0.5);
    txt.position.set(x, y);
    
    // コンテナが回転している分、逆回転させて文字を水平にする
    // isRest (90deg) -> text (-90deg)
    const baseRotation = isRest ? -Math.PI / 2 : 0;
    txt.rotation = baseRotation + customRotation;
    
    container.addChild(txt);
  };

  // --- 4. コンテンツ配置ロジック ---
  if (!isBack) {
    const cardName = card?.name || "";
    const isResource = ['DON!!', 'Trash', 'Deck', 'Don!!', 'Life', 'Stage'].includes(cardName);

    // ■ コスト (左上)
    if (card?.cost !== undefined) {
      // 常にカードの左上に固定（物理的なカードの位置に合わせる）
      const cx = -cw / 2 + 10;
      const cy = -ch / 2 + 10;
      const costBadge = new PIXI.Graphics().beginFill(0x2c3e50, 0.9).drawCircle(cx, cy, 9).endFill();
      container.addChild(costBadge);
      addText(`${card.cost}`, { fontSize: 10, fill: 0xFFFFFF, fontWeight: 'bold' }, cx, cy);
    }

    // ■ カウンター (左端) -> レスト時は画面上側に来る
    if (card?.counter !== undefined && card.counter > 0) {
      // アクティブ: 左端(-cw/2)の中央
      // レスト: 左端は「画面上」になる
      const ctx = -cw / 2 + 6;
      const cty = 0; 
      
      // カウンター数値は縦書きっぽく -90度回転させるのが通例だが、
      // レスト時はカード自体が90度回るので、相対0度(画面向き-90度)にすると画面に対して垂直になる
      // ここでは「常にカードの長辺に沿う」ように配置
      addText(`+${card.counter}`, { fontSize: 9, fill: 0xe67e22, fontWeight: 'bold' }, ctx, cty, -Math.PI / 2);
    }

    // ■ パワー (上部)
    if (card?.power !== undefined && !isResource) {
      if (isRest) {
        // レスト時: 画面上側（カードの左辺）に表示して見やすくする
        // ローカル座標で (-cw/2 + offset, 0) 付近
        // ただしカウンターと被らないように少し右(ローカルy+)にずらすか、
        // あるいはカード上辺(ローカルy-)すなわち画面右側に置くか。
        // 一般的にはカードの上部(画面右)のままが見やすい。
        const posY = -ch / 2 - 12; // カード上辺の外側
        addText(`${card.power}`, { fontSize: 11, fill: COLORS.TEXT_POWER, fontWeight: 'bold' }, 0, posY);
      } else {
        // アクティブ時: カード上辺の外側
        const posY = -ch / 2 - 12;
        addText(`${card.power}`, { fontSize: 11, fill: COLORS.TEXT_POWER, fontWeight: 'bold' }, 0, posY);
      }
    }

    // ■ 名前 (下部)
    const nameStyle = { 
      fontSize: isResource ? 11 : 9, 
      fontWeight: 'bold', 
      fill: isResource ? COLORS.TEXT_RESOURCE : COLORS.TEXT_DEFAULT 
    };

    if (isResource) {
      addText(cardName, nameStyle, 0, 0);
    } else {
      if (isRest) {
        // レスト時: 画面下側（カードの右辺 = ローカル座標 x+）に表示
        // これにより、カードが横になっても名前が一番下に表示される
        const posX = cw / 2 + 4; // カード右辺の外側
        const posY = 0; // 中心
        // ローカル座標 (w/2, 0) は回転後 (0, w/2) 即ち画面下になる
        // テキストは addText 内で -90度 されるので正位置になる
        
        // ※ただし addText の逆回転ロジックは (x,y) を中心に回るため、
        // 配置位置自体をローカル座標系で指定する必要がある。
        // コンテナ90度回転: Local(1, 0) -> Screen(0, 1) [下]
        addText(cardName, nameStyle, cw / 2 - 10, 0); // カードの内側右端に寄せる
      } else {
        // アクティブ時: カード下辺の外側
        const posY = ch / 2 + 4;
        addText(cardName, nameStyle, 0, posY);
      }
    }

    // ■ ドン!!付与 (中央)
    if (card?.attached_don > 0) {
      // ドンは常にカード中央付近に見やすく
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

  // ■ 重なり枚数バッジ (デッキ/トラッシュ等)
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
