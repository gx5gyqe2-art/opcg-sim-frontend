import React, { useEffect, useMemo, useState } from 'react';
import { DEFAULT_SERIES_ID, SERIES } from './flagship.config';
import { useFlagshipEvents } from './useFlagshipEvents';
import type { FlagshipEvent } from './tcgPlusClient';

/**
 * フラッグシップバトル 開催一覧（P1）。
 *
 * BANDAI TCG+ から開催マスターを取得して一覧表示する。取得は自動（画面表示時、
 * 日次ガード付き）＋手動（「取得」ボタン、ガード無視）。結果（優勝リーダー・回収状況）は
 * P2 以降で埋まる。それまで終了した開催は「未回収」として表示する。
 */

interface FlagshipEventsProps {
  onBack: () => void;
}

type Status = 'missing' | 'today' | 'upcoming';

const STATUS_LABEL: Record<Status, string> = {
  missing: '未回収',
  today: '本日開催',
  upcoming: '開催前',
};

const WD = ['日', '月', '火', '水', '木', '金', '土'];

/** その日を含む週（月曜始まり）の月曜日を YYYY-MM-DD で返す。 */
function weekOf(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function statusOf(date: string, today: string): Status {
  if (date < today) return 'missing';
  if (date === today) return 'today';
  return 'upcoming';
}

function formatSynced(iso: string | null): string {
  if (!iso) return '未取得';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '未取得';
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const FlagshipEvents: React.FC<FlagshipEventsProps> = ({ onBack }) => {
  const [seriesId, setSeriesId] = useState<number>(DEFAULT_SERIES_ID);
  const { events, syncedAt, isLoading, isRefetching, error, refetch } = useFlagshipEvents(seriesId);

  const [q, setQ] = useState('');
  const [pref, setPref] = useState('');
  const [week, setWeek] = useState('');
  const [status, setStatus] = useState<Status | ''>('');
  const [selected, setSelected] = useState<FlagshipEvent | null>(null);

  // 実運用時の当日。開催日との比較にのみ使う。
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // シリーズ切り替え時は絞り込みと選択もリセットする。
  const changeSeries = (id: number) => {
    setSeriesId(id);
    setQ('');
    setPref('');
    setWeek('');
    setStatus('');
    setSelected(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const prefs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events) counts.set(e.pref, (counts.get(e.pref) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [events]);

  const weeks = useMemo(() => {
    const set = new Set(events.map((e) => weekOf(e.date)));
    return [...set].sort();
  }, [events]);

  const kpi = useMemo(() => {
    let past = 0, todayCount = 0, upcoming = 0;
    for (const e of events) {
      const s = statusOf(e.date, today);
      if (s === 'missing') past++;
      else if (s === 'today') todayCount++;
      else upcoming++;
    }
    return { total: events.length, past, today: todayCount, upcoming };
  }, [events, today]);

  const filtered = useMemo(() => {
    return events.filter((e) =>
      (!q || e.store.includes(q)) &&
      (!pref || e.pref === pref) &&
      (!week || weekOf(e.date) === week) &&
      (!status || statusOf(e.date, today) === status),
    );
  }, [events, q, pref, week, status, today]);

  const chipDefs: Array<[Status | '', string]> = [
    ['', 'すべて'],
    ['missing', '未回収'],
    ['today', '本日'],
    ['upcoming', '開催前'],
  ];

  // 日付見出しを挟んで行を構築。
  const rows: React.ReactNode[] = [];
  let lastDate = '';
  for (const e of filtered) {
    if (e.date !== lastDate) {
      lastDate = e.date;
      const d = new Date(`${e.date}T00:00:00`);
      rows.push(
        <tr key={`h-${e.date}`} className="fs-datehead">
          <td colSpan={7}>
            {d.getMonth() + 1}月{d.getDate()}日({WD[d.getDay()]}){e.date === today ? ' — 本日' : ''}
          </td>
        </tr>,
      );
    }
    const s = statusOf(e.date, today);
    rows.push(
      <tr key={e.id} onClick={() => setSelected(e)}>
        <td className="fs-dt"><b>{e.startDatetime.slice(11, 16)}</b></td>
        <td className="fs-store"><span className="fs-name">{e.store}</span></td>
        <td className="fs-pref">{e.pref}</td>
        <td className="fs-cap">{e.capacity ?? '—'}</td>
        <td><span className={`fs-badge fs-${s}`}>{STATUS_LABEL[s]}</span></td>
        <td className="fs-winner"><span className="fs-dim">—</span></td>
        <td className="fs-links">
          {e.snsUrl
            ? <a className="fs-xlink" href={e.snsUrl} target="_blank" rel="noopener noreferrer" onClick={(ev) => ev.stopPropagation()}>店舗X ↗</a>
            : <span className="fs-dim" style={{ fontSize: 12 }}>X未登録</span>}
        </td>
      </tr>,
    );
  }

  return (
    <div className="fs-root">
      <FlagshipStyles />
      <div className="fs-frame">
        <div className="fs-topbar">
          <div>
            <div className="fs-eyebrow">OPCG SIM — FLAGSHIP</div>
            <h1 className="fs-h1">フラッグシップバトル 開催一覧</h1>
          </div>
          <div className="fs-spacer" />
          <span className="fs-synced">開催マスター同期: {formatSynced(syncedAt)}</span>
          <button className="fs-btn" onClick={refetch} disabled={isLoading || isRefetching}>
            {isRefetching || isLoading ? '取得中…' : '↻ 取得'}
          </button>
          <button className="fs-btn ghost" onClick={onBack}>← 戻る</button>
        </div>

        <div className="fs-series-row">
          <label className="fs-dim" htmlFor="fs-series">開催期</label>
          <select id="fs-series" value={seriesId} onChange={(e) => changeSeries(Number(e.target.value))}>
            {SERIES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>

        {error && (
          <div className="fs-error" role="alert">
            取得に失敗しました（{error}）。{syncedAt ? `前回データ(${formatSynced(syncedAt)}時点)を表示中。` : ''}
          </div>
        )}

        <div className="fs-kpis">
          <Kpi label="総開催" value={kpi.total} sub={SERIES.find((s) => s.id === seriesId)?.label ?? ''} />
          <Kpi label="終了した開催" value={kpi.past} sub="結果登録は今後対応(P2)" />
          <Kpi label="本日開催" value={kpi.today} sub="開催中の店舗" />
          <Kpi label="開催前" value={kpi.upcoming} sub="これから開催" />
        </div>

        <div className="fs-filters">
          <input type="search" placeholder="店舗名で検索" aria-label="店舗名で検索" value={q} onChange={(e) => setQ(e.target.value)} />
          <select aria-label="都道府県で絞り込み" value={pref} onChange={(e) => setPref(e.target.value)}>
            <option value="">全都道府県</option>
            {prefs.map(([p, n]) => (
              <option key={p} value={p}>{p} ({n})</option>
            ))}
          </select>
          <select aria-label="週で絞り込み" value={week} onChange={(e) => setWeek(e.target.value)}>
            <option value="">全期間</option>
            {weeks.map((w, i) => {
              const end = new Date(`${w}T00:00:00`); end.setDate(end.getDate() + 6);
              const f = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
              return <option key={w} value={w}>第{i + 1}週 ({f(new Date(`${w}T00:00:00`))}〜{f(end)})</option>;
            })}
          </select>
          <div className="fs-chips" role="group" aria-label="状況で絞り込み">
            {chipDefs.map(([v, label]) => (
              <button
                key={v || 'all'}
                className="fs-chip"
                aria-pressed={status === v}
                onClick={() => setStatus(v)}
              >{label}</button>
            ))}
          </div>
          <span className="fs-count">{filtered.length} 件</span>
        </div>

        <div className="fs-tablewrap">
          <div className="fs-scroller">
            <table>
              <thead>
                <tr>
                  <th>開催日時</th><th>店舗</th><th>都道府県</th><th style={{ textAlign: 'right' }}>定員</th>
                  <th>状況</th><th>優勝リーダー</th><th style={{ textAlign: 'right' }}>リンク</th>
                </tr>
              </thead>
              <tbody>
                {rows.length > 0 ? rows : (
                  <tr>
                    <td colSpan={7} className="fs-dim" style={{ padding: 20, textAlign: 'center' }}>
                      {isLoading ? '開催データを取得中…' : '該当する開催がありません'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="fs-footnote">
          開催データは BANDAI TCG+ から取得した実データ。優勝リーダー・回収状況は結果登録機能(P2)の実装後に反映される。
          「取得」ボタンで最新の開催マスターを再取得できる（自動取得は前回から24時間経過時）。
        </p>
      </div>

      {selected && <DetailPanel event={selected} today={today} onClose={() => setSelected(null)} />}
    </div>
  );
};

const Kpi: React.FC<{ label: string; value: number; sub: string }> = ({ label, value, sub }) => (
  <div className="fs-kpi">
    <div className="fs-kpi-label">{label}</div>
    <div className="fs-kpi-value">{value}</div>
    <div className="fs-kpi-sub">{sub}</div>
  </div>
);

const DetailPanel: React.FC<{ event: FlagshipEvent; today: string; onClose: () => void }> = ({ event, today, onClose }) => {
  const d = new Date(`${event.date}T00:00:00`);
  const s = statusOf(event.date, today);
  return (
    <>
      <div className="fs-overlay" onClick={onClose} />
      <aside className="fs-panel" aria-label="開催詳細">
        <button className="fs-close" aria-label="閉じる" onClick={onClose}>✕</button>
        <div className="fs-eyebrow">開催詳細 — #{event.id}</div>
        <h2 className="fs-panel-h2">{event.store}</h2>
        <span className={`fs-badge fs-${s}`}>{STATUS_LABEL[s]}</span>
        <dl className="fs-dl">
          <dt>開催日時</dt>
          <dd>{d.getMonth() + 1}月{d.getDate()}日({WD[d.getDay()]}) {event.startDatetime.slice(11, 16)}</dd>
          <dt>都道府県</dt><dd>{event.pref}</dd>
          <dt>定員</dt><dd>{event.capacity ?? '—'} 名</dd>
          <dt>店舗X</dt>
          <dd>{event.snsUrl
            ? <a className="fs-xlink" href={event.snsUrl} target="_blank" rel="noopener noreferrer">{event.snsUrl.replace('https://', '')} ↗</a>
            : <span className="fs-dim">未登録</span>}</dd>
        </dl>
        <section className="fs-section">
          <h3>結果</h3>
          <p className="fs-dim" style={{ margin: 0 }}>
            結果の登録・閲覧（優勝リーダーの抽出、結果ポストURLの投入）は次フェーズ(P2)で対応する。
            {event.snsUrl && '店舗Xリンクから結果ポストを確認できる。'}
          </p>
        </section>
      </aside>
    </>
  );
};

const FlagshipStyles: React.FC = () => (
  <style>{`
    .fs-root {
      height: 100%; overflow-y: auto; background: #0b0908; color: #f0e6d2;
      font-family: Inter, system-ui, "Hiragino Sans", "Noto Sans JP", sans-serif;
      font-size: 14px; line-height: 1.6; box-sizing: border-box;
    }
    .fs-root * { box-sizing: border-box; }
    .fs-frame { max-width: 1080px; margin: 0 auto; padding: 20px 20px 64px; }
    .fs-topbar { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; padding: 6px 2px 14px; border-bottom: 1px solid #2e261c; }
    .fs-eyebrow { font-size: 11px; letter-spacing: .18em; color: #f1c40f; font-weight: 600; }
    .fs-h1 { font-size: 20px; margin: 0; font-weight: 700; letter-spacing: .02em; }
    .fs-spacer { flex: 1; }
    .fs-synced { font-size: 12px; color: #6f6553; align-self: center; }
    .fs-btn { background: transparent; border: 1px solid #8a6d0b; color: #f1c40f; border-radius: 6px; padding: 6px 14px; font-size: 13px; cursor: pointer; font-family: inherit; align-self: center; }
    .fs-btn:hover:not(:disabled) { background: #f1c40f; color: #0b0908; }
    .fs-btn:disabled { opacity: .55; cursor: default; }
    .fs-btn.ghost { border-color: #2e261c; color: #a89a80; }
    .fs-btn.ghost:hover { background: rgba(255,255,255,.05); color: #f0e6d2; }
    .fs-series-row { display: flex; align-items: center; gap: 10px; margin: 14px 0 0; flex-wrap: wrap; }
    .fs-root select, .fs-root input[type="search"] { background: #1e1812; color: #f0e6d2; border: 1px solid #2e261c; border-radius: 6px; padding: 6px 10px; font-size: 13px; font-family: inherit; }
    .fs-root select:focus-visible, .fs-root input:focus-visible, .fs-root button:focus-visible { outline: 2px solid #f1c40f; outline-offset: 1px; }
    .fs-error { margin: 14px 0 0; padding: 8px 12px; border: 1px solid #8a4b1c; background: rgba(230,126,34,.12); color: #e6b98a; border-radius: 6px; font-size: 13px; }
    .fs-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0; }
    .fs-kpi { background: #16120e; border: 1px solid #2e261c; border-radius: 8px; padding: 12px 14px 10px; }
    .fs-kpi-label { font-size: 11px; letter-spacing: .12em; color: #a89a80; font-weight: 600; }
    .fs-kpi-value { font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.25; }
    .fs-kpi-sub { font-size: 11px; color: #6f6553; }
    .fs-filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin: 0 0 12px; }
    .fs-chips { display: flex; gap: 6px; flex-wrap: wrap; }
    .fs-chip { background: #1e1812; border: 1px solid #2e261c; color: #a89a80; border-radius: 999px; padding: 4px 12px; font-size: 12px; cursor: pointer; font-family: inherit; }
    .fs-chip[aria-pressed="true"] { background: #f1c40f; border-color: #f1c40f; color: #0b0908; font-weight: 700; }
    .fs-count { margin-left: auto; font-size: 12px; color: #6f6553; font-variant-numeric: tabular-nums; }
    .fs-tablewrap { border: 1px solid #2e261c; border-radius: 8px; overflow: hidden; background: #16120e; }
    .fs-scroller { overflow-x: auto; }
    .fs-root table { border-collapse: collapse; width: 100%; min-width: 720px; }
    .fs-root thead th { text-align: left; font-size: 11px; letter-spacing: .1em; color: #a89a80; font-weight: 600; padding: 9px 12px; border-bottom: 1px solid #2e261c; background: #1e1812; position: sticky; top: 0; }
    .fs-root tbody td { padding: 8px 12px; border-bottom: 1px solid #241e16; vertical-align: middle; }
    .fs-root tbody tr:not(.fs-datehead) { cursor: pointer; }
    .fs-root tbody tr:not(.fs-datehead):hover { background: rgba(241,196,15,.05); }
    .fs-dt { white-space: nowrap; font-variant-numeric: tabular-nums; color: #a89a80; }
    .fs-dt b { color: #f0e6d2; font-weight: 600; }
    .fs-store { max-width: 300px; }
    .fs-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; max-width: 300px; }
    .fs-pref { white-space: nowrap; color: #a89a80; }
    .fs-cap { text-align: right; font-variant-numeric: tabular-nums; color: #a89a80; }
    .fs-winner, .fs-links { white-space: nowrap; }
    .fs-links { text-align: right; }
    .fs-datehead td { background: #1e1812; color: #f1c40f; font-size: 12px; font-weight: 700; letter-spacing: .06em; padding: 6px 12px; border-bottom: 1px solid #2e261c; position: sticky; top: 34px; }
    .fs-badge { display: inline-flex; align-items: center; gap: 5px; border-radius: 4px; font-size: 11px; font-weight: 700; padding: 2px 8px; letter-spacing: .04em; white-space: nowrap; }
    .fs-badge::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .fs-missing { color: #e67e22; background: rgba(230,126,34,.14); }
    .fs-today { color: #f1c40f; background: rgba(241,196,15,.12); }
    .fs-upcoming { color: #8a8577; background: rgba(138,133,119,.12); }
    .fs-dim { color: #6f6553; }
    .fs-xlink { color: #a89a80; text-decoration: none; border: 1px solid #2e261c; border-radius: 4px; padding: 2px 8px; font-size: 12px; }
    .fs-xlink:hover { color: #f1c40f; border-color: #8a6d0b; }
    .fs-footnote { margin-top: 14px; font-size: 11px; color: #6f6553; line-height: 1.7; }
    .fs-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.55); z-index: 9; }
    .fs-panel { position: fixed; top: 0; right: 0; bottom: 0; width: min(430px, 92vw); background: #16120e; border-left: 1px solid #2e261c; overflow-y: auto; padding: 20px; z-index: 10; }
    .fs-panel-h2 { font-size: 16px; margin: 4px 0 8px; }
    .fs-close { position: absolute; top: 12px; right: 12px; background: none; border: none; color: #a89a80; font-size: 18px; cursor: pointer; }
    .fs-dl { display: grid; grid-template-columns: 84px 1fr; gap: 4px 10px; margin: 14px 0; font-size: 13px; }
    .fs-dl dt { color: #6f6553; }
    .fs-dl dd { margin: 0; }
    .fs-section { border-top: 1px solid #2e261c; padding-top: 14px; margin-top: 14px; }
    .fs-section h3 { font-size: 11px; letter-spacing: .14em; color: #f1c40f; margin: 0 0 8px; font-weight: 700; }
    @media (max-width: 760px) { .fs-kpis { grid-template-columns: repeat(2, 1fr); } .fs-frame { padding: 14px 12px 48px; } }
  `}</style>
);
