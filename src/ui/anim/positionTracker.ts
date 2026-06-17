import * as PIXI from 'pixi.js';

export type PositionMap = Map<string, { x: number; y: number }>;

/**
 * ステージ上の全カードコンテナ（name=uuid が設定されたもの）の画面座標を採取する。
 * 演出レイヤの ghost 等は name を持たないため対象外。
 * カード移動グライド（前回位置→今回位置のトゥイーン）の起点に使う。
 */
export function snapshotPositions(app: PIXI.Application): PositionMap {
  const map: PositionMap = new Map();
  const walk = (c: PIXI.Container): void => {
    if (c.destroyed) return;
    if (typeof c.name === 'string' && c.name.length > 0 && !map.has(c.name)) {
      const p = c.getGlobalPosition();
      map.set(c.name, { x: p.x, y: p.y });
    }
    for (const k of c.children) {
      if (k instanceof PIXI.Container) walk(k);
    }
  };
  walk(app.stage);
  return map;
}
