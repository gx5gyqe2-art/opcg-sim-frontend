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
  getY: (row: number, ch: number, gap: number) => number;
}

export const calculateCoordinates = (W: number, H: number): LayoutCoords => {
  const AVAIL_H_HALF = (H - LAYOUT.H_CTRL - LAYOUT.MARGIN_TOP - LAYOUT.MARGIN_BOTTOM) / 2;
  
  // 過去の正常なサイズ感（倍率 3.8）を再現
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
      const gap = 12; // 以前の密度
      const totalW = totalCards * cardWidth + (totalCards - 1) * gap;
      return (width - totalW) / 2 + i * (cardWidth + gap);
    },

    // 過去の重なり具合（0.75倍）を再現
    getHandX: (i, width) => width * 0.08 + (i * CW * 0.75),

    // 行(Row)の計算: 中央(midPoint)から外側に向かって配置
    getY: (row, ch, gap) => {
      const step = ch + gap;
      // 1: Field, 2: Leader/Life, 3: Don/Trash, 4: Hand
      return (row - 0.5) * step + gap;
    },
  };
};
