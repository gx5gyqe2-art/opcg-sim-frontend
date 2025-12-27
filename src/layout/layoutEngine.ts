// src/layout/layoutEngine.ts

export const calculateCoordinates = (W: number, H: number): LayoutCoords => {
  // AVAIL_H_HALF は有効な描画領域の半分
  const AVAIL_H_HALF = (H - LAYOUT.H_CTRL - LAYOUT.MARGIN_TOP - LAYOUT.MARGIN_BOTTOM) / 2;
  
  // 修正1: カードサイズを大きくする (5.2 -> 3.5 程度に調整して画像2のサイズ感へ)
  const CH = Math.min(AVAIL_H_HALF / 3.5, (W / 6.0) * 1.4); 
  const CW = CH / 1.4;
  const V_GAP = CH * 0.20; // 隙間を少し詰める
  const Y_CTRL_START = LAYOUT.MARGIN_TOP + AVAIL_H_HALF;

  return {
    CH, CW, V_GAP, Y_CTRL_START,
    // ... (各種 X 関数は維持)
    
    getFieldX: (i, width, cardWidth, totalCards) => {
      const gap = 15; // 隙間を調整
      const totalW = totalCards * cardWidth + (totalCards - 1) * gap;
      const startX = (width - totalW) / 2; 
      return startX + i * (cardWidth + gap);
    },

    getHandX: (i, width) => width * 0.1 + (i * CW * 0.8), // 重なり具合を調整

    // 修正2: 座標計算の基準を H ではなく AVAIL_H_HALF に基づく相対位置に変更
    getY: (row, h, g) => {
      const baseTop = LAYOUT.MARGIN_TOP;
      const midPoint = h / 2;

      // 画像2の配置を再現するための相対的な高さ計算
      switch(row) {
        case -1: return midPoint - (CH * 2.5); // 相手の手札
        case 0:  return midPoint - (CH * 1.2); // 相手の場
        case 1:  return midPoint + (CH * 0.2); // 自分の場
        case 2:  return midPoint + (CH * 1.5); // 自分の手札
        default: return midPoint;
      }
    },
  };
};
