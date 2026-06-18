import * as PIXI from 'pixi.js';
import { createCardContainer, drawCardVisuals, type CardContainer } from '../CardRenderer';
import type { MovableDescriptor } from '../BoardSide';
import { tween, easeOutCubic } from './tween';

// 可動実カード（field/leader/stage/life/hand）の永続レイヤを保持し、
// 毎 render で uuid 突合により**同じコンテナを使い回す**（Phase4）。
// 固定パイル等は呼び出し側で従来どおり破棄→再構築する。

export interface BoardReconciler {
  layer: PIXI.Container; // stage に載せる（renderScene が破棄ループ前に退避→末尾で再アタッチ）
  reconcile: (
    top: MovableDescriptor[],
    bottom: MovableDescriptor[],
    midY: number,
    viewerFlipped: boolean,
  ) => void;
}

export function createBoardReconciler(): BoardReconciler {
  const layer = new PIXI.Container();
  // 上下のサイドサブコンテナ（top.y=0 / bottom.y=midY）。
  // 「グローバル差分＝ローカル差分」を保つため平行移動のみ。
  const topSub = new PIXI.Container();
  const bottomSub = new PIXI.Container();
  layer.addChild(topSub, bottomSub);

  const live = new Map<string, CardContainer>();

  const applyDesc = (c: CardContainer, d: MovableDescriptor, parent: PIXI.Container): void => {
    // inner を最新カードで再描画（古い表示を残さない）。
    drawCardVisuals(c, d.card, d.cw, d.ch, d.opts);
    c.eventMode = d.interactive ? 'static' : 'none';
    c.cursor = d.interactive ? 'pointer' : 'default';
    if (c.parent !== parent) parent.addChild(c); // 別サイドへ移動（viewer 反転等）
    c.x = d.x;
    c.y = d.y;
  };

  const animateExit = (c: CardContainer): void => {
    // snapshotPositions（name=uuid で走査）から除外し、glide と干渉させない。
    c.name = '';
    const by = c.y;
    const sx = c.scale.x;
    const sy = c.scale.y;
    tween({
      durationMs: 320,
      ease: easeOutCubic,
      onUpdate: (k) => {
        if (c.destroyed) return;
        c.alpha = 1 - k;
        c.y = by - 14 * k;
        c.scale.set(sx * (1 - 0.1 * k), sy * (1 - 0.1 * k));
      },
      onComplete: () => {
        if (!c.destroyed) c.destroy({ children: true });
      },
    });
  };

  const reconcile = (
    top: MovableDescriptor[],
    bottom: MovableDescriptor[],
    midY: number,
    viewerFlipped: boolean,
  ): void => {
    topSub.y = 0;
    bottomSub.y = midY;

    const desired = new Map<string, { d: MovableDescriptor; sub: PIXI.Container }>();
    for (const d of top) desired.set(d.uuid, { d, sub: topSub });
    for (const d of bottom) desired.set(d.uuid, { d, sub: bottomSub });

    // 退場（消えた uuid）: 実コンテナをそのままアウト。一括（>6）/反転時は即破棄。
    const exiting: string[] = [];
    for (const uuid of live.keys()) {
      if (!desired.has(uuid)) exiting.push(uuid);
    }
    const immediate = viewerFlipped || exiting.length > 6;
    for (const uuid of exiting) {
      const c = live.get(uuid);
      live.delete(uuid);
      if (!c) continue;
      if (immediate || c.destroyed) {
        if (!c.destroyed) c.destroy({ children: true });
      } else {
        animateExit(c);
      }
    }

    // 再利用 / 新規生成。
    for (const [uuid, { d, sub }] of desired) {
      const existing = live.get(uuid);
      if (existing && !existing.destroyed) {
        applyDesc(existing, d, sub);
      } else {
        const c = createCardContainer(d.card, d.cw, d.ch, d.opts);
        if (!d.interactive) {
          c.eventMode = 'none';
          c.cursor = 'default';
        }
        c.x = d.x;
        c.y = d.y;
        sub.addChild(c);
        live.set(uuid, c);
      }
    }
  };

  return { layer, reconcile };
}
