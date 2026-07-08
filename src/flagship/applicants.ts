/**
 * 開催の「申込人数」(TCG+ の抽選応募数 `count_applicants`) の取得とキャッシュ（§16.13）。
 *
 * 申込人数は一覧APIに無く開催ごとの詳細取得が要る＝件数が多い。そこで **募集中（now < applyEnd）の
 * 開催だけ**を対象に、**同時実行数を絞って**取得し、localStorage に日次キャッシュする。取得は
 * 開催マスターの「取得」タイミングに合わせて手動起点で走らせ、頻度を抑える。
 */
import { fetchApplicantCount, type FlagshipEvent } from './tcgPlusClient';

const KEY = 'opcg_flagship_v1_applicants';
const TTL_MS = 24 * 60 * 60 * 1000;
const CONCURRENCY = 8;

interface ApplicantCache {
  counts: Record<number, number | null>;
  syncedAt: string;
}

export function readApplicantCache(): Record<number, number | null> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as ApplicantCache;
    return p && p.counts && typeof p.counts === 'object' ? p.counts : {};
  } catch {
    return {};
  }
}

/** キャッシュが鮮度内か（TTL 内なら再取得不要）。 */
export function isApplicantCacheFresh(now: Date): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const p = JSON.parse(raw) as ApplicantCache;
    const t = new Date(p.syncedAt).getTime();
    return !Number.isNaN(t) && now.getTime() - t < TTL_MS;
  } catch {
    return false;
  }
}

/** 募集中（応募受付中）＝ now < applyEnd。applyEnd が無ければ対象外。 */
export function isRecruiting(ev: { applyEnd: string }, now: Date): boolean {
  if (!ev.applyEnd) return false;
  const t = new Date(ev.applyEnd).getTime();
  return !Number.isNaN(t) && t > now.getTime();
}

/**
 * 指定 id 群の申込人数を TCG+ から並列（同時数制限）取得する。1件ごとに onEach で進捗反映し、
 * 完了時に localStorage キャッシュへマージ保存する。
 */
export async function fetchApplicantsFor(
  ids: number[], now: Date,
  onEach: (id: number, count: number | null) => void,
  signal?: AbortSignal,
): Promise<void> {
  const got: Record<number, number | null> = {};
  let i = 0;
  async function worker(): Promise<void> {
    while (i < ids.length) {
      if (signal?.aborted) return;
      const id = ids[i++];
      const c = await fetchApplicantCount(id, signal);
      got[id] = c;
      onEach(id, c);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, ids.length) }, () => worker()),
  );
  if (signal?.aborted) return;
  try {
    const merged = { ...readApplicantCache(), ...got };
    localStorage.setItem(KEY, JSON.stringify({ counts: merged, syncedAt: now.toISOString() }));
  } catch {
    /* 容量超過等は無視 */
  }
}

/** 募集中の開催の id を返す（申込人数の取得対象）。 */
export function recruitingIds(events: FlagshipEvent[], now: Date): number[] {
  return events.filter((e) => isRecruiting(e, now)).map((e) => e.id);
}
