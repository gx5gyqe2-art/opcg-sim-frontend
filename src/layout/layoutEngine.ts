import { logger } from '../utils/logger';
import { LAYOUT_CONSTANTS, LAYOUT_PARAMS } from './layout.config';

export interface LayoutCoords {
  CH: number;
  CW: number;
  V_GAP: number;
  Y_CTRL_START: number;
  turnEndPos: { x: number; y: number };
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
  const { SIZES } = LAYOUT_CONSTANTS;
  const P = LAYOUT_PARAMS;
  
  const AVAIL_H_HALF = (H - SIZES.H_CTRL - SIZES.MARGIN_TOP - SIZES.MARGIN_BOTTOM) / 2;
  const CH = Math.min(AVAIL_H_HALF / 5.2, (W / 8.5) * 1.4); 
  const CW = CH / 1.4;
  const V_GAP = CH * 0.30;
  const Y_CTRL_START = SIZES.MARGIN_TOP + AVAIL_H_HALF;

  const validateCoordinate = (val: number, label: string) => {
    if (isNaN(val) || val < -W || val > W * 2 || val < -H || val > H * 2) {
      logger.warn('layout.calculation_anomaly', `Abnormal coordinate detected for ${label}`, { W, H, value: val });
    }
    return val;
  };

  return {
    CH, CW, V_GAP, Y_CTRL_START,
    turnEndPos: {
      x: validateCoordinate(W - 100, 'turnEndPos.x'),
      y: validateCoordinate(H / 2, 'turnEndPos.y')
    },
    getLifeX: (width) => validateCoordinate(width * P.X_RATIOS.LIFE, 'lifeX'),
    getLeaderX: (width) => validateCoordinate(width * P.X_RATIOS.LEADER, 'leaderX'),
    getStageX: (width) => validateCoordinate(width * P.X_RATIOS.STAGE, 'stageX'),
    getDeckX: (width) => validateCoordinate(width * P.X_RATIOS.DECK, 'deckX'),
    getDonDeckX: (width) => validateCoordinate(width * P.X_RATIOS.DON_DECK, 'donDeckX'),
    getDonActiveX: (width) => validateCoordinate(width * P.X_RATIOS.DON_ACTIVE, 'donActiveX'),
    getDonRestX: (width) => validateCoordinate(width * P.X_RATIOS.DON_REST, 'donRestX'),
    getTrashX: (width) => validateCoordinate(width * P.X_RATIOS.TRASH, 'trashX'),
    getFieldX: (i, width, cardWidth, totalCards) => {
      const totalW = totalCards * cardWidth + (totalCards - 1) * P.FIELD.GAP;
      const startX = (width - totalW) / 2 + P.FIELD.X_OFFSET; 
      return validateCoordinate(startX + i * (cardWidth + P.FIELD.GAP), `fieldX_${i}`);
    },
    getHandX: (i, width) => validateCoordinate(width * P.HAND.X_START_RATIO + (i * CW * P.HAND.OVERLAP_RATIO), `handX_${i}`),
    getY: (row, h, g) => {
      const offset = row === 1 ? P.ROWS.ROW1_Y_OFFSET : (row - P.ROWS.DEFAULT_MULTIPLIER); 
      return validateCoordinate(offset * (h + g), `y_row_${row}`);
    },
  };
};
