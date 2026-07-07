/**
 * 開催マスターの取得状態を管理するフック。
 *
 * - マウント時／シリーズ変更時に自動取得（キャッシュが鮮度内ならスキップ）
 * - refetch() で手動取得（日次ガードを無視して即時再取得）
 * - 表示は常にキャッシュを正とし、取得は背景更新。失敗時は前回データを保持。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchEvents } from './resultsClient';
import type { FlagshipEvent } from './tcgPlusClient';
import { isFresh, readCache, writeCache } from './eventsCache';

export interface UseFlagshipEvents {
  events: FlagshipEvent[];
  /** 最終取得時刻（未取得なら null） */
  syncedAt: string | null;
  /** 初回ロード中（キャッシュが無く取得中） */
  isLoading: boolean;
  /** 背景での再取得中（キャッシュ表示のまま更新中） */
  isRefetching: boolean;
  /** 直近の取得エラー（成功で解消） */
  error: string | null;
  /** 手動取得。日次ガードを無視して即時再取得する。 */
  refetch: () => void;
}

/** seriesId に null を渡すと何も取得しない（その月に存在しない大会種別のスロット用）。 */
export function useFlagshipEvents(seriesId: number | null): UseFlagshipEvents {
  const [events, setEvents] = useState<FlagshipEvent[]>([]);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 進行中の取得を中断するためのコントローラ（シリーズ変更・アンマウント時）。
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (id: number, hadCache: boolean) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (hadCache) setIsRefetching(true);
      else setIsLoading(true);
      setError(null);

      try {
        const fetched = await fetchEvents(id, controller.signal);
        if (controller.signal.aborted) return;
        const saved = writeCache(id, fetched, new Date());
        setEvents(saved.events);
        setSyncedAt(saved.syncedAt);
      } catch (e) {
        if (controller.signal.aborted) return;
        // 失敗しても前回キャッシュは保持したまま、エラーだけ立てる。
        setError(e instanceof Error ? e.message : '取得に失敗しました');
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
          setIsRefetching(false);
        }
      }
    },
    [],
  );

  // シリーズ変更・マウント時: キャッシュを即反映し、鮮度が切れていれば自動取得。
  useEffect(() => {
    if (seriesId === null) {
      setEvents([]);
      setSyncedAt(null);
      setIsLoading(false);
      setIsRefetching(false);
      setError(null);
      return;
    }
    const now = new Date();
    const cache = readCache(seriesId);
    if (cache) {
      setEvents(cache.events);
      setSyncedAt(cache.syncedAt);
    } else {
      setEvents([]);
      setSyncedAt(null);
    }
    if (!isFresh(cache, now)) {
      void load(seriesId, cache !== null);
    }
    return () => abortRef.current?.abort();
  }, [seriesId, load]);

  const refetch = useCallback(() => {
    if (seriesId === null) return;
    void load(seriesId, readCache(seriesId) !== null);
  }, [seriesId, load]);

  return { events, syncedAt, isLoading, isRefetching, error, refetch };
}
