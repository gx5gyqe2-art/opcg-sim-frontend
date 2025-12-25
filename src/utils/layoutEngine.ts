import { LAYOUT } from '../constants/layout';

export interface LayoutCoords {
  CH: number;
  CW: number;
  V_GAP: number;
  Y_CTRL_START: number;
  getLifeX: (width: number) => number;
  getLeaderX: (width: number) => number;
  getStageX: (width: number) => number;
  getTrashX: (width: number) => number;
  getFieldX: (i: number, width: number) => number;
  getHandX: (i: number, width: number) => number;
  getY: (row: number, h: number, g: number) => number;
}

export const calculateCoordinates = (W: number, H: number): LayoutCoords => {
  const AVAIL_H_HALF = (H - LAYOUT.H_CTRL - LAYOUT.MARGIN_TOP - LAYOUT.MARGIN_BOTTOM) / 2;
  // Step 1 のボリューム感に合わせて調整
  const CH = Math.min(AVAIL_H_HALF / 4.5, (W / 7.5) * 1.4); 
  const CW = CH / 1.4;
  const V_GAP = CH * 0.15;
  const Y_CTRL_START = LAYOUT.MARGIN_TOP + AVAIL_H_HALF;

  return {
    CH, CW, V_GAP, Y_CTRL_START,
    // X座標：Step 1 固定比率
    getLifeX: (width: number) => width * 0.15,
    getLeaderX: (width: number) => width * 0.43,
    getStageX: (width: number) => width * 0.57,
    getTrashX: (width: number) => width * 0.85,
    getFieldX: (i: number, width: number) => width * 0.15 + (i * CW * 1.2),
    getHandX: (i: number, width: number) => width * 0.08 + (i * CW * 0.75),
    // Y座標：1=キャラ, 2=リーダー/ライフ, 4=手札
    getY: (row: number, h: number, g: number) => (row - 0.5) * (h + g),
  };
};
