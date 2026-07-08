/**
 * opcg-sim-backend の flagship API（結果登録・閲覧、設計 §12）の薄いクライアント。
 *
 * BASE_URL はゲーム本体と同じ `api.config` を流用する。flagship API は contract/
 * のラチェット対象外のため、型はここで手書きし backend の snake_case を camelCase へ
 * 整形して返す。バックエンド不達時の扱い（P1 表示への静かなフォールバック）は
 * 呼び出し側（FlagshipEvents）の責務。
 */
import { API_CONFIG } from '../api/api.config';
import type { FlagshipEvent } from './tcgPlusClient';

const BASE = `${API_CONFIG.BASE_URL}/api/flagship`;

/** リーダー辞書の1件（カードDB 種類=リーダー、全137件）。 */
export interface FlagshipLeader {
  cardNumber: string;
  name: string;
  color: string;
  life: string;
}

/** placement 1件（登録入力・閲覧の両方で使う）。 */
export interface ResultEntry {
  placement: number;
  leaderCardNumber: string | null;
  leaderRaw: string | null;
  /** 辞書解決済みリーダー（number が辞書にある場合のみ） */
  leader: FlagshipLeader | null;
}

/** 開催詳細（GET /events/{id}/results・PUT 応答）。 */
export interface EventResults {
  eventId: number;
  postUrl: string | null;
  bodyText: string | null;
  results: ResultEntry[];
}

/** 一覧オーバーレイ用サマリの1開催分。 */
export interface SummaryItem {
  eventId: number;
  resultCount: number;
  postUrl: string | null;
  /** 優勝（placement=1）。通常1件、定員64の2ブロック開催は最大2件（§16.11）。 */
  winners: ResultEntry[];
}

interface RawLeader { card_number: string; name: string; color: string; life: string }
interface RawEntry {
  placement: number;
  leader_card_number: string | null;
  leader_raw: string | null;
  leader: RawLeader | null;
}

const toLeader = (l: RawLeader): FlagshipLeader => ({
  cardNumber: l.card_number, name: l.name, color: l.color, life: l.life,
});

const toEntry = (r: RawEntry): ResultEntry => ({
  placement: r.placement,
  leaderCardNumber: r.leader_card_number,
  leaderRaw: r.leader_raw,
  leader: r.leader ? toLeader(r.leader) : null,
});

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    // バリデーション・重複（400/409/422）は detail を画面へ出せるようにする
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { detail?: unknown };
      if (typeof body.detail === 'string') detail = body.detail;
    } catch { /* 本文なしはステータスのまま */ }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

/** リーダー辞書（137件）。手入力フォームの選択肢。 */
export async function fetchLeaders(): Promise<FlagshipLeader[]> {
  const raw = await request<RawLeader[]>('/leaders');
  return raw.map(toLeader);
}

/**
 * 開催マスター（設計 §16.8）。backend が TCG+ を取得＋永続化し、過去開催も含めて返す。
 * フロントはこれを開催の唯一の取得元にする（TCG+ 直取得のフォールバックは持たない）。
 */
