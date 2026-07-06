/**
 * 開催マスターの localStorage キャッシュと日次ガード判定。
 *
 * 画面は常にキャッシュを正として即表示し、取得はキャッシュ更新として非同期に走る。
 * 取得失敗時は前回キャッシュを保持したまま警告表示できるよう、読み書きを分離している。
 */

import { CACHE_KEY_PREFIX, CACHE_TTL_MS } from './flagship.config';
import type { FlagshipEvent } from './tcgPlusClient';

export interface CachedEvents {
  events: FlagshipEvent[];
  /** 取得時刻（ISO 文字列） */
  syncedAt: string;
}

const eventsKey = (seriesId: number) => `${CACHE_KEY_PREFIX}_events_${seriesId}`;

/** キャッシュを読む。無ければ null。 */
export function readCache(seriesId: number): CachedEvents | null {
  try {
    const raw = localStorage.getItem(eventsKey(seriesId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedEvents;
    if (!Array.isArray(parsed.events) || typeof parsed.syncedAt !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

/** キャッシュを書く。取得時刻は呼び出し時点の now。 */
export function writeCache(seriesId: number, events: FlagshipEvent[], now: Date): CachedEvents {
  const payload: CachedEvents = { events, syncedAt: now.toISOString() };
  try {
    localStorage.setItem(eventsKey(seriesId), JSON.stringify(payload));
  } catch {
    /* 容量超過などは無視（メモリ上の値は返す） */
  }
  return payload;
}

/**
 * キャッシュが鮮度内か（自動取得をスキップしてよいか）。
 * キャッシュが無い・TTL 超過なら false（＝自動取得すべき）。
 */
export function isFresh(cache: CachedEvents | null, now: Date): boolean {
  if (!cache) return false;
  const synced = new Date(cache.syncedAt).getTime();
  if (Number.isNaN(synced)) return false;
  return now.getTime() - synced < CACHE_TTL_MS;
}
