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
  
  // 1. カードサイズを縮小 (85%程度)
  // 高さ: 画面半分の 4.5分割 -> 5.2分割
  // 幅: 画面幅の 7.5分割 -> 8.5分割
  const CH = Math.min(AVAIL_H_HALF / 5.2, (W / 8.5) * 1.4); 
  const CW = CH / 1.4;
  
  // 2. 行間 (V_GAP) を広げてテキスト重複を防止
  // カードが小さくなった分、相対的なギャップ比率を上げてクリアランスを確保
  // 上下のテキスト領域 (約25px分) を吸収できる隙間を設定
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
    getFieldX: (i, width) => width * 0.15 + (i * CW * 1.2),
    getHandX: (i, width) => width * 0.08 + (i * CW * 0.75),
    
    // 3. 全体を画面内に収めるためのY座標オフセット調整
    // Row 1 (Field) を中央線に寄せつつ、全体のマージンバランスをとる
    getY: (row, h, g) => {
      const offset = row === 1 ? 0.2 : (row - 0.55); 
      return offset * (h + g);
    },
  };
};
