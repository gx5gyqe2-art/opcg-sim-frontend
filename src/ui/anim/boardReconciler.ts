import * as PIXI from 'pixi.js';
import { createCardContainer, drawCardVisuals, type CardContainer } from '../CardRenderer';
import type { MovableDescriptor } from '../BoardSide';

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
    gameStateChanged: boolean,
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

  const applyDesc = (
    c: CardContainer,
    d: MovableDescriptor,
    parent: PIXI.Container,
    setPosition: boolean,
  ): void => {
    // inner を最新カードで再描画（古い表示を残さない）。
    drawCardVisuals(c, d.card, d.cw, d.ch, d.opts);
    c.eventMode = d.interactive ? 'static' : 'none';
    c.cursor = d.interactive ? 'pointer' : 'default';
    if (c.parent !== parent) parent.addChild(c); // 別サイドへ移動（viewer 反転等）
    // UI のみの再描画では位置を触らない（進行中のグライドをスナップしない）。
    if (setPosition) {
      c.x = d.x;
      c.y = d.y;
    }
  };

  const reconcile = (
    top: MovableDescriptor[],
    bottom: MovableDescriptor[],
    midY: number,
    viewerFlipped: boolean,
    gameStateChanged: boolean,
  ): void => {
    topSub.y = 0;
    bottomSub.y = midY;

    const desired = new Map<string, { d: MovableDescriptor; sub: PIXI.Container }>();
    for (const d of top) desired.set(d.uuid, { d, sub: topSub });
    for (const d of bottom) desired.set(d.uuid, { d, sub: bottomSub });

    // 退場（消えた uuid）: 居残りフェードはせず即時破棄。
    // KO/除去のフィードバックは Phase2 の赤フラッシュ＋煙（effectsLayer）に一本化。
    for (const uuid of live.keys()) {
      if (desired.has(uuid)) continue;
      const c = live.get(uuid);
      live.delete(uuid);
      if (c && !c.destroyed) c.destroy({ children: true });
    }

    // 位置を更新するのは実変化時 or viewer 反転時のみ。
    const setPos = gameStateChanged || viewerFlipped;

    // 再利用 / 新規生成。
    for (const [uuid, { d, sub }] of desired) {
      const existing = live.get(uuid);
      if (existing && !existing.destroyed) {
        applyDesc(existing, d, sub, setPos);
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
