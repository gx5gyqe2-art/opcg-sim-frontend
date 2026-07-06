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
  winner: ResultEntry | null;
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

/** シリーズ内で結果を持つ開催のサマリ（eventId → SummaryItem）。 */
export async function fetchSeriesSummary(seriesId: number): Promise<Map<number, SummaryItem>> {
  const raw = await request<{
    items: Array<{ event_id: number; result_count: number; post_url: string | null; winner: RawEntry | null }>;
  }>(`/results?series_id=${seriesId}`);
  return new Map(raw.items.map((it) => [it.event_id, {
    eventId: it.event_id,
    resultCount: it.result_count,
    postUrl: it.post_url,
    winner: it.winner ? toEntry(it.winner) : null,
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
