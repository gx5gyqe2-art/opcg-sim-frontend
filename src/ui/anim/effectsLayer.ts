import * as PIXI from 'pixi.js';
import { tween, easeOutCubic, easeOutBack } from './tween';

// 永続演出レイヤ。盤面の全再構築（renderScene の破棄→再構築）から独立して
// 生き残るオーバーレイ Container を提供する。renderScene 側で破棄ループの前に
// detach し、末尾で最前面へ addChild し直すことで、飛行中の演出を維持する。

export interface EffectsLayer {
  container: PIXI.Container;
  /** 着弾フラッシュ（白い円が弾けて消える）。 */
  impactFlash: (x: number, y: number, color?: number) => void;
  /** 対象コンテナを短時間シェイクする（減衰）。 */
  shake: (target: PIXI.Container, intensity?: number, durationMs?: number) => void;
  /** 粒子が飛び散る煙（KO/除去）。 */
  puff: (x: number, y: number, color?: number) => void;
  /** 拡散する光のパルス（ドン付与/バフ/回復）。 */
  glowPulse: (x: number, y: number, radius: number, color?: number) => void;
  /** ghost を from→対象手前→from と突進させ、最接近時に onImpact を呼ぶ。 */
  lunge: (
    ghost: PIXI.Container,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    onImpact?: () => void,
  ) => void;
  /** ghost をレイヤへ載せる（移動演出は呼び出し側でトゥイーン）。 */
  addGhost: (display: PIXI.Container) => void;
  /** レイヤ上の演出をすべて消す。 */
  clear: () => void;
}

export function createEffectsLayer(): EffectsLayer {
  const container = new PIXI.Container();
  // 演出はクリック判定を奪わない。
  container.eventMode = 'none';

  const impactFlash = (x: number, y: number, color = 0xffffff): void => {
    const g = new PIXI.Graphics();
    g.beginFill(color, 0.85).drawCircle(0, 0, 8).endFill();
    g.position.set(x, y);
    container.addChild(g);
    tween({
      durationMs: 280,
      ease: easeOutCubic,
      onUpdate: (k) => {
        if (g.destroyed) return;
        g.scale.set(1 + k * 6);
        g.alpha = 0.85 * (1 - k);
      },
      onComplete: () => {
        if (!g.destroyed) g.destroy();
      },
    });
  };

  const shake = (target: PIXI.Container, intensity = 6, durationMs = 260): void => {
    const baseX = target.x;
    const baseY = target.y;
    tween(
      {
        durationMs,
        onUpdate: (k) => {
          if (target.destroyed) return;
          const decay = 1 - k;
          target.x = baseX + (Math.random() * 2 - 1) * intensity * decay;
          target.y = baseY + (Math.random() * 2 - 1) * intensity * decay;
        },
        onComplete: () => {
          if (target.destroyed) return;
          target.x = baseX;
          target.y = baseY;
        },
      },
      target,
      'shake',
    );
  };

  const puff = (x: number, y: number, color = 0xffffff): void => {
    const N = 6;
    for (let i = 0; i < N; i++) {
      const g = new PIXI.Graphics();
      g.beginFill(color, 0.8).drawCircle(0, 0, 3).endFill();
      g.position.set(x, y);
      container.addChild(g);
      const ang = (Math.PI * 2 * i) / N + Math.random() * 0.4;
      const dist = 24 + Math.random() * 16;
      tween({
        durationMs: 360,
        ease: easeOutCubic,
        onUpdate: (k) => {
          if (g.destroyed) return;
          g.x = x + Math.cos(ang) * dist * k;
          g.y = y + Math.sin(ang) * dist * k;
          g.alpha = 0.8 * (1 - k);
        },
        onComplete: () => {
          if (!g.destroyed) g.destroy();
        },
      });
    }
  };

  const glowPulse = (x: number, y: number, radius: number, color = 0xffe066): void => {
    const g = new PIXI.Graphics();
    g.beginFill(color, 0.5).drawCircle(0, 0, radius).endFill();
    g.position.set(x, y);
    container.addChild(g);
    tween({
      durationMs: 520,
      ease: easeOutCubic,
      onUpdate: (k) => {
        if (g.destroyed) return;
        g.scale.set(0.6 + k * 0.9);
        g.alpha = 0.5 * (1 - k);
      },
      onComplete: () => {
        if (!g.destroyed) g.destroy();
      },
    });
  };

  const lunge = (
    ghost: PIXI.Container,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    onImpact?: () => void,
  ): void => {
    container.addChild(ghost);
    ghost.position.set(fromX, fromY);
    // 対象の少し手前まで突進し、戻る。
    const apX = fromX + (toX - fromX) * 0.78;
    const apY = fromY + (toY - fromY) * 0.78;
    tween({
      durationMs: 240,
      ease: easeOutBack,
      onUpdate: (k) => {
        if (ghost.destroyed) return;
        ghost.x = fromX + (apX - fromX) * k;
        ghost.y = fromY + (apY - fromY) * k;
      },
      onComplete: () => {
        onImpact?.();
        tween({
          durationMs: 200,
          ease: easeOutCubic,
          onUpdate: (k) => {
            if (ghost.destroyed) return;
            ghost.x = apX + (fromX - apX) * k;
            ghost.y = apY + (fromY - apY) * k;
          },
          onComplete: () => {
            if (!ghost.destroyed) ghost.destroy({ children: true });
          },
        });
      },
    });
  };

  const addGhost = (display: PIXI.Container): void => {
    container.addChild(display);
  };

  const clear = (): void => {
    container.removeChildren().forEach((c) => {
      if (!c.destroyed) c.destroy({ children: true });
    });
  };

  return { container, impactFlash, shake, puff, glowPulse, lunge, addGhost, clear };
}
