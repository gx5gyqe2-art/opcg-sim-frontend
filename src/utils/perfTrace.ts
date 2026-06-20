// 描画/フリーズ/API 計測（原因確定フェーズ A→B）。
//
// 目的: 「終盤でオンライン/CPU 対戦の画面がフリーズする」原因を、憶測でなく数値で確定する。
//   フェーズA（描画）: renderScene の所要 ms と findCardContainer 全走査(O(N^2))を実測
//     → 実測の結果、描画は mean ~6ms / max ~21ms と軽く、フリーズの主因ではないと判明。
//   フェーズB（応答待ち）: 各 API 呼び出しの所要 ms を実測し、「サーバ応答待ちで進行が止まる」
//     タイプのフリーズ（メインスレッドは動いているが次手が来ない）を捉える。
//   さらにフリーズ監視を「バックグラウンド（rAF 停止）」と区別できるようにし、アプリ離脱に
//   よる巨大ギャップ（誤検出）を除外する。
//
// 計測は常時有効・極軽量。結果は handleCaptureLogs のログ採取に同梱される。

// ───────────────────────── 描画計測（フェーズA） ─────────────────────────

export type RenderSample = {
  t: number;          // epoch ms（freezes/API と時刻で突き合わせ可能にするため Date.now()）
  renderMs: number;   // renderScene 全体の所要 ms
  cards: number;      // name 付きコンテナ数（盤面カード数の代理指標）
  walkNodes: number;  // findCardContainer による総訪問ノード数（O(N^2) の実測値）
  walkCalls: number;  // findCardContainer 呼び出し回数（= 移動判定したカード数）
  turn: number | null;
  phase: string | null;
  mode: string;       // 'online' | 'cpu' | 'solo'
};

// ───────────────────────── API 計測（フェーズB） ─────────────────────────

export type ApiSample = {
  t: number;     // epoch ms
  path: string;  // エンドポイント（例 '/api/game/cpu/step'）
  ms: number;    // fetch の所要 ms（リクエスト送信〜レスポンス到達）
  ok: boolean;   // HTTP ok か
};

// ───────────────────────── フリーズ計測 ─────────────────────────

export type FreezeSample = {
  t: number;
  gapMs: number;
  background: boolean; // true = アプリ離脱/画面ロックで rAF が停止した区間（≠ 本物のフリーズ）
};

const MAX_RECENT = 120;
const MAX_WORST = 15;
const MAX_FREEZE = 60;
const MAX_API = 200;

const recent: RenderSample[] = [];
const worst: RenderSample[] = [];
const freezes: FreezeSample[] = [];
const apiRecent: ApiSample[] = [];
const apiWorst: ApiSample[] = [];

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
  worst.push(s);
  worst.sort((a, b) => b.renderMs - a.renderMs);
  if (worst.length > MAX_WORST) worst.length = MAX_WORST;
}

export function recordApi(s: ApiSample): void {
  apiRecent.push(s);
  if (apiRecent.length > MAX_API) apiRecent.shift();
  apiWorst.push(s);
  apiWorst.sort((a, b) => b.ms - a.ms);
  if (apiWorst.length > MAX_WORST) apiWorst.length = MAX_WORST;
}

let monitorStarted = false;
let hiddenSinceTick = false; // 前回 tick 以降に「非表示（バックグラウンド化）」が起きたか。

// メインスレッド停滞の検出。rAF はフリーズ中も「バックグラウンド中」も発火しないため、
// visibilitychange で非表示を観測し、復帰後の巨大ギャップを background=true として区別する。
export function startFreezeMonitor(): void {
  if (monitorStarted || typeof requestAnimationFrame === 'undefined' || typeof performance === 'undefined') return;
  monitorStarted = true;
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) hiddenSinceTick = true;
    });
  }
  let last = performance.now();
  const tick = () => {
    const now = performance.now();
    const gap = now - last;
    last = now;
    // 1 フレーム(≈16ms)を大きく超える間隔のみ記録（通常の描画ゆらぎは無視）。
    if (gap > 120) {
      const bg = hiddenSinceTick || (typeof document !== 'undefined' && document.hidden);
      freezes.push({ t: Date.now(), gapMs: Math.round(gap), background: bg });
      if (freezes.length > MAX_FREEZE) freezes.shift();
    }
    hiddenSinceTick = false;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length * p) / 100))];
}

function summarize(values: number[]): Record<string, number> | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: values.length,
    meanMs: +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(1),
    p50Ms: +pct(sorted, 50).toFixed(1),
    p95Ms: +pct(sorted, 95).toFixed(1),
    maxMs: +Math.max(...values).toFixed(1),
  };
}

// API 所要 ms をエンドポイント別に集計する（cpu/step や action の待ちを切り分けるため）。
function apiByPath(): Record<string, Record<string, number> | null> {
  const groups: Record<string, number[]> = {};
  for (const s of apiRecent) (groups[s.path] ??= []).push(s.ms);
  const out: Record<string, Record<string, number> | null> = {};
  for (const [path, vals] of Object.entries(groups)) out[path] = summarize(vals);
  return out;
}

export function perfSnapshot(): Record<string, unknown> {
  const realFreezes = freezes.filter((f) => !f.background);
  return {
    note:
      'フェーズA(描画)とフェーズB(API応答)の実測。renderSummaryMs が小さく api*/freezesReal が大きければ、' +
      'フリーズの主因は描画ではなく「サーバ応答待ち」。freezes の background=true はアプリ離脱(rAF停止)で本物のフリーズではない。',
    // フェーズA: 描画
    renderSummaryMs: summarize(recent.map((r) => r.renderMs)),
    worstRenders: worst,
    // フェーズB: API 応答時間
    apiSummaryMsByPath: apiByPath(),
    worstApiCalls: apiWorst,
    apiRecent: apiRecent.slice(-40),
    // フリーズ（バックグラウンドと区別）
    freezeCountReal: realFreezes.length,
    freezeCountBackground: freezes.length - realFreezes.length,
    freezesRecent: freezes.slice(-30),
    recentRenders: recent.slice(-20),
  };
}
