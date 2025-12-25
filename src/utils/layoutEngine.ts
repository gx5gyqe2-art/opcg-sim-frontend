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
  getFieldX: (i: number, width: number) => number;
  getHandX: (i: number, width: number) => number;
  getY: (row: number, h: number, g: number) => number;
}

export const calculateCoordinates = (W: number, H: number): LayoutCoords => {
  const AVAIL_H_HALF = (H - LAYOUT.H_CTRL - LAYOUT.MARGIN_TOP - LAYOUT.MARGIN_BOTTOM) / 2;
  const CH = Math.min(AVAIL_H_HALF / 4.5, (W / 7.5) * 1.4); 
  const CW = CH / 1.4;
  
  // V_GAP を大幅に広げてテキストの重なりを防ぐ
  const V_GAP = CH * 0.45;
  
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
    getFieldX: (i, width) => width * 0.15 + (i * CW * 1.2),
    getHandX: (i, width) => width * 0.08 + (i * CW * 0.75),
    
    // Row 1 (戦場) を中央線に寄せるための調整
    getY: (row, h, g) => {
      // Row 1 の場合、開始位置を詰める (0.5 -> 0.2)
      const offset = row === 1 ? 0.2 : (row - 0.5);
      return offset * (h + g);
    },
  };
};
