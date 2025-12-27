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
  
  // 【過去ソース完全準拠】
  // 過去のコードでは分母が 5.2 でした。これにより画像2/画像6の適正サイズになります。
  const CH = Math.min(AVAIL_H_HALF / 5.2, (W / 8.5) * 1.4); 
  const CW = CH / 1.4;
  const V_GAP = CH * 0.30;
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
      const gap = 35; // 過去ソースの値
      const totalW = totalCards * cardWidth + (totalCards - 1) * gap;
      // 過去ソースの「センタリング + 視覚補正(20px)」を再現
      const startX = (width - totalW) / 2 + 20; 
      return startX + i * (cardWidth + gap);
    },

    // 過去ソースの重なり具合を再現
    getHandX: (i, width) => width * 0.08 + (i * CW * 0.75),

    /**
     * 【重要】getY の修正
     * 現在の renderSide は中央から「外側」へ row 1, 2, 3, 4 と描画します。
     * 過去の 8 列の密度を再現するため、間隔を調整します。
     */
    getY: (row, ch, gap) => {
      // 過去の getY (offset * (h+g)) のバランスに近づけるため、ch基準で配置
      const step = ch * 1.15; 
      return (row - 0.5) * step + gap;
    },
  };
};
