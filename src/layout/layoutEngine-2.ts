import { LAYOUT } from './layout.constants';
import { LAYOUT_PARAMS } from './layout.config'; // パラメータを読み込み

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
  
  const CH = Math.min(AVAIL_H_HALF / 5.2, (W / 8.5) * 1.4); 
  const CW = CH / 1.4;
  const V_GAP = CH * 0.30;
  const Y_CTRL_START = LAYOUT.MARGIN_TOP + AVAIL_H_HALF;

  const P = LAYOUT_PARAMS; // 短縮参照用

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
      const totalW = totalCards * cardWidth + (totalCards - 1) * P.FIELD.GAP;
      const startX = (width - totalW) / 2 + P.FIELD.X_OFFSET; 
      return startX + i * (cardWidth + P.FIELD.GAP);
    },

    getHandX: (i, width) => width * P.HAND.X_START_RATIO + (i * CW * P.HAND.OVERLAP_RATIO),
    getY: (row, h, g) => {
      const offset = row === 1 ? P.ROWS.ROW1_Y_OFFSET : (row - P.ROWS.DEFAULT_MULTIPLIER); 
      return offset * (h + g);
    },
  };
};
