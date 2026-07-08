/**
 * BANDAI TCG+ の公開イベント API から開催マスターを取得するクライアント。
 *
 * この API は非公式だが認証不要で、CORS が任意 Origin を反射するためブラウザから
 * 直接取得できる（2026-07-06 実測）。P1 はこの取得のみでバックエンドなしに完結する。
 * 将来サーバーサイド同期へ移す場合も、この I/F（シリーズID → FlagshipEvent[]）を
 * そのまま移設できるようにしている。
 */

const API_BASE = 'https://api.bandai-tcg-plus.com';
const PAGE_SIZE = 100;
const MAX_RETRY = 4;

/** 画面表示に必要な項目だけへ整形した開催データ。 */
export interface FlagshipEvent {
  /** TCG+ の event id（重複排除・突合キー） */
  id: number;
  /** 開催日時（ISO 風文字列 "2026-07-05T13:00:00"、現地時刻） */
  startDatetime: string;
  /** 開催日 "2026-07-05" */
  date: string;
  /** 店舗名 */
  store: string;
  /** 都道府県名（例: 東京都） */
  pref: string;
  /** 定員（不明な場合 null） */
  capacity: number | null;
  /** 店舗の X アカウント URL（未登録なら空文字） */
  snsUrl: string;
  /** 応募締切（RFC3339、無ければ空文字）。募集中＝now < applyEnd の判定に使う（§16.13）。 */
  applyEnd: string;
  /** 申込人数（backend 保存分・§16.14）。未取得は null。募集中は取得ボタンで最新化。 */
  applicants: number | null;
}

/** TCG+ event/list の1件分（必要フィールドのみ）。 */
interface RawEvent {
  id: number;
  start_datetime?: string;
  organizer_name?: string;
  place?: string;
  max_join_count?: number | null;
  organizer_sns_url?: string | null;
  apply_end_datetime?: string | null;
}

interface EventListResponse {
  success?: {
    code: number;
    event_list: RawEvent[];
    total: number;
  };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 指数バックオフ（2/4/8/16 秒）付きで JSON を取得する。 */
async function fetchJson(url: string, signal?: AbortSignal): Promise<EventListResponse> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    if (attempt > 0) await sleep(2 ** attempt * 1000);
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as EventListResponse;
    } catch (e) {
      if (signal?.aborted) throw e;
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('TCG+ API 取得に失敗しました');
}

function normalize(raw: RawEvent): FlagshipEvent {
  const startDatetime = raw.start_datetime ?? '';
  return {
    id: raw.id,
    startDatetime,
    date: startDatetime.slice(0, 10),
    store: (raw.organizer_name ?? '').trim(),
    pref: raw.place ?? '',
    capacity: typeof raw.max_join_count === 'number' ? raw.max_join_count : null,
    snsUrl: raw.organizer_sns_url ?? '',
    applyEnd: raw.apply_end_datetime ?? '',
    applicants: null,  // 一覧APIには無い。backend 保存分は /events から来る（§16.14）。
  };
}

/**
 * 開催の現在の申込人数（抽選応募数）を TCG+ 詳細 API から直接取得する（`success.count_applicants`）。
 * CORS 開放のためブラウザから直接呼べる。取れなければ null（→ 一覧は「-」）。best-effort・リトライなし。
 */
export async function fetchApplicantCount(eventId: number, signal?: AbortSignal): Promise<number | null> {
  try {
    const res = await fetch(`${API_BASE}/api/user/event/${eventId}`, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as { success?: { count_applicants?: number | null } };
    const n = data.success?.count_applicants;
    return typeof n === 'number' ? n : null;
  } catch {
    return null;
  }
}

/**
 * 指定シリーズの全開催を取得する。limit=100 でページングし、total 到達まで進める。
 * 開催日時→店舗名 の昇順で返す。
 */
export async function fetchSeriesEvents(
  seriesId: number,
  signal?: AbortSignal,
): Promise<FlagshipEvent[]> {
  const events: FlagshipEvent[] = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const url =
      `${API_BASE}/api/user/event/list` +
      `?event_series_id=${seriesId}&limit=${PAGE_SIZE}&offset=${offset}`;
    const data = await fetchJson(url, signal);
    const page = data.success?.event_list ?? [];
    total = data.success?.total ?? page.length;
    if (page.length === 0) break;
    for (const raw of page) events.push(normalize(raw));
    offset += PAGE_SIZE;
  }

  events.sort(
    (a, b) => a.startDatetime.localeCompare(b.startDatetime) || a.pref.localeCompare(b.pref),
  );
  return events;
}
