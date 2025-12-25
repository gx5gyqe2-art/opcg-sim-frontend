import { LAYOUT } from '../constants/layout';

export interface LayoutCoords {
  CH: number;
  CW: number;
  V_GAP: number;
  Y_CTRL_START: number;
  getFieldX: (index: number, width: number) => number;
  getHandX: (index: number, width: number) => number;
  getLeaderX: (width: number) => number;
  getLifeX: (width: number) => number;
  getY: (rowIdx: number, cardHeight: number, gap: number) => number;
}

export const calculateCardSize = (W: number, H: number) => {
  const AVAIL_H_HALF = (H - LAYOUT.H_CTRL - LAYOUT.MARGIN_TOP - LAYOUT.MARGIN_BOTTOM) / 2;
  // Step 1: 1列最大7枚、高さ4.2分割
  const CH = Math.min(AVAIL_H_HALF / 4.2, (W / 7) * 1.4);
  const CW = CH / 1.4;
  const V_GAP = CH * 0.1;
  return { CH, CW, V_GAP };
};

export const calculateCoordinates = (W: number, H: number): LayoutCoords => {
  const { CH, CW, V_GAP } = calculateCardSize(W, H);
  const Y_CTRL_START = LAYOUT.MARGIN_TOP + ((H - LAYOUT.H_CTRL - LAYOUT.MARGIN_TOP - LAYOUT.MARGIN_BOTTOM) / 2);

  return {
    CH,
    CW,
    V_GAP,
    Y_CTRL_START,
    // Step 1 黄金比率の復元
    getLeaderX: (width) => width * 0.43,
    getLifeX: (width) => width * 0.15,
    getFieldX: (i, width) => width * 0.15 + (i * CW * 1.2),
    getHandX: (i, width) => width * 0.1 + (i * CW * 0.7),
    getY: (rowIdx, cardHeight, gap) => (rowIdx - 0.5) * (cardHeight + gap),
  };
};
