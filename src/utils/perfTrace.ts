// 描画/フリーズ計測（原因確定フェーズ A）。
//
// 目的: 「終盤でオンライン/CPU 対戦の画面がフリーズし、TOPに戻ると render error」の主因が
// フロントの描画パイプライン（renderScene の全破棄→全再構築＋findCardContainer の全走査=O(N^2)）
// であることを、憶測でなく数値で裏取りするための軽量計測。
//
// 採取するもの:
//   - renderScene 1 回の所要 ms（renderMs）と、その時の盤面規模（cards）
//   - findCardContainer による総訪問ノード数（walkNodes）と呼び出し回数（walkCalls）
//     → walkNodes/walkCalls ≒ ステージ総ノード数。walkNodes が cards に対して二乗的に増えれば O(N^2) を実証。
//   - メインスレッド停滞（requestAnimationFrame の隣接フレーム間隔が大きく開いた区間）= 実フリーズ
//
// 計測は常時有効・極軽量（カウンタ加算とリングバッファのみ）。結果は handleCaptureLogs の
// ログ採取に同梱され、ユーザはこれまでと同じ手順でチャットへ貼り戻せる。

export type RenderSample = {
  t: number;          // epoch ms（freezes と突き合わせ可能にするため Date.now()）
  renderMs: number;   // renderScene 全体の所要 ms
  cards: number;      // name 付きコンテナ数（盤面カード数の代理指標）
  walkNodes: number;  // findCardContainer による総訪問ノード数（O(N^2) の実測値）
  walkCalls: number;  // findCardContainer 呼び出し回数（= 移動判定したカード数）
  turn: number | null;
  phase: string | null;
  mode: string;       // 'online' | 'cpu' | 'solo'
};

export type FreezeSample = { t: number; gapMs: number };

const MAX_RECENT = 120;
const MAX_WORST = 15;
const MAX_FREEZE = 60;

const recent: RenderSample[] = [];
const worst: RenderSample[] = [];
const freezes: FreezeSample[] = [];

// 現在計測中の renderScene 用アキュムレータ（findCardContainer から加算される）。
let curWalkNodes = 0;
let curWalkCalls = 0;

export function resetWalk(): void { curWalkNodes = 0; curWalkCalls = 0; }
export function bumpWalk(nodesVisited: number): void { curWalkNodes += nodesVisited; curWalkCalls += 1; }
export function takeWalk(): { walkNodes: number; walkCalls: number } {
  return { walkNodes: curWalkNodes, walkCalls: curWalkCalls };
}

export function recordRender(s: RenderSample): void {
  recent.push(s);
  if (recent.length > MAX_RECENT) recent.shift();
  // 最悪値 top N（renderMs 降順）。
  worst.push(s);
  worst.sort((a, b) => b.renderMs - a.renderMs);
  if (worst.length > MAX_WORST) worst.length = MAX_WORST;
}

let monitorStarted = false;

// メインスレッド停滞の検出。rAF はフリーズ中は発火せず、復帰直後の 1 フレームで大きな
// 間隔差となって現れる。その差（gapMs）を「フリーズ区間」として記録する。
export function startFreezeMonitor(): void {
  if (monitorStarted || typeof requestAnimationFrame === 'undefined' || typeof performance === 'undefined') return;
  monitorStarted = true;
  let last = performance.now();
  const tick = () => {
    const now = performance.now();
    const gap = now - last;
    last = now;
    // 1 フレーム(≈16ms)を大きく超える間隔のみ記録（通常の描画ゆらぎは無視）。
    if (gap > 120) {
      freezes.push({ t: Date.now(), gapMs: Math.round(gap) });
      if (freezes.length > MAX_FREEZE) freezes.shift();
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length * p) / 100))];
}

export function perfSnapshot(): Record<string, unknown> {
  const ms = recent.map((r) => r.renderMs);
  const sorted = [...ms].sort((a, b) => a - b);
  const summary = ms.length
    ? {
        count: ms.length,
        meanMs: +(ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(1),
        p50Ms: +pct(sorted, 50).toFixed(1),
        p95Ms: +pct(sorted, 95).toFixed(1),
        maxMs: +Math.max(...ms).toFixed(1),
      }
    : null;
  return {
    note:
      'renderScene 所要ms・盤面カード数・findCardContainer 全走査ノード数の実測。' +
      'walkNodes が cards に対し二乗的に増え、かつ renderMs / freezes が終盤で増えていれば、' +
      'フリーズの主因は描画パイプライン（O(N^2) 全走査・非スロットル全再構築）と確定できる。',
    renderSummaryMs: summary,
    freezeCount: freezes.length,
    freezesRecent: freezes.slice(-30),
    worstRenders: worst,
    recentRenders: recent.slice(-30),
  };
}
