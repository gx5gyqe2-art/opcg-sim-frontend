import { logger } from '../utils/logger';

export const calculateCoordinates = (W: number, H: number) => {
  const CW = W * 0.18;
  const CH = CW * 1.4;
  const V_GAP = H * 0.02;

  const validateCoordinate = (val: number, label: string) => {
    if (isNaN(val) || val < -W || val > W * 2 || val < -H || val > H * 2) {
      logger.warn('layout.calculation_anomaly', `Abnormal coordinate detected for ${label}: ${val}`, { W, H, value: val });
    }
    return val;
  };

  return {
    CW,
    CH,
    V_GAP,
    getFieldX: (idx: number, width: number, cardW: number, count: number) => {
      const gap = 10;
      const totalW = count * cardW + (count - 1) * gap;
      const startX = (width - totalW) / 2 + cardW / 2;
      return validateCoordinate(startX + idx * (cardW + gap), `fieldX_${idx}`);
    },
    getY: (row: number, cardH: number, gap: number) => {
      return validateCoordinate((row - 1) * (cardH + gap) + cardH / 2, `y_row_${row}`);
    },
    getLeaderX: (width: number) => validateCoordinate(width * 0.25, 'leaderX'),
    getLifeX: (width: number) => validateCoordinate(width * 0.5, 'lifeX'),
    getDeckX: (width: number) => validateCoordinate(width * 0.75, 'deckX'),
    getDonDeckX: (width: number) => validateCoordinate(width * 0.2, 'donDeckX'),
    getDonActiveX: (width: number) => validateCoordinate(width * 0.4, 'donActiveX'),
    getDonRestX: (width: number) => validateCoordinate(width * 0.6, 'donRestX'),
    getTrashX: (width: number) => validateCoordinate(width * 0.8, 'trashX'),
    getHandX: (idx: number, width: number) => {
      const startX = width * 0.1;
      const step = width * 0.15;
      return validateCoordinate(startX + idx * step, `handX_${idx}`);
    }
  };
};