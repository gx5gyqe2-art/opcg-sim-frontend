import * as PIXI from 'pixi.js';

// 盤面アニメーションの土台。依存追加なしの最小トゥイーンエンジン。
// 単一の PIXI.Ticker から駆動し、全演出（グロー・突進・グライド等）が
// この登録簿を共有する（ticker は 1 本だけ）。

export type EaseFn = (t: number) => number;

export const linear: EaseFn = (t) => t;
export const easeOutCubic: EaseFn = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutQuad: EaseFn = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOutBack: EaseFn = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export interface TweenOptions {
  durationMs: number;
  ease?: EaseFn;
  delayMs?: number;
  /** ループ再生（onUpdate を周期駆動する脈動などに使う） */
  repeat?: boolean;
  /** eased な進捗 0..1 を受け取る */
  onUpdate: (k: number) => void;
  onComplete?: () => void;
}

export interface TweenHandle {
  cancel: () => void;
  readonly done: boolean;
}

interface ActiveTween {
  elapsed: number;
  delayLeft: number;
  opts: TweenOptions;
  cancelled: boolean;
  done: boolean;
  owner?: object;
  key?: string;
}

const active = new Set<ActiveTween>();
// owner+key 競合キャンセル用（同一カードの同種トゥイーンが重ならないように）。
const ownerKeys = new WeakMap<object, Map<string, ActiveTween>>();

// CPU 高速化等でアニメ全体を短縮するためのグローバル係数。
let speed = 1;
export function setAnimSpeed(s: number): void {
  speed = Math.max(0.0001, s);
}
export function getAnimSpeed(): number {
  return speed;
}

function dropOwnerKey(t: ActiveTween): void {
  if (t.owner && t.key) {
    const m = ownerKeys.get(t.owner);
    if (m && m.get(t.key) === t) m.delete(t.key);
  }
}

/**
 * トゥイーンを登録する。owner+key を渡すと、同一 owner+key の既存トゥイーンを
 * キャンセルしてから開始する（連打や状態連続変化での競合を防ぐ）。
 */
export function tween(opts: TweenOptions, owner?: object, key?: string): TweenHandle {
  const t: ActiveTween = {
    elapsed: 0,
    delayLeft: opts.delayMs ?? 0,
    opts,
    cancelled: false,
    done: false,
    owner,
    key,
  };
  if (owner && key) {
    let m = ownerKeys.get(owner);
    if (!m) {
      m = new Map();
      ownerKeys.set(owner, m);
    }
    const prev = m.get(key);
    if (prev) {
      prev.cancelled = true;
      active.delete(prev);
    }
    m.set(key, t);
  }
  active.add(t);
  return {
    cancel: () => {
      if (t.cancelled) return;
      t.cancelled = true;
      active.delete(t);
      dropOwnerKey(t);
    },
    get done() {
      return t.done;
    },
  };
}

function stepTweens(deltaMs: number): void {
  const dt = deltaMs * speed;
  for (const t of active) {
    if (t.cancelled) {
      active.delete(t);
      continue;
    }
    if (t.delayLeft > 0) {
      t.delayLeft -= dt;
      continue;
    }
    t.elapsed += dt;
    const dur = t.opts.durationMs <= 0 ? 1 : t.opts.durationMs;
    const ease = t.opts.ease ?? linear;
    if (t.elapsed >= dur) {
      if (t.opts.repeat) {
        t.elapsed %= dur;
        t.opts.onUpdate(ease(t.elapsed / dur));
        continue;
      }
      t.opts.onUpdate(ease(1));
      t.done = true;
      active.delete(t);
      dropOwnerKey(t);
      t.opts.onComplete?.();
      continue;
    }
    t.opts.onUpdate(ease(t.elapsed / dur));
  }
}

/** 全トゥイーンを破棄する（PIXI app 破棄時に呼び、破棄済みオブジェクト参照を残さない）。 */
export function clearTweens(): void {
  active.clear();
}

let attachedTicker: PIXI.Ticker | null = null;
let tickerFn: (() => void) | null = null;

/** PIXI app のティッカーにトゥイーン駆動を接続する（多重接続しない）。 */
export function attachTweenTicker(app: PIXI.Application): void {
  if (attachedTicker) return;
  const ticker = app.ticker;
  const fn = () => stepTweens(ticker.deltaMS);
  ticker.add(fn);
  attachedTicker = ticker;
  tickerFn = fn;
}

/** ティッカー接続を解除する（app 破棄前に呼ぶ）。 */
export function detachTweenTicker(): void {
  if (attachedTicker && tickerFn) {
    attachedTicker.remove(tickerFn);
  }
  attachedTicker = null;
  tickerFn = null;
}
