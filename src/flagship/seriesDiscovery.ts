/**
 * 開催期（シリーズ）の自動発見。
 *
 * TCG+ の event/list は keyword 検索に対応しており、応募受付中（＝新しい開催期）の
 * イベントが先頭ページに現れる（実測 2026-07-06: keyword=フラッグシップバトル の先頭
 * ページは8月開催、応募終了済みの7月開催は末尾に沈む）。大会種別名で keyword 検索した
 * 先頭数ページから「<種別>（N月開催）」のシリーズを収集し、静的設定（flagship.config）
 * と過去の発見結果（localStorage・蓄積）にマージする。
 *
 * これにより新しい月の開催期は、TCG+ にイベントが公開され次第**デプロイなしで**
 * 開催期セレクタに現れる。発見に失敗してもキャッシュ＋静的設定で画面は成立する。
 */

import { CACHE_KEY_PREFIX, CACHE_TTL_MS, KIND_DEFS, SERIES } from './flagship.config';
import type { FlagshipSeries } from './flagship.config';

const API_BASE = 'https://api.bandai-tcg-plus.com';
/** ONE PIECE CARD GAME の game_title_id（event/list 応答の実測値） */
const GAME_TITLE_ID = 8;
/** 発見対象の大会種別（表示順もこの順）。正本は flagship.config の KIND_DEFS。 */
export const KINDS: readonly string[] = KIND_DEFS.map((k) => k.kind);
const PAGE_SIZE = 100;
/** 種別ごとに先頭何ページまで見るか（新開催期は先頭に現れるため少数で足りる） */
const PAGES = 2;

const KEY_SERIES = `${CACHE_KEY_PREFIX}_series`;
const KEY_SERIES_SYNCED = `${CACHE_KEY_PREFIX}_series_synced_at`;

interface RawEvent {
  event_series_id?: number | string;
  event_series_title?: string;
  start_datetime?: string;
}

interface EventListResponse {
  success?: { event_list?: RawEvent[]; total?: number };
}

/**
 * シリーズ名から種別・月・表示ラベルを取り出す（`KIND_DEFS.titleForm` で形式を切り替える）。
 *
 * - `monthly`  … 「<種別>（N月開催）」（全角/半角括弧どちらも）に完全一致。月はタイトルから
 * - `seasonal` … タイトルが種別名を含む（シーズン制・月表記なし）。**月は開催イベントの日付から
 *                導出**し、ラベルはタイトルそのまま（例: チャンピオンシップ26-27 Season 2 店舗予選）
 *
 * `seasonal` の月はそのシリーズで最初に見たイベントの月になる。実データ（series 7757）は
 * 全2550件が単月に収まるが、将来シーズンが月をまたぐ場合は月統合の外に出す判断が要る（§16.17）。
 */
function parseSeriesTitle(
  title: string, startDatetime: string,
): { kind: string; month: number; label: string } | null {
  for (const def of KIND_DEFS) {
    if (def.titleForm === 'monthly') {
      const m = title.match(new RegExp(`^${def.kind}[（(](\\d{1,2})月開催[）)]$`));
      if (m) return { kind: def.kind, month: Number(m[1]), label: `${def.kind}(${m[1]}月開催)` };
    } else if (title.includes(def.kind)) {
      const month = Number(startDatetime.slice(5, 7));   // "2026-09-01T10:00:00" → 9
      if (month >= 1 && month <= 12) return { kind: def.kind, month, label: title };
    }
  }
  return null;
}

/** 開催月。発見時に確定した `month` を優先し、無ければラベルの「(N月開催)」から読む。 */
function monthOf(s: FlagshipSeries): number | null {
  if (typeof s.month === 'number' && s.month >= 1 && s.month <= 12) return s.month;
  const m = s.label.match(/[（(](\d{1,2})月開催[）)]/);
  return m ? Number(m[1]) : null;
}

/** keyword 検索の先頭ページ群から開催期を収集する。 */
async function fetchDiscovered(signal?: AbortSignal): Promise<FlagshipSeries[]> {
  const found = new Map<number, FlagshipSeries>();
  for (const kind of KINDS) {
    for (let page = 0; page < PAGES; page++) {
      const url = `${API_BASE}/api/user/event/list?game_title_id=${GAME_TITLE_ID}` +
        `&keyword=${encodeURIComponent(kind)}&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`;
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as EventListResponse;
      const list = data.success?.event_list ?? [];
      for (const e of list) {
        const id = Number(e.event_series_id);
        const parsed = parseSeriesTitle(e.event_series_title ?? '', e.start_datetime ?? '');
        if (id && parsed) {
          found.set(id, { id, label: parsed.label, kind: parsed.kind, month: parsed.month });
        }
      }
      const total = data.success?.total ?? 0;
      if ((page + 1) * PAGE_SIZE >= total) break;
    }
  }
  return [...found.values()];
}