export async function fetchEvents(seriesId: number, signal?: AbortSignal): Promise<FlagshipEvent[]> {
  const res = await fetch(`${BASE}/events?series_id=${seriesId}`, {
    signal, headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as {
    events: Array<{ id: number; start_datetime: string; store: string; pref: string; capacity: number | null; sns_url: string | null }>;
  };
  return data.events.map((e) => ({
    id: e.id,
    startDatetime: e.start_datetime ?? '',
    date: (e.start_datetime ?? '').slice(0, 10),
    store: e.store ?? '',
    pref: e.pref ?? '',
    capacity: e.capacity ?? null,
    snsUrl: e.sns_url ?? '',
  }));
}

/** 抽出候補 1 件（設計 §13、LLM不使用の辞書マッチング結果）。 */
export interface ExtractedEntry extends ResultEntry {
  confidence: number;
}

/** 本文から順位×リーダーの候補を抽出（サジェスト）。DBには書かない。 */
export async function extractFromText(
  text: string,
): Promise<{ results: ExtractedEntry[]; unmatched: string[] }> {
  const raw = await request<{
    results: Array<RawEntry & { confidence: number }>;
    unmatched: string[];
  }>('/extract', { method: 'POST', body: JSON.stringify({ text }) });
  return {
    results: raw.results.map((r) => ({ ...toEntry(r), confidence: r.confidence })),
    unmatched: raw.unmatched ?? [],
  };
}

/** oEmbed 代理取得でポスト本文を得る（ベストエフォート。取れなければ null）。 */
export async function fetchOembedBody(url: string): Promise<string | null> {
  try {
    const raw = await request<{ body_text: string }>(`/oembed?url=${encodeURIComponent(url)}`);
    return raw.body_text || null;
  } catch {
    return null; // 取得不可（X制限・環境依存）→ 手貼りへ
  }
}

/** X 取り込みの結果（設計 §15、本文取得 + P3 抽出の一気通貫）。 */
export interface IngestResult {
  tweetUrl: string;
  bodyText: string;
  author: string | null;
  authorName: string | null;
  createdAt: string | null;
  source: string;
  results: ExtractedEntry[];
  unmatched: string[];
}

/** ポスト URL から本文取得 → 候補抽出をまとめて取得。取得不可（404 等）は例外。 */
export async function ingestFromUrl(url: string): Promise<IngestResult> {
  const raw = await request<{
    tweet_url: string;
    body_text: string;
    author: string | null;
    author_name: string | null;
    created_at: string | null;
    source: string;
    results: Array<RawEntry & { confidence: number }>;
    unmatched: string[];
  }>('/ingest', { method: 'POST', body: JSON.stringify({ url }) });
  return {
    tweetUrl: raw.tweet_url,
    bodyText: raw.body_text,
    author: raw.author,
    authorName: raw.author_name,
    createdAt: raw.created_at,
    source: raw.source,
    results: raw.results.map((r) => ({ ...toEntry(r), confidence: r.confidence })),
    unmatched: raw.unmatched ?? [],
  };
}

/** 発見候補 1 件（設計 §16、recent search + P3 抽出）。 */
export interface DiscoveredCandidate {
  tweetUrl: string;
  author: string | null;
  authorName: string | null;
  createdAt: string | null;
  bodyText: string;
  results: ExtractedEntry[];
  unmatched: string[];
}

/** 発見結果（候補ポスト一覧）。 */
export interface DiscoverResult {
  enabled: boolean;
  query: string;
  candidates: DiscoveredCandidate[];
}

/** 検索（発見）が使えるか（Bearer Token 有無）。無効なら画面は導線を隠す。 */
export async function fetchDiscoverStatus(): Promise<boolean> {
  try {
    const raw = await request<{ enabled: boolean }>('/discover/status');
    return !!raw.enabled;
  } catch {
    return false; // 到達不可＝機能なし扱い
  }
}

/**
 * 結果ポストを X 検索して各候補を P3 抽出して返す。
 * `accounts`（`from:`）や `keywords`（AND の素キーワード）＋`anyTerms`（優勝/全勝/準優勝 の OR 群）で
 * 絞り込む。結果ポストはハッシュタグを付けないことが多い（設計 §16.6）ため、タグ必須にはしない。
 */
export async function discoverPosts(req: {
  hashtags?: string[];
  accounts?: string[];
  keywords?: string[];
  anyTerms?: string[];
  startTime?: string;
  endTime?: string;
  maxResults?: number;
}): Promise<DiscoverResult> {
  const raw = await request<{
    enabled: boolean;
    query: string;
    candidates: Array<{
      tweet_url: string; author: string | null; author_name: string | null;
      created_at: string | null; body_text: string;
      results: Array<RawEntry & { confidence: number }>; unmatched: string[];
    }>;
  }>('/discover', {
    method: 'POST',
    body: JSON.stringify({
      hashtags: req.hashtags ?? [], accounts: req.accounts ?? [],
      keywords: req.keywords ?? [], any_terms: req.anyTerms ?? [],
      start_time: req.startTime, end_time: req.endTime, max_results: req.maxResults ?? 10,
    }),
  });
  return {
    enabled: raw.enabled,
    query: raw.query,
    candidates: raw.candidates.map((c) => ({
      tweetUrl: c.tweet_url, author: c.author, authorName: c.author_name,
      createdAt: c.created_at, bodyText: c.body_text,
      results: c.results.map((r) => ({ ...toEntry(r), confidence: r.confidence })),
      unmatched: c.unmatched ?? [],
    })),
  };
}

/** 全国の優勝ポストを収集して DB に貯める（設計 §16.7）。件数を返す。 */
export async function collectPosts(opts?: { maxResults?: number; pages?: number }): Promise<number> {
  const raw = await request<{ collected: number }>('/collect', {
    method: 'POST',
    body: JSON.stringify({ max_results: opts?.maxResults ?? 100, pages: opts?.pages ?? 3 }),
  });
  return raw.collected;
}

/** 収集ポストの開催候補1件（handle=自動確定候補／name=要承認、設計 §16.7）。 */
export interface LinkCandidate {
  eventId: number;
  method: string;   // 'handle' | 'name'
  score: number;
  dayGap: number;
  auto: boolean;
}

/** 紐付けレビューの1行（未紐付け収集ポスト＋開催候補）。 */
export interface ReviewPost {
  tweetId: string;
  author: string | null;
  authorName: string | null;
  date: string | null;
  charName: string | null;
  cardNumber: string | null;
  tweetUrl: string | null;
  candidates: LinkCandidate[];
}

/** 指定シリーズの開催へ、未紐付けポストを照合したレビュー表を取得。 */
export async function fetchLinkReview(seriesId: number): Promise<ReviewPost[]> {
  const raw = await request<{
    posts: Array<{
      tweet_id: string; author: string | null; author_name: string | null; date: string | null;
      char_name: string | null; card_number: string | null; tweet_url: string | null;
      candidates: Array<{ event_id: number; method: string; score: number; day_gap: number; auto: boolean }>;
    }>;
  }>(`/link/review?series_id=${seriesId}`);
  return raw.posts.map((p) => ({
    tweetId: p.tweet_id, author: p.author, authorName: p.author_name, date: p.date,
    charName: p.char_name, cardNumber: p.card_number, tweetUrl: p.tweet_url,
    candidates: p.candidates.map((c) => ({
      eventId: c.event_id, method: c.method, score: c.score, dayGap: c.day_gap, auto: c.auto,
    })),
  }));
}

/** 承認した (ポスト→開催) をまとめて保存（未紐付けプールから外す）。更新件数を返す。 */
export async function linkApprove(links: Array<{ tweetId: string; eventId: number | null }>): Promise<number> {
  const raw = await request<{ updated: number }>('/link/approve', {
    method: 'POST',
    body: JSON.stringify({ links: links.map((l) => ({ tweet_id: l.tweetId, event_id: l.eventId })) }),
  });
  return raw.updated;
}

/** 店名 → 店舗X を手動登録する（設計 §16.9）。空文字で登録解除。正規化後の URL（or null）を返す。 */
export async function setStoreSns(store: string, snsUrl: string): Promise<string | null> {
  const raw = await request<{ store: string; sns_url: string | null }>('/stores/sns', {
    method: 'POST',
    body: JSON.stringify({ store, sns_url: snsUrl }),
  });
  return raw.sns_url;
}

/** シリーズ内で結果を持つ開催のサマリ（eventId → SummaryItem）。 */
export async function fetchSeriesSummary(seriesId: number): Promise<Map<number, SummaryItem>> {
  const raw = await request<{
    items: Array<{ event_id: number; result_count: number; post_url: string | null; winners: RawEntry[] }>;
  }>(`/results?series_id=${seriesId}`);
  return new Map(raw.items.map((it) => [it.event_id, {
    eventId: it.event_id,
    resultCount: it.result_count,
    postUrl: it.post_url,
    winners: (it.winners ?? []).map(toEntry),
  }]));
}

/** 開催詳細（結果未登録の開催は 404 → null）。 */
export async function fetchEventResults(eventId: number): Promise<EventResults | null> {
  try {
    const raw = await request<{
      event_id: number; post_url: string | null; body_text: string | null; results: RawEntry[];
    }>(`/events/${eventId}/results`);
    return {
      eventId: raw.event_id, postUrl: raw.post_url, bodyText: raw.body_text,
      results: raw.results.map(toEntry),
    };
  } catch (e) {
    if (e instanceof Error && e.message.includes('404')) return null;
    throw e;
  }
}

/** 結果登録（開催単位の全置換・冪等）。開催スナップショットを同送する（設計 §12.1）。 */
export async function putEventResults(
  event: FlagshipEvent,
  seriesId: number,
  postUrl: string,
  entries: Array<{ placement: number; leaderCardNumber?: string; leaderRaw?: string }>,
): Promise<EventResults> {
  const body = {
    event: {
      id: event.id,
      series_id: seriesId,
      start_datetime: event.startDatetime,
      store: event.store,
      pref: event.pref,
      capacity: event.capacity,
      sns_url: event.snsUrl || null,
    },
    post: postUrl.trim() ? { url: postUrl.trim() } : null,
    results: entries.map((r) => ({
      placement: r.placement,
      leader_card_number: r.leaderCardNumber || null,
      leader_raw: r.leaderRaw || null,
    })),
  };
  const raw = await request<{
    event_id: number; post_url: string | null; body_text: string | null; results: RawEntry[];
  }>(`/events/${event.id}/results`, { method: 'PUT', body: JSON.stringify(body) });
  return {
    eventId: raw.event_id, postUrl: raw.post_url, bodyText: raw.body_text,
    results: raw.results.map(toEntry),
  };
}

/** 結果の取り消し（誤登録の削除）。 */
export async function deleteEventResults(eventId: number): Promise<void> {
  await request<{ status: string }>(`/events/${eventId}/results`, { method: 'DELETE' });
}
