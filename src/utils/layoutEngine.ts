import { LAYOUT } from '../constants/layout';

export interface LayoutCoords {
  CH: number;
  CW: number;
  V_GAP: number;
  Y_CTRL_START: number;
  getLifeX: (width: number) => number;
  getLeaderX: (width: number) => number;
  getStageX: (width: number) => number;
  getDeckX: (width: number) => number; // 追加
  getFieldX: (i: number, width: number) => number;
  getHandX: (i: number, width: number) => number;
  getY: (row: number, h: number, g: number) => number;
}

export const calculateCoordinates = (W: number, H: number): LayoutCoords => {
  const AVAIL_H_HALF = (H - LAYOUT.H_CTRL - LAYOUT.MARGIN_TOP - LAYOUT.MARGIN_BOTTOM) / 2;
  const CH = Math.min(AVAIL_H_HALF / 4.5, (W / 7.5) * 1.4); 
  const CW = CH / 1.4;
  const V_GAP = CH * 0.15;
  const Y_CTRL_START = LAYOUT.MARGIN_TOP + AVAIL_H_HALF;

  return {
    CH, CW, V_GAP, Y_CTRL_START,
    getLifeX: (width) => width * 0.15,
    getLeaderX: (width) => width * 0.43,
    getStageX: (width) => width * 0.57,
    getDeckX: (width) => width * 0.85, // 右端 (W * 0.85)
    getFieldX: (i, width) => width * 0.15 + (i * CW * 1.2),
    getHandX: (i, width) => width * 0.08 + (i * CW * 0.75),
    getY: (row, h, g) => (row - 0.5) * (h + g),
  };
};
