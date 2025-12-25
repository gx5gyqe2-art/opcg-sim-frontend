import { LAYOUT } from '../constants/layout';

export interface LayoutCoords {
  CH: number;
  CW: number;
  V_GAP: number;
  Y_CTRL_START: number;
  getFieldX: (index: number, width: number, cardW: number) => number;
  getHandX: (index: number, width: number, cardW: number) => number;
  getLeaderX: (width: number) => number;
  getLifeX: (width: number) => number;
  getY: (rowIdx: number, cardHeight: number, gap: number) => number;
}

export const calculateCardSize = (W: number, H: number) => {
  const AVAIL_H_HALF = (H - LAYOUT.H_CTRL - LAYOUT.MARGIN_TOP - LAYOUT.MARGIN_BOTTOM) / 2;
  // Step 1 最適化: 1列に最大7枚、高さは4.2分割
  const CH = Math.min(AVAIL_H_HALF / 4.2, (W / 7) * 1.4);
  const CW = CH / 1.4;
  const V_GAP = CH * 0.1;
  return { CH, CW, V_GAP, AVAIL_H_HALF };
};

export const calculateCoordinates = (W: number, H: number): LayoutCoords => {
  const { CH, CW, V_GAP } = calculateCardSize(W, H);
  const Y_CTRL_START = LAYOUT.MARGIN_TOP + ((H - LAYOUT.H_CTRL - LAYOUT.MARGIN_TOP - LAYOUT.MARGIN_BOTTOM) / 2);

  return {
    CH,
    CW,
    V_GAP,
    Y_CTRL_START,
    getLeaderX: (width: number) => width * 0.43,
    getLifeX: (width: number) => width * 0.15,
    getFieldX: (i: number, width: number, cardW: number) => (width * 0.15) + (i * cardW * 1.15),
    getHandX: (i: number, width: number, cardW: number) => (width * 0.1) + (i * cardW * 0.75),
    getY: (rowIdx: number, cardHeight: number, gap: number) => (rowIdx - 0.5) * (cardHeight + gap),
  };
};
