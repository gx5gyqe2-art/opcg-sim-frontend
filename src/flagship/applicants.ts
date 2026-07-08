/**
 * 開催の「申込人数」(TCG+ の抽選応募数 `count_applicants`) の取得（§16.13 / §16.14）。
 *
 * 申込人数は一覧APIに無く開催ごとの詳細取得が要る。そこで **募集中（now < applyEnd）の開催だけ**を
 * 対象に、**同時実行数を絞って**フロントから取得し、結果は **backend へ同期**して全端末で共有する
 * （保存は backend の開催マスター＝§16.14。フロントは取得役）。取得は「取得」ボタン契機で頻度を抑える。
 */
import { fetchApplicantCount, type FlagshipEvent } from './tcgPlusClient';

const CONCURRENCY = 8;

/** 募集中（応募受付中）＝ now < applyEnd。applyEnd が無ければ対象外。 */
export function isRecruiting(ev: { applyEnd: string }, now: Date): boolean {
  if (!ev.applyEnd) return false;
  const t = new Date(ev.applyEnd).getTime();
  return !Number.isNaN(t) && t > now.getTime();
}

/** 募集中の開催の id を返す（申込人数の取得対象）。 */
export function recruitingIds(events: FlagshipEvent[], now: Date): number[] {
  return events.filter((e) => isRecruiting(e, now)).map((e) => e.id);
}

/**
 * 指定 id 群の申込人数を TCG+ から並列（同時数制限）取得する。1件ごとに onEach で進捗反映し、
 * 取得できた {id: count} を返す（呼び出し側が backend へ sync する）。
 */
export async function fetchApplicantsFor(
  ids: number[],
  onEach: (id: number, count: number | null) => void,
  signal?: AbortSignal,
): Promise<Record<number, number | null>> {
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
  return got;
}
