import { LAYOUT } from './layout.constants';
import { LAYOUT_PARAMS } from './layout.config';

// ビルドエラー解消のため型定義(LayoutCoords)を再定義
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

export const calculateCoordinates = (W: number, H: number): LayoutCoords => {
  // 画面の有効な描画領域を計算
  const AVAIL_H_HALF = (H - LAYOUT.H_CTRL - LAYOUT.MARGIN_TOP - LAYOUT.MARGIN_BOTTOM) / 2;
  
  // 画像2のサイズ感を再現 (分母を小さくしてカードを大きくする)
  const CH = Math.min(AVAIL_H_HALF / 3.5, (W / 6.0) * 1.4); 
  const CW = CH / 1.4;
  const V_GAP = CH * 0.20;
  const Y_CTRL_START = LAYOUT.MARGIN_TOP + AVAIL_H_HALF;

  const P = LAYOUT_PARAMS;

  return {
    CH, CW, V_GAP, Y_CTRL_START,
    getLifeX: (width) => width * P.X_RATIOS.LIFE,
    getLeaderX: (width) => width * P.X_RATIOS.LEADER,
    getStageX: (width) => width * P.X_RATIOS.STAGE,
    getDeckX: (width) => width * P.X_RATIOS.DECK,
    getDonDeckX: (width) => width * P.X_RATIOS.DON_DECK,
    getDonActiveX: (width) => width * P.X_RATIOS.DON_ACTIVE,
    getDonRestX: (width) => width * P.X_RATIOS.DON_REST,
    getTrashX: (width) => width * P.X_RATIOS.TRASH,
    
    getFieldX: (i, width, cardWidth, totalCards) => {
      const gap = 15; // 画像2に近い密度へ
      const totalW = totalCards * cardWidth + (totalCards - 1) * gap;
      const startX = (width - totalW) / 2; 
      return startX + i * (cardWidth + gap);
    },

    getHandX: (i, width) => width * 0.1 + (i * CW * 0.8),
    
    // Y座標計算を H 基準から midPoint 基準に変更 (以前の正常な配置を再現)
    getY: (row, h, _g) => {
      const midPoint = h / 2;
      switch(row) {
        case -1: return midPoint - (CH * 2.5); // 相手の手札
        case 0:  return midPoint - (CH * 1.2); // 相手の場
        case 1:  return midPoint + (CH * 0.2); // 自分の場
        case 2:  return midPoint + (CH * 1.5); // 自分の手札
        default: return midPoint;
      }
    },
  };
};
