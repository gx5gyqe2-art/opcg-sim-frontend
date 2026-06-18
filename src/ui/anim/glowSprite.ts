import * as PIXI from 'pixi.js';
import { tween } from './tween';
import { LAYOUT_PARAMS } from '../../layout/layout.config';

const { SHAPE } = LAYOUT_PARAMS;

export interface GlowHandle {
  display: PIXI.Graphics;
  stop: () => void;
}

/**
 * 選択可能カード用の脈動グロー（従来の静的ゴールド枠の置換）。
 * 共有 ticker で alpha と線幅・スケールを周期変化させる。
 * カード破棄時に stop() を呼ぶこと（CardRenderer 側で container.once('destroyed') に接続）。
 */
export function createSelectableGlow(cw: number, ch: number, color: number): GlowHandle {
  const glow = new PIXI.Graphics();

  const draw = (lineWidth: number, alpha: number): void => {
    glow.clear();
    glow.lineStyle(lineWidth, color, alpha);
    glow.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, SHAPE.CORNER_RADIUS_CARD);
  };
  draw(3, 1);

  // 周期 ~1100ms、alpha 0.55..1.0 / 線幅 3..4.5 / スケール 1.0..1.05。
  const handle = tween({
    durationMs: 1100,
    repeat: true,
    onUpdate: (k) => {
      if (glow.destroyed) return;
      const s = (Math.sin(k * Math.PI * 2) + 1) / 2; // 0..1
      draw(3 + s * 1.5, 0.55 + s * 0.45);
      glow.scale.set(1 + s * 0.05);
    },
  });

  return { display: glow, stop: handle.cancel };
}
