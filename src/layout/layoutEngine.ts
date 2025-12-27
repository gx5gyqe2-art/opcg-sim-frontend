import { LAYOUT } from './layout.constants';
import { LAYOUT_PARAMS } from './layout.config';

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
  const AVAIL_H_HALF = (H - LAYOUT.H_CTRL - LAYOUT.MARGIN_TOP - LAYOUT.MARGIN_BOTTOM) / 2;
  
  // カードサイズを画像2のバランスに合わせて調整
  const CH = Math.min(AVAIL_H_HALF / 3.8, (W / 6.5) * 1.4); 
  const CW = CH / 1.4;
  const V_GAP = CH * 0.15;
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
      const gap = 12; 
      const totalW = totalCards * cardWidth + (totalCards - 1) * gap;
      const startX = (width - totalW) / 2; 
      return startX + i * (cardWidth + gap);
    },

    // 修正: 重なり幅を CW * 1.1 に変更し、右に広げる
    getHandX: (i, width) => width * 0.10 + (i * CW * 1.1),

    /**
     * 行（row）の高さ調整
     * 画像4で見切れていた手札を少し上に上げ、間隔を画像2に近づける
     */
    getY: (row, h, _g) => {
      const midPoint = h / 2;
      switch(row) {
        case -1: return midPoint - (CH * 1.8); // 相手の手札
        case 0:  return midPoint - (CH * 0.7); // 相手の場
        case 1:  return midPoint + (CH * 0.7); // 自分の場
        case 2:  return midPoint + (CH * 1.8); // 自分の手札（476pxから少し上げます）
        default: return midPoint;
      }
    },
  };
};
