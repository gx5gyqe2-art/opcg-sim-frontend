import { LAYOUT } from '../constants/layout';

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

  return {
    CH, CW, V_GAP, Y_CTRL_START,
    getLifeX: (width) => width * 0.15,
    getLeaderX: (width) => width * 0.43,
    getStageX: (width) => width * 0.65,
    getDeckX: (width) => width * 0.85,
    getDonDeckX: (width) => width * 0.15,
    getDonActiveX: (width) => width * 0.38,
    getDonRestX: (width) => width * 0.60,
    getTrashX: (width) => width * 0.85,
    
    // 修正: 左端の制限を撤廃し、単純なセンタリング + 視覚補正(20px) に変更
    getFieldX: (i, width, cardWidth, totalCards) => {
      const gap = 35;
      const totalW = totalCards * cardWidth + (totalCards - 1) * gap;
      // 単純な中央寄せ計算 + 視覚バランス調整
      const startX = (width - totalW) / 2 + 20; 
      return startX + i * (cardWidth + gap);
    },

    getHandX: (i, width) => width * 0.08 + (i * CW * 0.75),
    getY: (row, h, g) => {
      const offset = row === 1 ? 0.2 : (row - 0.55); 
      return offset * (h + g);
    },
  };
};
