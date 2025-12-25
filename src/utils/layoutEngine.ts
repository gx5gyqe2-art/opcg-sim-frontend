import { LAYOUT } from '../constants/layout';

export interface LayoutCoords {
  CH: number;
  CW: number;
  V_GAP: number;
  Y_CTRL_START: number;
  getFieldX: (index: number, width: number) => number;
  getHandX: (index: number, width: number) => number;
  getLeaderX: (width: number) => number;
  getY: (rowIdx: number, cardHeight: number, gap: number) => number;
}

/**
 * カードサイズを現在のロジック(Math.min)に基づき算出
 */
export const calculateCardSize = (W: number, H: number) => {
  const AVAIL_H_HALF = (H - LAYOUT.H_CTRL - LAYOUT.MARGIN_TOP - LAYOUT.MARGIN_BOTTOM) / 2;
  const CH = Math.min(AVAIL_H_HALF / 3.8, (W / 6) * 1.4);
  const CW = CH / 1.4;
  const V_GAP = CH * 0.15;
  return { CH, CW, V_GAP, AVAIL_H_HALF };
};

/**
 * 座標計算のロジックをまとめる
 */
export const calculateCoordinates = (W: number, H: number): LayoutCoords => {
  const { CH, CW, V_GAP } = calculateCardSize(W, H);
  const Y_CTRL_START = LAYOUT.MARGIN_TOP + ((H - LAYOUT.H_CTRL - LAYOUT.MARGIN_TOP - LAYOUT.MARGIN_BOTTOM) / 2);

  return {
    CH,
    CW,
    V_GAP,
    Y_CTRL_START,
    // getXのロジック (0.2 + i * 0.2)
    getFieldX: (i: number, width: number) => width * (0.2 + i * 0.2),
    // 手札用のgetX (0.1 + i * 0.15)
    getHandX: (i: number, width: number) => width * (0.1 + i * 0.15),
    // リーダー用のgetX (0.5)
    getLeaderX: (width: number) => width * 0.5,
    // getYのロジック
    getY: (rowIdx: number, cardHeight: number, gap: number) => (rowIdx - 0.5) * (cardHeight + gap),
  };
};
