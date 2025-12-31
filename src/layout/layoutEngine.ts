import { logger } from '../utils/logger';
import { LAYOUT_CONSTANTS, LAYOUT_PARAMS } from './layout.config';

export interface LayoutCoords {
  CH: number;
  CW: number;
  V_GAP: number;
  midY: number; // 画面中央のY座標
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
  getY: (row: number) => number; 
}

export const calculateCoordinates = (W: number, H: number): LayoutCoords => {
  const { SIZES } = LAYOUT_CONSTANTS;
  const P = LAYOUT_PARAMS;
  
  // 画面中央（境界線）
  const midY = H / 2;

  // カード高さの計算: 画面半分に収まるように計算
  // 上下のマージンを考慮して、利用可能な高さを算出
  const availHeight = midY - SIZES.MARGIN_TOP - SIZES.MARGIN_BOTTOM;
  const chByHeight = availHeight / P.CARD.MAX_ROWS_IN_HALF;
  
  // 幅基準: (画面幅 / 横分割数) * スケール補正
  const chByWidth = (W / P.CARD.MAX_COLS_ON_SCREEN) * P.CARD.SCALE_ADJUST;
  
  const CH = Math.min(chByHeight, chByWidth); 
  const CW = CH / P.CARD.ASPECT_RATIO;
  const V_GAP = CH * P.SPACING.V_GAP_RATIO;
  
  const validateCoordinate = (val: number, label: string) => {
    if (isNaN(val)) {
      logger.warn('layout.calculation_anomaly', `NaN detected for ${label}`, { W, H });
      return 0;
    }
    return val;
  };

  return {
    CH, CW, V_GAP, midY,
    turnEndPos: {
      x: validateCoordinate(W - P.SPACING.TURN_END_BTN_X_OFFSET, 'turnEndPos.x'),
      // ボタンも境界線(midY)に合わせて配置
      y: validateCoordinate(midY, 'turnEndPos.y')
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
      // フィールドカードは中央揃え
      const totalW = totalCards * cardWidth + (totalCards - 1) * P.FIELD.GAP;
      const startX = (width - totalW) / 2 + P.FIELD.X_OFFSET; 
      return validateCoordinate(startX + i * (cardWidth + P.FIELD.GAP), `fieldX_${i}`);
    },
    // 手札X座標: スクロール前提なので、単純に並べる
    getHandX: (i, width) => {
      // P.HAND.X_START_RATIO を基準に開始
      const startX = width * P.HAND.X_START_RATIO;
      return validateCoordinate(startX + (i * CW * P.HAND.OVERLAP_RATIO), `handX_${i}`);
    },
    // Y座標計算: Row 1 (Field) を基準(0)として、下に向かって配置する相対座標を返す
    getY: (row) => {
      // Row 1: Field, Row 2: Leader/Life, Row 3: Don/Trash, Row 4: Hand
      // マージン + (行番号 - 1) * (カード高さ + ギャップ)
      const offset = (row - 1) * (CH + V_GAP) + SIZES.MARGIN_TOP;
      return validateCoordinate(offset, `y_row_${row}`);
    },
  };
};