/** id で重複排除し、種別順 → id 降順（新しい開催期が先）で並べる。 */
function merge(...lists: FlagshipSeries[][]): FlagshipSeries[] {
  const byId = new Map<number, FlagshipSeries>();
  for (const list of lists) for (const s of list) byId.set(s.id, s);
  const kindOrder = new Map<string, number>(KINDS.map((k, i) => [k, i]));
  return [...byId.values()].sort((a, b) =>
    (kindOrder.get(a.kind) ?? KINDS.length) - (kindOrder.get(b.kind) ?? KINDS.length) || b.id - a.id);
}

function readCachedSeries(): FlagshipSeries[] {
  try {
    const raw = localStorage.getItem(KEY_SERIES);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FlagshipSeries[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s) => typeof s?.id === 'number' && typeof s?.label === 'string' && typeof s?.kind === 'string')
      .map((s) => (typeof s.month === 'number' ? s : { id: s.id, label: s.label, kind: s.kind }));
  } catch {
    return [];
  }
}

/** 静的設定 + 発見済みキャッシュをマージした開催期一覧（同期・即時、画面の初期値）。 */
export function loadSeriesList(): FlagshipSeries[] {
  return merge([...SERIES], readCachedSeries());
}

/** 種別名の短縮表示（一覧のバッジ・KPI サブラベル用）。正本は KIND_DEFS。 */
export function kindShort(kind: string): string {
  return KIND_DEFS.find((k) => k.kind === kind)?.short ?? kind;
}

/** 種別のバッジスタイル修飾（CSS クラス `fs-kind-<badge>`）。未知種別は fs にフォールバック。 */
export function kindBadge(kind: string): string {
  return KIND_DEFS.find((k) => k.kind === kind)?.badge ?? 'fs';
}

/** 同じ月のフラッグシップ+エクストラをまとめた開催期セレクタの1項目。 */
export interface SeriesMonth {
  /** 月（1-12）。セレクタの値 */
  month: number;
  /** 表示ラベル（例: 7月開催） */
  label: string;
  /** その月の開催期（種別順）。無い種別は含まれない */
  series: FlagshipSeries[];
}

/**
 * 開催期一覧を月単位にまとめる（同月のフラッグシップとエクストラを1画面に統合するため）。
 * 同月同種別が複数ある場合（年をまたいだ同月など）は新しい id の開催期を採用する。
 * 並びは新しい月（id が大きい開催期を含む月）が先。
 */
export function groupByMonth(list: FlagshipSeries[]): SeriesMonth[] {
  const byMonth = new Map<number, Map<string, FlagshipSeries>>();
  for (const s of list) {
    const m = monthOf(s);
    if (m === null) continue;
    const kinds = byMonth.get(m) ?? new Map<string, FlagshipSeries>();
    const prev = kinds.get(s.kind);
    if (!prev || s.id > prev.id) kinds.set(s.kind, s);
    byMonth.set(m, kinds);
  }
  const kindOrder = new Map<string, number>(KINDS.map((k, i) => [k, i]));
  return [...byMonth.entries()]
    .map(([month, kinds]) => ({
      month,
      label: `${month}月開催`,
      series: [...kinds.values()].sort((a, b) =>
        (kindOrder.get(a.kind) ?? KINDS.length) - (kindOrder.get(b.kind) ?? KINDS.length)),
    }))
    .sort((a, b) => Math.max(...b.series.map((s) => s.id)) - Math.max(...a.series.map((s) => s.id)));
}

/**
 * 既定で選択する月: 当月 →（無ければ）一覧先頭。
 * 翌月の開催期が早めに公開されても、月が変わるまで既定は当月のまま。
 */
export function pickDefaultMonth(months: SeriesMonth[], now: Date): number {
  const m = now.getMonth() + 1;
  return (months.find((x) => x.month === m) ?? months[0]).month;
}

/**
 * 鮮度切れ（24h）または force のとき発見を実行し、マージ済み一覧を返す。
 * 発見結果は localStorage に蓄積し、失敗時は現状の一覧をそのまま返す（非破壊）。
 */
export async function refreshSeriesList(force = false, signal?: AbortSignal): Promise<FlagshipSeries[]> {
  const syncedRaw = localStorage.getItem(KEY_SERIES_SYNCED);
  const synced = syncedRaw ? new Date(syncedRaw).getTime() : NaN;
  if (!force && !Number.isNaN(synced) && Date.now() - synced < CACHE_TTL_MS) {
    return loadSeriesList();
  }
  try {
    const discovered = await fetchDiscovered(signal);
    const merged = merge(loadSeriesList(), discovered);
    try {
      localStorage.setItem(KEY_SERIES, JSON.stringify(merged));
      localStorage.setItem(KEY_SERIES_SYNCED, new Date().toISOString());
    } catch { /* 容量超過などは無視 */ }
    return merged;
  } catch {
    return loadSeriesList();
  }
}
