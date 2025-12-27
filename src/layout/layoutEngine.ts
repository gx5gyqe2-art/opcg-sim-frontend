import { LAYOUT } from './layout.constants';
import { LAYOUT_PARAMS } from './layout.config';

/**
 * レイアウト座標のインターフェース定義
 * ビルドエラー解消のため、必要な型をすべて定義しています。
 */
export interface LayoutCoords {
  CH: number;
  CW: number;
  V_GAP: number;
  Y_CTRL_START: number;
  getLifeX: (width: number) => number;
  getLeaderX: (width: number) => number;
  getStageX: (width: number) => number;
  getDeckX: (width: number) => number;
  getDonDeckX: (width: number) => number;
  getDonActiveX: (width: number) => number;
  getDonRestX: (width: number) => number;
  getTrashX: (width: number) => number;
  getFieldX: (i: number, width: number, cardWidth: number, totalCards: number) => number;
  getHandX: (i: number, width: number) => number;
  getY: (row: number, h: number, g: number) => number;
}

/**
 * 画面サイズに基づきカードの配置座標を計算するエンジン
 */
export const calculateCoordinates = (W: number, H: number): LayoutCoords => {
  // 有効な描画領域（コントロールパネルやマージンを除いた高さの半分）
  const AVAIL_H_HALF = (H - LAYOUT.H_CTRL - LAYOUT.MARGIN_TOP - LAYOUT.MARGIN_BOTTOM) / 2;
  
  // カードサイズ計算: 以前の正常なサイズ感（3.5倍率）を適用
  const CH = Math.min(AVAIL_H_HALF / 3.5, (W / 6.0) * 1.4); 
  const CW = CH / 1.4;
  const V_GAP = CH * 0.20;
  const Y_CTRL_START = LAYOUT.MARGIN_TOP + AVAIL_H_HALF;

  const P = LAYOUT_PARAMS;

  return {
    CH, CW, V_GAP, Y_CTRL_START,
    
    // 各ゾーンの横位置（layout.config.ts の比率を使用）
    getLifeX: (width) => width * P.X_RATIOS.LIFE,
    getLeaderX: (width) => width * P.X_RATIOS.LEADER,
    getStageX: (width) => width * P.X_RATIOS.STAGE,
    getDeckX: (width) => width * P.X_RATIOS.DECK,
    getDonDeckX: (width) => width * P.X_RATIOS.DON_DECK,
    getDonActiveX: (width) => width * P.X_RATIOS.DON_ACTIVE,
    getDonRestX: (width) => width * P.X_RATIOS.DON_REST,
    getTrashX: (width) => width * P.X_RATIOS.TRASH,
    
    // フィールド上のカード配置（中央寄せ）
    getFieldX: (i, width, cardWidth, totalCards) => {
      const gap = 15; 
      const totalW = totalCards * cardWidth + (totalCards - 1) * gap;
      const startX = (width - totalW) / 2; 
      return startX + i * (cardWidth + gap);
    },

    // 手札の配置: 開始位置を中央寄りにし、重なり幅を調整
    getHandX: (i, width) => width * 0.12 + (i * CW * 0.65),

    /**
     * 縦方向の座標計算
     * 画面中央 (midPoint) を基準に、画像2のバランスを再現
     */
    getY: (row, h, _g) => {
      const midPoint = h / 2;
      switch(row) {
        case -1: return midPoint - (CH * 2.1); // 相手の手札（画面内に収まるよう調整）
        case 0:  return midPoint - (CH * 0.9); // 相手の場
        case 1:  return midPoint + (CH * 0.9); // 自分の場
        case 2:  return midPoint + (CH * 2.1); // 自分の手札
        default: return midPoint;
      }
    },
  };
};
