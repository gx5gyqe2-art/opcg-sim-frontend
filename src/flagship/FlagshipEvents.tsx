import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FlagshipSeries } from './flagship.config';
import {
  groupByMonth, kindShort, loadSeriesList, pickDefaultMonth, refreshSeriesList,
} from './seriesDiscovery';
import { useFlagshipEvents } from './useFlagshipEvents';
import type { FlagshipEvent } from './tcgPlusClient';
import {
  deleteEventResults, extractFromText, fetchEventResults, fetchLeaders, ingestFromUrl,
  fetchSeriesSummary, putEventResults, fetchDiscoverStatus, discoverPosts,
  collectPosts, fetchLinkReview, linkApprove, setStoreSns,
} from './resultsClient';
import type {
  DiscoveredCandidate, ExtractedEntry, FlagshipLeader, SummaryItem, ReviewPost,
} from './resultsClient';

/**
 * フラッグシップバトル 開催一覧（P1）+ 結果登録・閲覧（P2）。
 *
 * 開催マスターは BANDAI TCG+ から直接取得（自動=日次ガード付き／手動=「取得」ボタン）。
 * 結果（優勝リーダー・回収状況）は opcg-sim-backend の flagship API から取得し一覧へ
 * 重ねる。バックエンド不達時は P1 相当の表示（全件未回収）へ静かにフォールバックし、
 * 開催一覧の閲覧機能は損なわない。結果の登録・削除は詳細パネルのフォームから行う。
 */

interface FlagshipEventsProps {
  onBack: () => void;
}

type Status = 'collected' | 'missing' | 'today' | 'upcoming';

const STATUS_LABEL: Record<Status, string> = {
  collected: '回収済',
  missing: '未回収',
  today: '本日開催',
  upcoming: '開催前',
};

const WD = ['日', '月', '火', '水', '木', '金', '土'];

/** 種別タグ付きの開催。同月のフラッグシップ+エクストラを1つの一覧に統合するための形。 */
interface MergedEvent extends FlagshipEvent {
  /** この開催が属する開催期（結果登録時に backend へ同送する） */
  seriesId: number;
  /** 大会種別名（フラッグシップバトル / エクストラグランドバトル） */
  kind: string;
}

/**
 * ローカルタイム（JST 運用）の YYYY-MM-DD を返す。TCG+ の開催日時は JST ローカルのため、
 * toISOString()（UTC）で日付文字列を作ると JST 午前は前日にズレる。日付比較はこれで揃える。
 */
function localDate(d: Date): string {
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** その日を含む週（月曜始まり）の月曜日を YYYY-MM-DD で返す。 */
function weekOf(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localDate(d);
}

/** 開催日ベースの状況（結果の有無は関与しない）。 */
function baseStatus(date: string, today: string): 'missing' | 'today' | 'upcoming' {
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

/** 一覧・詳細で使う優勝リーダーの表示名（辞書解決済みなら正規名、なければ raw）。 */
function winnerLabel(item: SummaryItem | undefined): string | null {
  const w = item?.winner;
  if (!w) return null;
  return w.leader ? w.leader.name : (w.leaderRaw ?? null);
}

export const FlagshipEvents: React.FC<FlagshipEventsProps> = ({ onBack }) => {
  // 開催期一覧は「静的設定 + 発見済みキャッシュ」で即表示し、裏で自動発見を回して更新する。
  // セレクタは月単位: 同じ月のフラッグシップとエクストラグランドバトルを1つの一覧に統合する。
  const [seriesList, setSeriesList] = useState<FlagshipSeries[]>(() => loadSeriesList());
  const months = useMemo(() => groupByMonth(seriesList), [seriesList]);
  const [month, setMonth] = useState<number>(() => pickDefaultMonth(groupByMonth(loadSeriesList()), new Date()));
  const current = months.find((m) => m.month === month) ?? months[0];

  // 種別ごとの開催期スロット（無い月は null → フックは何もしない）
  const fsSeries = current?.series.find((s) => s.kind === 'フラッグシップバトル') ?? null;
  const exSeries = current?.series.find((s) => s.kind === 'エクストラグランドバトル') ?? null;
  const fs = useFlagshipEvents(fsSeries?.id ?? null);
  const ex = useFlagshipEvents(exSeries?.id ?? null);

  // 統合一覧（開催日時順）。各行に seriesId / kind をタグ付けする。
  const events: MergedEvent[] = useMemo(() => {
    const tag = (list: FlagshipEvent[], series: FlagshipSeries | null): MergedEvent[] =>
      series ? list.map((e) => ({ ...e, seriesId: series.id, kind: series.kind })) : [];
    return [...tag(fs.events, fsSeries), ...tag(ex.events, exSeries)]
      .sort((a, b) => a.startDatetime.localeCompare(b.startDatetime));
  }, [fs.events, ex.events, fsSeries, exSeries]);

  const isLoading = fs.isLoading || ex.isLoading;
  const isRefetching = fs.isRefetching || ex.isRefetching;
  const error = fs.error ?? ex.error;
  const syncedAt = [fs.syncedAt, ex.syncedAt].filter((x): x is string => !!x).sort().pop() ?? null;

  useEffect(() => {
    let alive = true;
    refreshSeriesList().then((l) => { if (alive) setSeriesList(l); }).catch(() => { /* 静的設定で継続 */ });
    return () => { alive = false; };
  }, []);

  // 手動「取得」は両種別の開催マスターに加えて開催期の発見も強制更新する。
  const onRefetch = () => {
    fs.refetch();
    ex.refetch();
    refreshSeriesList(true).then(setSeriesList).catch(() => { /* 静的設定で継続 */ });
  };

  // 開催マスターのみ再取得（日次ガード無視）。店舗X 登録後に /events の overlay 済み sns を
  // 一覧＋キャッシュへ流し込むために使う（キャッシュ任せだと登録が反映されずリロードで消えて見える）。
  const refetchEvents = () => {
    fs.refetch();
    ex.refetch();
  };

  const [q, setQ] = useState('');
  // 都道府県は複数選択（空集合＝全都道府県）。
  const [prefSet, setPrefSet] = useState<Set<string>>(new Set());
  const [week, setWeek] = useState('');
  const [status, setStatus] = useState<Status | ''>('');
  const [kindFilter, setKindFilter] = useState('');
  const [selected, setSelected] = useState<MergedEvent | null>(null);

  // P2: 結果オーバーレイ（eventId → サマリ）とリーダー辞書。不達時は backendOk=false で P1 表示。
  const [summary, setSummary] = useState<Map<number, SummaryItem>>(new Map());
  const [leaders, setLeaders] = useState<FlagshipLeader[]>([]);
  const [backendOk, setBackendOk] = useState(true);

  // §16.9: 一覧行から店舗X を直接登録（店名キーで表示を上書き＝同店の全行に反映）。
  const [snsOverrides, setSnsOverrides] = useState<Map<string, string | null>>(new Map());
  const [editSnsStore, setEditSnsStore] = useState<string | null>(null);
  const [rowSnsInput, setRowSnsInput] = useState('');
  const [rowSnsBusy, setRowSnsBusy] = useState(false);

  // 店舗X 保存後の共通反映: 一覧の即時上書き（session内）＋ /events 再取得（overlay 済みを
  // キャッシュへ反映しリロードでも残す）。詳細パネル・行登録の両方から呼ぶ。
  const onSnsSaved = (store: string, url: string | null) => {
    setSnsOverrides((m) => new Map(m).set(store, url));
    refetchEvents();
  };

  const saveRowSns = async (store: string) => {
    setRowSnsBusy(true);
    try {
      const v = await setStoreSns(store, rowSnsInput.trim());
      setEditSnsStore(null);
      onSnsSaved(store, v);
    } catch { /* 失敗時は編集のまま */ } finally {
      setRowSnsBusy(false);
    }
  };

  useEffect(() => {
    fetchLeaders().then(setLeaders).catch(() => setBackendOk(false));
  }, []);

  const seriesIds = useMemo(() => (current?.series ?? []).map((s) => s.id), [current]);
  const loadSummary = useCallback(() => {
    Promise.all(seriesIds.map((id) => fetchSeriesSummary(id)))
      .then((maps) => {
        setSummary(new Map(maps.flatMap((m) => [...m])));
        setBackendOk(true);
      })
      .catch(() => { setSummary(new Map()); setBackendOk(false); });
  }, [seriesIds]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  // 実運用時の当日（JST ローカル）。開催日との比較にのみ使う。UTC で作ると午前は前日にズレる。
  const today = useMemo(() => localDate(new Date()), []);

  const statusOf = useCallback((e: MergedEvent): Status => {
    if (summary.has(e.id)) return 'collected';
    return baseStatus(e.date, today);
  }, [summary, today]);

  // 月の切り替え時は絞り込みと選択もリセットする。
  const changeMonth = (m: number) => {
    setMonth(m);
    setQ('');
    setPrefSet(new Set());
    setWeek('');
    setStatus('');
    setKindFilter('');
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
    let past = 0, collected = 0;
    for (const e of events) {
      if (baseStatus(e.date, today) === 'missing' || summary.has(e.id)) past++;
      if (summary.has(e.id)) collected++;
    }
    const missing = past - collected;
    const rate = past > 0 ? Math.round((collected / past) * 100) : 0;
    return { total: events.length, past, collected, missing, rate };
  }, [events, summary, today]);

  // P4/§16.7: 一覧 / 集計 / 紐付け のビュー切替。
  const [view, setView] = useState<'list' | 'agg' | 'link'>('list');
  // §16.7: 収集＝検索が使えるか（鍵未設定なら紐付け導線を隠す）。
  const [linkEnabled, setLinkEnabled] = useState(false);
  useEffect(() => {
    let alive = true;
    fetchDiscoverStatus().then((ok) => { if (alive) setLinkEnabled(ok); });
    return () => { alive = false; };
  }, []);

  // P4: 優勝リーダー分布。summary（月内の全開催期分＝優勝リーダー入り）を束ねるだけ。
  const distribution = useMemo(() => {
    const byLeader = new Map<string, { name: string; color: string; count: number }>();
    let withWinner = 0;
    for (const it of summary.values()) {
      const w = it.winner;
      if (!w) continue;
      withWinner++;
      const key = w.leaderCardNumber ?? `raw:${w.leaderRaw ?? ''}`;
      const name = w.leader?.name ?? w.leaderRaw ?? '不明';
      const color = w.leader?.color ?? '';
      const cur = byLeader.get(key);
      if (cur) cur.count += 1;
      else byLeader.set(key, { name, color, count: 1 });
    }
    const rows = [...byLeader.values()]
      .sort((a, b) => b.count - a.count)
      .map((r) => ({ ...r, pct: withWinner ? Math.round((r.count / withWinner) * 1000) / 10 : 0 }));
    return { rows, withWinner };
  }, [summary]);

  const filtered = useMemo(() => {
    return events.filter((e) =>
      (!q || e.store.includes(q)) &&
      (prefSet.size === 0 || prefSet.has(e.pref)) &&
      (!week || weekOf(e.date) === week) &&
      (!status || statusOf(e) === status) &&
      (!kindFilter || e.kind === kindFilter),
    );
  }, [events, q, prefSet, week, status, statusOf, kindFilter]);

  const chipDefs: Array<[Status | '', string]> = [
    ['', 'すべて'],
    ['missing', '未回収'],
    ['collected', '回収済'],
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
          <td colSpan={8}>
            {d.getMonth() + 1}月{d.getDate()}日({WD[d.getDay()]}){e.date === today ? ' — 本日' : ''}
          </td>
        </tr>,
      );
    }
    const s = statusOf(e);
    const winner = winnerLabel(summary.get(e.id));
    rows.push(
      <tr key={e.id} onClick={() => setSelected(e)}>
        <td className="fs-dt"><b>{e.startDatetime.slice(11, 16)}</b></td>
        <td className="fs-store"><span className="fs-name">{e.store}</span></td>
        <td><span className={`fs-kind ${e.kind === 'エクストラグランドバトル' ? 'fs-kind-ex' : 'fs-kind-fs'}`}>{kindShort(e.kind)}</span></td>
        <td className="fs-pref">{e.pref}</td>
        <td className="fs-cap">{e.capacity ?? '—'}</td>
        <td><span className={`fs-badge fs-${s}`}>{STATUS_LABEL[s]}</span></td>
        <td className="fs-winner">{winner ?? <span className="fs-dim">—</span>}</td>
        <td className="fs-links" onClick={(ev) => ev.stopPropagation()}>
          {editSnsStore === e.store ? (
            <span className="fs-sns">
              <input
                className="fs-sns-input fs-sns-input-sm" type="text" autoFocus value={rowSnsInput}
                placeholder="@handle / URL"
                onChange={(ev) => setRowSnsInput(ev.target.value)}
                onKeyDown={(ev) => { if (ev.key === 'Enter') saveRowSns(e.store); }}
              />
              <button className="fs-btn ghost" disabled={rowSnsBusy} onClick={() => saveRowSns(e.store)}>{rowSnsBusy ? '…' : '保存'}</button>
              <button className="fs-linklike" onClick={() => setEditSnsStore(null)}>取消</button>
            </span>
          ) : (snsOverrides.has(e.store) ? snsOverrides.get(e.store) : e.snsUrl) ? (
            <a className="fs-xlink" href={(snsOverrides.get(e.store) ?? e.snsUrl) as string} target="_blank" rel="noopener noreferrer">店舗X ↗</a>
          ) : (
            <button className="fs-xreg" onClick={() => { setEditSnsStore(e.store); setRowSnsInput(''); }}>X登録</button>
          )}
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
            <h1 className="fs-h1">大会開催一覧</h1>
          </div>
          <div className="fs-spacer" />
          <span className="fs-synced">開催マスター同期: {formatSynced(syncedAt)}</span>
          <button className="fs-btn" onClick={onRefetch} disabled={isLoading || isRefetching}>
            {isRefetching || isLoading ? '取得中…' : '↻ 取得'}
          </button>
          <button className="fs-btn ghost" onClick={onBack}>← 戻る</button>
        </div>

        <div className="fs-series-row">
          <label className="fs-dim" htmlFor="fs-series">開催期</label>
          <select id="fs-series" value={month} onChange={(e) => changeMonth(Number(e.target.value))}>
            {months.map((m) => (
              <option key={m.month} value={m.month}>{m.label}</option>
            ))}
          </select>
          <select aria-label="大会種別で絞り込み" value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
            <option value="">すべての大会</option>
            {(current?.series ?? []).map((s) => (
              <option key={s.kind} value={s.kind}>{s.kind}</option>
            ))}
          </select>
          <div className="fs-viewtoggle" role="group" aria-label="表示切替">
            <button className="fs-vbtn" aria-pressed={view === 'list'} onClick={() => setView('list')}>一覧</button>
            <button className="fs-vbtn" aria-pressed={view === 'agg'} onClick={() => setView('agg')}>集計</button>
            {linkEnabled && (
              <button className="fs-vbtn" aria-pressed={view === 'link'} onClick={() => setView('link')}>紐付け</button>
            )}
          </div>
          {!backendOk && <span className="fs-dim" style={{ fontSize: 12 }}>結果APIに接続できないため回収状況は非表示</span>}
        </div>

        {error && (
          <div className="fs-error" role="alert">
            取得に失敗しました（{error}）。{syncedAt ? `前回データ(${formatSynced(syncedAt)}時点)を表示中。` : ''}
          </div>
        )}

        {/* KPI 枠は集計タブのみに表示（一覧タブは一覧だけ）。 */}
        {view === 'agg' && (
          <div className="fs-kpis">
            <Kpi label="総開催" value={kpi.total} sub={`${current?.label ?? ''} ${(current?.series ?? []).map((s) => kindShort(s.kind)).join(' + ')}`} />
            <Kpi label="終了した開催" value={kpi.past} sub="結果の回収対象" />
            <Kpi label="回収済" value={kpi.collected} sub={`回収率 ${kpi.rate}%`} />
            <Kpi label="未回収" value={kpi.missing} sub="結果ポスト待ち" />
          </div>
        )}

        {view === 'agg' && (
          <AggregateView
            distribution={distribution}
            monthLabel={current?.label ?? ''}
            kinds={(current?.series ?? []).map((s) => kindShort(s.kind)).join(' + ')}
            backendOk={backendOk}
          />
        )}

        {view === 'link' && (
          <LinkView events={events} seriesIds={seriesIds} onSaved={loadSummary} />
        )}

        {view === 'list' && <>
        <div className="fs-filters">
          <input type="search" placeholder="店舗名で検索" aria-label="店舗名で検索" value={q} onChange={(e) => setQ(e.target.value)} />
          <PrefFilter prefs={prefs} selected={prefSet} onChange={setPrefSet} />
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
                  <th>開催日時</th><th>店舗</th><th>大会</th><th>都道府県</th><th style={{ textAlign: 'right' }}>定員</th>
                  <th>状況</th><th>優勝リーダー</th><th style={{ textAlign: 'right' }}>リンク</th>
                </tr>
              </thead>
              <tbody>
                {rows.length > 0 ? rows : (
                  <tr>
                    <td colSpan={8} className="fs-dim" style={{ padding: 20, textAlign: 'center' }}>
                      {isLoading ? '開催データを取得中…' : '該当する開催がありません'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="fs-footnote">
          開催データは BANDAI TCG+ から取得した実データ（「取得」ボタンで再取得、自動取得は前回から24時間経過時）。
          同じ月のフラッグシップバトルとエクストラグランドバトルを統合表示している（「大会」列・種別セレクタで区別）。
          結果（優勝リーダー・回収状況）は開催の行をクリックして登録・修正できる。結果ポスト本文からの候補生成（無料）にも対応。
        </p>
        </>}
      </div>

      {selected && (
        <DetailPanel
          key={selected.id}
          event={selected}
          today={today}
          leaders={leaders}
          summaryItem={summary.get(selected.id)}
          backendOk={backendOk}
          onClose={() => setSelected(null)}
          onSaved={loadSummary}
          onSnsSaved={onSnsSaved}
        />
      )}
    </div>
  );
};

/**
 * 都道府県の複数選択フィルタ（チェックボックス式ポップオーバー）。
 * 空集合＝全都道府県。ボタンには選択状況を要約表示する。
 */
const PrefFilter: React.FC<{
  prefs: Array<[string, number]>;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}> = ({ prefs, selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 外側クリック・Escape で閉じる。
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const toggle = (p: string) => {
    const next = new Set(selected);
    if (next.has(p)) next.delete(p); else next.add(p);
    onChange(next);
  };

  const arr = [...selected];
  const label = arr.length === 0 ? '全都道府県'
    : arr.length === 1 ? arr[0]
    : `${arr[0]} 他${arr.length - 1}件`;

  return (
    <div className="fs-multi" ref={ref}>
      <button
        type="button" className="fs-multi-btn"
        aria-haspopup="listbox" aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{label}</span>
        <span className="fs-multi-caret">▾</span>
      </button>
      {open && (
        <div className="fs-multi-pop" role="group" aria-label="都道府県で絞り込み">
          <div className="fs-multi-head">
            <span className="fs-dim">{selected.size === 0 ? '全都道府県' : `${selected.size}件選択中`}</span>
            {selected.size > 0 && (
              <button type="button" className="fs-multi-clear" onClick={() => onChange(new Set())}>クリア</button>
            )}
          </div>
          <div className="fs-multi-list">
            {prefs.map(([p, n]) => (
              <label key={p} className="fs-multi-item">
                <input type="checkbox" checked={selected.has(p)} onChange={() => toggle(p)} />
                <span className="fs-multi-name">{p}</span>
                <span className="fs-dim">{n}</span>
              </label>
            ))}
          </div>
        </div>
      )}
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

/** OPCG の色 → 表示色。2色（"赤/緑"）は分割チップにする。 */
const LEADER_COLOR: Record<string, string> = {
  赤: '#e0403a', 緑: '#3fae6b', 青: '#3f7fd0', 紫: '#8a5fc0', 黒: '#5a5a63', 黄: '#e6c33a',
};

const ColorChip: React.FC<{ color: string }> = ({ color }) => {
  const cs = color.split('/').filter(Boolean);
  if (cs.length === 0) return <span className="fs-agg-chip" style={{ background: '#3a332a' }} />;
  if (cs.length === 1) return <span className="fs-agg-chip" style={{ background: LEADER_COLOR[cs[0]] ?? '#3a332a' }} />;
  return (
    <span
      className="fs-agg-chip"
      style={{ background: `linear-gradient(135deg, ${LEADER_COLOR[cs[0]] ?? '#3a332a'} 50%, ${LEADER_COLOR[cs[1]] ?? '#3a332a'} 50%)` }}
    />
  );
};

/**
 * P4: 集計ビュー。優勝リーダー分布を横棒で表示する。
 * データは一覧が既に読み込んでいる summary を束ねたもの（追加の取得なし）。X投稿は範囲外。
 */
const AggregateView: React.FC<{
  distribution: { rows: Array<{ name: string; color: string; count: number; pct: number }>; withWinner: number };
  monthLabel: string;
  kinds: string;
  backendOk: boolean;
}> = ({ distribution, monthLabel, kinds, backendOk }) => {
  const { rows, withWinner } = distribution;
  const max = rows.length ? rows[0].count : 1;
  return (
    <div className="fs-agg">
      <div className="fs-agg-head">
        <h2 className="fs-agg-h2">優勝リーダー分布</h2>
        <span className="fs-dim" style={{ fontSize: 12 }}>{monthLabel} {kinds}・回収済 {withWinner} 件</span>
      </div>
      {!backendOk ? (
        <p className="fs-dim" style={{ margin: 0 }}>結果APIに接続できないため集計できません。</p>
      ) : rows.length === 0 ? (
        <p className="fs-dim" style={{ margin: 0 }}>
          まだ結果が登録されていません。一覧から開催を開いて結果を登録すると、ここに優勝リーダー分布が出ます。
        </p>
      ) : (
        <div className="fs-agg-chart">
          {rows.map((r, i) => (
            <div className="fs-agg-row" key={`${r.name}-${r.color}-${i}`} title={`${r.name}（${r.color || '—'}）: ${r.count}件 / ${r.pct}%`}>
              <div className="fs-agg-who">
                <ColorChip color={r.color} />
                <span className="fs-agg-name">{r.name}</span>
              </div>
              <div className="fs-agg-track">
                <span className={`fs-agg-bar${i === 0 ? ' top' : ''}`} style={{ width: `${(r.count / max) * 100}%` }} />
                <span className="fs-agg-qty"><b>{r.count}</b>件 · {r.pct}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="fs-footnote" style={{ marginTop: 14 }}>
        登録済み結果の優勝リーダー（placement=1）を集計。回収率などの KPI は上段カードを参照。
        集計は結果登録データからその場で算出（LLM不使用・追加取得なし）。X 投稿はまだ対象外。
      </p>
    </div>
  );
};

/**
 * §16.7: 紐付け（一括登録）ビュー。全国の優勝ポストを収集し、この月の開催へ照合した候補を
 * 突き合わせ表で出す。店アカウント一致(handle)は自動チェック、店名一致は要確認。選んで
 * 「一括登録」すると、既存の結果登録として保存され、集計・一覧・回収率に反映される。
 */
const LinkView: React.FC<{ events: MergedEvent[]; seriesIds: number[]; onSaved: () => void }>
  = ({ events, seriesIds, onSaved }) => {
    const [busy, setBusy] = useState(false);
    const [saving, setSaving] = useState(false);
    const [review, setReview] = useState<ReviewPost[] | null>(null);
    const [sel, setSel] = useState<Record<string, number | null>>({});
    const [note, setNote] = useState<string | null>(null);
    const eventById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

    const run = async () => {
      setBusy(true); setNote(null);
      try {
        const collected = await collectPosts({ pages: 3 });
        const all = (await Promise.all(seriesIds.map((id) => fetchLinkReview(id)))).flat();
        const byId = new Map<string, ReviewPost>();
        for (const p of all) {
          const ex = byId.get(p.tweetId);
          if (ex) ex.candidates = [...ex.candidates, ...p.candidates];
          else byId.set(p.tweetId, { ...p, candidates: [...p.candidates] });
        }
        const posts = [...byId.values()];
        const withCand = posts.filter((p) => p.candidates.length > 0);
        const s: Record<string, number | null> = {};
        for (const p of withCand) {
          const auto = p.candidates.find((c) => c.auto);
          if (auto) s[p.tweetId] = auto.eventId;   // handle一致は自動チェック
        }
        setReview(withCand); setSel(s);
        setNote(`収集 ${collected} 件 / この月の開催に一致 ${withCand.length} 件（候補なし ${posts.length - withCand.length} 件は個人ポスト等で対象外）`);
      } catch (e) {
        setNote(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    };

    const register = async () => {
      const picks = (review ?? []).filter((p) => sel[p.tweetId] != null);
      if (!picks.length) { setNote('登録する候補を選択してください。'); return; }
      setSaving(true); setNote(null);
      const done: string[] = [];
      try {
        for (const p of picks) {
          const ev = eventById.get(sel[p.tweetId] as number);
          if (!ev) continue;
          try {
            await putEventResults(ev, ev.seriesId, p.tweetUrl ?? '', [{
              placement: 1,
              leaderCardNumber: p.cardNumber ?? undefined,
              leaderRaw: p.cardNumber ? undefined : (p.charName ?? undefined),
            }]);
            done.push(p.tweetId);
          } catch { /* 重複URL(409)等はスキップ */ }
        }
        if (done.length) {
          await linkApprove(done.map((tid) => ({ tweetId: tid, eventId: sel[tid] as number })));
        }
        onSaved();
        setReview((review ?? []).filter((p) => !done.includes(p.tweetId)));
        setNote(`${done.length}/${picks.length} 件を一括登録しました${done.length < picks.length ? '（残りは重複等でスキップ）' : ''}。集計・一覧・回収率に反映されます。`);
      } catch (e) {
        setNote(e instanceof Error ? e.message : String(e));
      } finally {
        setSaving(false);
      }
    };

    const selectedCount = (review ?? []).filter((p) => sel[p.tweetId] != null).length;
    return (
      <div className="fs-agg">
        <div className="fs-agg-head">
          <h2 className="fs-agg-h2">紐付け（一括登録）</h2>
          <div className="fs-form-actions" style={{ margin: 0 }}>
            {note && <span className="fs-dim" style={{ fontSize: 12 }}>{note}</span>}
            <div className="fs-spacer" />
            <button className="fs-btn" onClick={run} disabled={busy || saving}>{busy ? '収集中…' : review ? '再収集' : '収集して照合'}</button>
          </div>
        </div>
        {!review && !busy && (
          <p className="fs-dim" style={{ margin: 0 }}>
            「収集して照合」で全国の優勝ポストを集め、この月の開催に一致する候補を出します。店舗が投稿した結果は★handle一致で自動チェック、店名一致は要確認。選んで一括登録すると集計・一覧に反映されます。
          </p>
        )}
        {review && review.length > 0 && (
          <>
            <div className="fs-linktbl">
              {review.map((p) => (
                <div className="fs-linkrow" key={p.tweetId}>
                  <input
                    type="checkbox" aria-label="登録対象"
                    checked={sel[p.tweetId] != null}
                    onChange={(e) => setSel((s) => ({
                      ...s,
                      [p.tweetId]: e.target.checked
                        ? (p.candidates.find((c) => c.auto)?.eventId ?? p.candidates[0].eventId)
                        : null,
                    }))}
                  />
                  <div className="fs-linkinfo">
                    <b>{p.charName ?? '—'}</b>
                    <span className="fs-dim"> @{p.author ?? '—'} · {p.date ?? ''}</span>
                  </div>
                  <select
                    aria-label="紐付け先の開催"
                    value={sel[p.tweetId] ?? ''}
                    onChange={(e) => setSel((s) => ({ ...s, [p.tweetId]: e.target.value ? Number(e.target.value) : null }))}
                  >
                    <option value="">登録しない</option>
                    {p.candidates.map((c) => {
                      const ev = eventById.get(c.eventId);
                      const tag = c.method === 'handle' ? '★handle' : `名前${Math.round(c.score * 100)}%`;
                      return (
                        <option key={c.eventId} value={c.eventId}>
                          {ev ? `${ev.store}（${ev.date}）` : `#${c.eventId}`} — {tag}
                        </option>
                      );
                    })}
                  </select>
                </div>
              ))}
            </div>
            <div className="fs-form-actions">
              <div className="fs-spacer" />
              <button className="fs-btn" onClick={register} disabled={saving || selectedCount === 0}>
                {saving ? '登録中…' : `選択を一括登録（${selectedCount}）`}
              </button>
            </div>
          </>
        )}
        {review && review.length === 0 && (
          <p className="fs-dim" style={{ margin: 0 }}>この月の開催に一致する未紐付けポストはありません。</p>
        )}
        <p className="fs-footnote" style={{ marginTop: 14 }}>
          収集した優勝ポストのうち、この月の開催に一致した候補を表示。★handle=店アカウント一致（自動チェック）、名前%=表示名一致（要確認・別チェーン誤爆に注意）。
          一括登録すると結果として保存され、集計・一覧・回収率に反映。個人ポスト（候補なし）は対象外。
        </p>
      </div>
    );
  };

/** 結果登録フォームの1行分。cardNumber（辞書選択）が空のときのみ raw（自由入力）を使う。 */
interface FormRow {
  placement: number;
  cardNumber: string;
  raw: string;
}

const DetailPanel: React.FC<{
  event: MergedEvent;
  today: string;
  leaders: FlagshipLeader[];
  summaryItem: SummaryItem | undefined;
  backendOk: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** 店舗X 保存後に一覧へ反映＋ /events 再取得（§16.9 の登録が一覧に出ない不具合対策）。 */
  onSnsSaved: (store: string, url: string | null) => void;
}> = ({ event, today, leaders, summaryItem, backendOk, onClose, onSaved, onSnsSaved }) => {
  const d = new Date(`${event.date}T00:00:00`);
  const hasResults = !!summaryItem;
  const s: Status = hasResults ? 'collected' : baseStatus(event.date, today);

  const [url, setUrl] = useState('');
  const [rows, setRows] = useState<FormRow[]>([{ placement: 1, cardNumber: '', raw: '' }]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  // P3: 本文から候補を抽出（LLM不使用・辞書マッチング、設計 §13）。
  const [bodyText, setBodyText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractNote, setExtractNote] = useState<string | null>(null);
  // P6: X 検索で結果ポストを発見（設計 §16）。鍵未設定なら導線を隠す（手動運用・定期ジョブなし）。
  const [discoverEnabled, setDiscoverEnabled] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [candidates, setCandidates] = useState<DiscoveredCandidate[] | null>(null);
  // §16.9: 店舗X の手動登録（未登録店舗の X を人が登録＝店舗の全開催へ反映）。
  const [snsOverride, setSnsOverride] = useState<string | null | undefined>(undefined);
  const [snsInput, setSnsInput] = useState('');
  const [snsEditing, setSnsEditing] = useState(false);
  const [snsBusy, setSnsBusy] = useState(false);
  const shownSns = snsOverride !== undefined ? snsOverride : (event.snsUrl ?? null);
  useEffect(() => { setSnsOverride(undefined); setSnsEditing(false); setSnsInput(''); }, [event.id]);

  const saveSns = async () => {
    setSnsBusy(true);
    try {
      const v = await setStoreSns(event.store, snsInput.trim());
      setSnsOverride(v);
      setSnsEditing(false);
      // 一覧へ即時反映＋ /events 再取得（overlay 済み sns をキャッシュへ。リロードでも残す）。
      // 従来は onSaved()=loadSummary（/results のみ）で /events を更新せず、登録が一覧に出なかった。
      onSnsSaved(event.store, v);
    } catch { /* 失敗時は編集のまま */ } finally {
      setSnsBusy(false);
    }
  };

  // 登録済みの開催は既存の結果をフォームへプリフィルする（訂正フロー）。
  useEffect(() => {
    if (!hasResults) return;
    let alive = true;
    fetchEventResults(event.id).then((detail) => {
      if (!alive || !detail) return;
      setUrl(detail.postUrl ?? '');
      setRows(detail.results.map((r) => ({
        placement: r.placement,
        cardNumber: r.leaderCardNumber ?? '',
        raw: r.leaderRaw ?? '',
      })));
    }).catch(() => { /* 読めなくても空フォームで登録し直せる */ });
    return () => { alive = false; };
  }, [event.id, hasResults]);

  // 検索（発見）が使えるか一度だけ確認。鍵未設定なら導線を出さない（graceful degrade）。
  useEffect(() => {
    let alive = true;
    fetchDiscoverStatus().then((ok) => { if (alive) setDiscoverEnabled(ok); });
    return () => { alive = false; };
  }, []);

  const setRow = (i: number, patch: Partial<FormRow>) => {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };
  const addRow = () => {
    setRows((rs) => [...rs, { placement: Math.max(...rs.map((r) => r.placement)) + 1, cardNumber: '', raw: '' }]);
  };
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, j) => j !== i));

  const winnerFilled = rows.some((r) => r.placement === 1 && (r.cardNumber || r.raw.trim()));

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const entries = rows
        .filter((r) => r.cardNumber || r.raw.trim())
        .map((r) => ({
          placement: r.placement,
          leaderCardNumber: r.cardNumber || undefined,
          leaderRaw: r.cardNumber ? undefined : r.raw.trim(),
        }));
      await putEventResults(event, event.seriesId, url, entries);
      setMsg({ kind: 'ok', text: '保存しました' });
      onSaved();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  // 抽出候補をフォームへ流し込み、確認メッセージ文面を返す（取り込み/手貼り共通）。
  const applyResults = (results: ExtractedEntry[], prefix = ''): string => {
    if (results.length === 0) return `${prefix}リーダーを抽出できませんでした。手入力してください。`;
    setRows(results.map((r) => ({
      placement: r.placement,
      cardNumber: r.leaderCardNumber ?? '',
      raw: r.leaderCardNumber ? '' : (r.leaderRaw ?? ''),
    })));
    const ambiguous = results.filter((r) => !r.leaderCardNumber).length;
    return `${prefix}${results.length}件の候補を入れました。`
      + (ambiguous ? `うち${ambiguous}件は要確認（色違い等で一意化できず）。` : '')
      + '確認・修正して保存してください。';
  };

  // URL → 本文取得 → 候補抽出 を一発で実行（設計 §15、無料・認証不要）。
  const runIngest = async () => {
    if (!url.trim()) return;
    setExtracting(true); setExtractNote(null);
    try {
      const ing = await ingestFromUrl(url.trim());
      setBodyText(ing.bodyText);
      const who = ing.author ? `@${ing.author} の本文を取得。` : '本文を取得。';
      setExtractNote(applyResults(ing.results, who));
    } catch (e) {
      // 取得不可（画像のみ・X制限・非公開等）→ 手貼りへ誘導
      setExtractNote(
        (e instanceof Error && e.message && !e.message.startsWith('HTTP')
          ? `${e.message} `
          : '本文を自動取得できませんでした。')
        + 'ポスト本文をコピペして「候補を生成」してください。',
      );
    } finally {
      setExtracting(false);
    }
  };

  // 手貼り本文 → 順位×リーダーの候補をフォームへ流し込む（取得できない画像ポスト等の受け皿）。
  const runExtract = async () => {
    const text = bodyText.trim();
    if (!text) { setExtractNote('本文を入力してください。'); return; }
    setExtracting(true); setExtractNote(null);
    try {
      const { results } = await extractFromText(text);
      setExtractNote(applyResults(results));
    } catch (e) {
      setExtractNote(e instanceof Error ? e.message : String(e));
    } finally {
      setExtracting(false);
    }
  };

  // P6: この開催の結果ポストを X 検索で探す（手動運用）。
  // 結果ポストはハッシュタグを付けないことが多い（設計 §16.6）ため、タグ必須にはしない。
  // 店舗X が分かれば from:店 を軸に、無ければ素キーワードで、いずれも優勝系語(OR)で絞る。
  // 店舗X は §16.9 の手動登録込みの解決値（shownSns）を使う。
  const runDiscover = async () => {
    setDiscovering(true); setExtractNote(null); setCandidates(null);
    const account = shownSns ? [shownSns] : [];
    try {
      // 店舗X 既知: from:店 (優勝 OR 全勝 OR 準優勝)。
      // 未知: サーバ既定に委ねる（イベント語を OR で拡張＝「フラッグシップバトル」表記の結果も拾う・§16.10）。
      const { candidates: cs } = account.length
        ? await discoverPosts({ accounts: account, anyTerms: ['優勝', '全勝', '準優勝'], maxResults: 20 })
        : await discoverPosts({ maxResults: 20 });
      setCandidates(cs);
      setExtractNote(cs.length ? `${cs.length}件の候補が見つかりました。使う候補を選んでください。`
        : account.length
          ? '店舗X の直近7日の優勝系ポストは見つかりませんでした。手貼りもできます。'
          : '候補が見つかりませんでした。店舗X を登録すると from: で絞り込めて精度が上がります。手貼りもできます。');
    } catch (e) {
      setExtractNote(e instanceof Error ? e.message : String(e));
    } finally {
      setDiscovering(false);
    }
  };

  // 発見候補をフォームへ採用（URL・本文・順位×リーダーを流し込む）。
  const pickCandidate = (c: DiscoveredCandidate) => {
    setUrl(c.tweetUrl);
    setBodyText(c.bodyText);
    setCandidates(null);
    const who = c.author ? `@${c.author} を採用。` : '候補を採用。';
    setExtractNote(applyResults(c.results, who));
  };

  const remove = async () => {
    if (!window.confirm('この開催の結果を削除しますか？')) return;
    setBusy(true); setMsg(null);
    try {
      await deleteEventResults(event.id);
      setUrl('');
      setRows([{ placement: 1, cardNumber: '', raw: '' }]);
      setMsg({ kind: 'ok', text: '削除しました' });
      onSaved();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="fs-overlay" onClick={onClose} />
      <aside className="fs-panel" aria-label="開催詳細">
        <button className="fs-close" aria-label="閉じる" onClick={onClose}>✕</button>
        <div className="fs-eyebrow">開催詳細 — #{event.id}</div>
        <h2 className="fs-panel-h2">{event.store}</h2>
        <span className={`fs-badge fs-${s}`}>{STATUS_LABEL[s]}</span>
        <dl className="fs-dl">
          <dt>大会</dt><dd>{event.kind}</dd>
          <dt>開催日時</dt>
          <dd>{d.getMonth() + 1}月{d.getDate()}日({WD[d.getDay()]}) {event.startDatetime.slice(11, 16)}</dd>
          <dt>都道府県</dt><dd>{event.pref}</dd>
          <dt>定員</dt><dd>{event.capacity ?? '—'} 名</dd>
          <dt>店舗X</dt>
          <dd>{shownSns && !snsEditing ? (
            <span className="fs-sns">
              <a className="fs-xlink" href={shownSns} target="_blank" rel="noopener noreferrer">{shownSns.replace('https://', '')} ↗</a>
              {backendOk && (
                <button className="fs-linklike" onClick={() => { setSnsInput(shownSns); setSnsEditing(true); }}>編集</button>
              )}
            </span>
          ) : backendOk ? (
            <span className="fs-sns">
              <input
                className="fs-sns-input" type="text" value={snsInput}
                placeholder="@handle または https://x.com/…"
                onChange={(e) => setSnsInput(e.target.value)}
              />
              <button className="fs-btn ghost" disabled={snsBusy} onClick={saveSns}>{snsBusy ? '…' : '登録'}</button>
              {shownSns && <button className="fs-linklike" onClick={() => setSnsEditing(false)}>取消</button>}
            </span>
          ) : <span className="fs-dim">未登録</span>}</dd>
        </dl>
        <section className="fs-section">
          <h3>結果{hasResults ? '（登録済み・保存で上書き）' : 'の登録'}</h3>
          {!backendOk ? (
            <p className="fs-dim" style={{ margin: 0 }}>
              結果APIに接続できないため登録できない。{event.snsUrl && '店舗Xリンクから結果ポストは確認できる。'}
            </p>
          ) : (
            <div className="fs-form">
              <label className="fs-form-label" htmlFor="fs-post-url">結果ポストURL（任意）</label>
              <input
                id="fs-post-url" type="url" placeholder="https://x.com/…/status/…"
                value={url} onChange={(e) => setUrl(e.target.value)}
              />

              <div className="fs-extract">
                {discoverEnabled && (
                  <div className="fs-discover">
                    <div className="fs-form-actions">
                      <span className="fs-form-label" style={{ margin: 0 }}>Xで結果ポストを探す（店舗X＋「優勝/全勝/準優勝」・直近7日）</span>
                      <div className="fs-spacer" />
                      <button className="fs-btn" onClick={runDiscover} disabled={discovering || extracting}>
                        {discovering ? '検索中…' : '候補を探す'}
                      </button>
                    </div>
                    {candidates && candidates.length > 0 && (
                      <ul className="fs-cands">
                        {candidates.map((c) => {
                          const w = c.results.find((r) => r.placement === 1);
                          return (
                            <li className="fs-cand" key={c.tweetUrl}>
                              <div className="fs-cand-body">
                                <div className="fs-cand-meta">
                                  <span className="fs-cand-who">@{c.author ?? '—'}</span>
                                  {c.createdAt && <span className="fs-cand-date">{c.createdAt.slice(0, 10)}</span>}
                                  <span className="fs-cand-win">{w ? (w.leader?.name ?? w.leaderRaw ?? '—') : '抽出なし'}</span>
                                </div>
                                <div className="fs-cand-snip">{c.bodyText.slice(0, 70)}</div>
                              </div>
                              <button className="fs-btn ghost" onClick={() => pickCandidate(c)}>使う</button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
                <label className="fs-form-label" htmlFor="fs-body">結果ポスト本文（URLから自動取得 / 手貼り可・LLM不使用・無料）</label>
                <textarea
                  id="fs-body" className="fs-textarea" rows={3}
                  placeholder="上のURLを入れて「Xから取り込み」。取得できないポスト（画像のみ等）は本文をコピペして「候補を生成」"
                  value={bodyText} onChange={(e) => setBodyText(e.target.value)}
                />
                <div className="fs-form-actions">
                  <button className="fs-btn" onClick={runIngest} disabled={extracting || !url.trim()}>
                    {extracting ? '取り込み中…' : 'Xから取り込み'}
                  </button>
                  <div className="fs-spacer" />
                  <button className="fs-btn ghost" onClick={runExtract} disabled={extracting || !bodyText.trim()}>
                    候補を生成
                  </button>
                </div>
                {extractNote && <p className="fs-dim" style={{ margin: '2px 0 0', fontSize: 12 }}>{extractNote}</p>}
              </div>

              {rows.map((r, i) => (
                <div className="fs-form-row" key={i}>
                  <span className="fs-place">{r.placement === 1 ? '優勝' : `${r.placement}位`}</span>
                  <select
                    aria-label={`${r.placement === 1 ? '優勝' : `${r.placement}位`}のリーダー`}
                    value={r.cardNumber}
                    onChange={(e) => setRow(i, { cardNumber: e.target.value })}
                  >
                    <option value="">（自由入力）</option>
                    {leaders.map((l) => (
                      <option key={l.cardNumber} value={l.cardNumber}>{l.name}（{l.color}・{l.cardNumber}）</option>
                    ))}
                  </select>
                  {!r.cardNumber && (
                    <input
                      type="text" placeholder="リーダー名を入力"
                      value={r.raw} onChange={(e) => setRow(i, { raw: e.target.value })}
                    />
                  )}
                  {r.placement > 1 && (
                    <button className="fs-row-del" aria-label="この行を削除" onClick={() => removeRow(i)}>✕</button>
                  )}
                </div>
              ))}
              <div className="fs-form-actions">
                <button className="fs-btn ghost" onClick={addRow} disabled={rows.length >= 8}>+ 入賞を追加</button>
                <div className="fs-spacer" />
                {hasResults && <button className="fs-btn danger" onClick={remove} disabled={busy}>結果を削除</button>}
                <button className="fs-btn" onClick={save} disabled={busy || !winnerFilled}>
                  {busy ? '保存中…' : '保存'}
                </button>
              </div>
              {!winnerFilled && <p className="fs-dim" style={{ margin: '4px 0 0', fontSize: 12 }}>優勝リーダーの入力が必須。入賞は任意。</p>}
              {msg && <p className={msg.kind === 'ok' ? 'fs-msg-ok' : 'fs-msg-err'}>{msg.text}</p>}
            </div>
          )}
        </section>
        {summaryItem?.postUrl && (
          <section className="fs-section">
            <h3>結果ポスト</h3>
            <a className="fs-xlink" href={summaryItem.postUrl} target="_blank" rel="noopener noreferrer">
              {summaryItem.postUrl.replace('https://', '')} ↗
            </a>
          </section>
        )}
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
    .fs-btn.ghost:hover:not(:disabled) { background: rgba(255,255,255,.05); color: #f0e6d2; }
    .fs-btn.danger { border-color: #8a4b1c; color: #e6b98a; }
    .fs-btn.danger:hover:not(:disabled) { background: rgba(230,126,34,.15); color: #e6b98a; }
    .fs-series-row { display: flex; align-items: center; gap: 10px; margin: 14px 0 0; flex-wrap: wrap; }
    .fs-viewtoggle { display: inline-flex; border: 1px solid #2e261c; border-radius: 6px; overflow: hidden; }
    .fs-vbtn { background: #1e1812; color: #a89a80; border: none; padding: 6px 14px; font-size: 13px; cursor: pointer; font-family: inherit; }
    .fs-vbtn + .fs-vbtn { border-left: 1px solid #2e261c; }
    .fs-vbtn[aria-pressed="true"] { background: #f1c40f; color: #0b0908; font-weight: 700; }
    .fs-agg { background: #16120e; border: 1px solid #2e261c; border-radius: 8px; padding: 16px 18px; margin-bottom: 12px; }
    .fs-agg-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
    .fs-agg-h2 { font-size: 13px; letter-spacing: .08em; color: #f1c40f; font-weight: 700; margin: 0; }
    .fs-agg-chart { display: flex; flex-direction: column; gap: 2px; }
    .fs-linktbl { display: flex; flex-direction: column; gap: 4px; max-height: 420px; overflow-y: auto; margin-top: 4px; }
    .fs-linkrow { display: grid; grid-template-columns: 22px 1fr minmax(200px, 40%); align-items: center; gap: 10px; padding: 6px 8px; background: #1e1812; border: 1px solid #2e261c; border-radius: 6px; }
    .fs-linkinfo { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
    .fs-linkrow select { max-width: 100%; }
    .fs-agg-row { display: grid; grid-template-columns: 210px 1fr; align-items: center; gap: 12px; padding: 5px 6px; border-radius: 6px; }
    .fs-agg-row:hover { background: rgba(241,196,15,.05); }
    .fs-agg-who { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .fs-agg-chip { width: 11px; height: 11px; border-radius: 3px; flex: none; border: 1px solid rgba(0,0,0,.35); }
    .fs-agg-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
    .fs-agg-track { display: flex; align-items: center; gap: 8px; }
    .fs-agg-bar { height: 15px; border-radius: 3px 5px 5px 3px; background: linear-gradient(90deg, #d9a521, #f1c40f); min-width: 3px; }
    .fs-agg-bar.top { background: linear-gradient(90deg, #e6b011, #f1c40f); }
    .fs-agg-qty { font-variant-numeric: tabular-nums; font-size: 12px; color: #a89a80; white-space: nowrap; }
    .fs-agg-qty b { color: #f0e6d2; font-weight: 700; }
    @media (max-width: 620px) { .fs-agg-row { grid-template-columns: 140px 1fr; } }
    .fs-root select, .fs-root input[type="search"], .fs-root input[type="url"], .fs-root input[type="text"] { background: #1e1812; color: #f0e6d2; border: 1px solid #2e261c; border-radius: 6px; padding: 6px 10px; font-size: 13px; font-family: inherit; }
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
    .fs-collected { color: #7ccf9a; background: rgba(46,204,113,.12); }
    .fs-missing { color: #e67e22; background: rgba(230,126,34,.14); }
    .fs-today { color: #f1c40f; background: rgba(241,196,15,.12); }
    .fs-upcoming { color: #8a8577; background: rgba(138,133,119,.12); }
    .fs-multi { position: relative; }
    .fs-multi-btn { display: inline-flex; align-items: center; gap: 8px; background: #1e1812; color: #f0e6d2; border: 1px solid #2e261c; border-radius: 6px; padding: 6px 10px; font-size: 13px; font-family: inherit; cursor: pointer; }
    .fs-multi-btn:hover { border-color: #8a6d0b; }
    .fs-multi-caret { color: #a89a80; font-size: 10px; }
    .fs-multi-pop { position: absolute; z-index: 8; top: calc(100% + 4px); left: 0; width: 240px; max-height: 320px; display: flex; flex-direction: column; background: #16120e; border: 1px solid #2e261c; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.5); }
    .fs-multi-head { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid #2e261c; font-size: 12px; }
    .fs-multi-clear { background: none; border: none; color: #f1c40f; font-size: 12px; cursor: pointer; font-family: inherit; padding: 0; }
    .fs-multi-clear:hover { text-decoration: underline; }
    .fs-multi-list { overflow-y: auto; padding: 4px; }
    .fs-multi-item { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 5px; cursor: pointer; font-size: 13px; }
    .fs-multi-item:hover { background: rgba(241,196,15,.06); }
    .fs-multi-item input { accent-color: #f1c40f; cursor: pointer; }
    .fs-multi-name { flex: 1; }
    .fs-kind { border: 1px solid #2e261c; border-radius: 4px; font-size: 11px; padding: 1px 7px; white-space: nowrap; }
    .fs-kind-fs { color: #d4b46a; }
    .fs-kind-ex { color: #8fb8d8; border-color: #27394a; }
    .fs-dim { color: #6f6553; }
    .fs-xlink { color: #a89a80; text-decoration: none; border: 1px solid #2e261c; border-radius: 4px; padding: 2px 8px; font-size: 12px; }
    .fs-xlink:hover { color: #f1c40f; border-color: #8a6d0b; }
    .fs-sns { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .fs-sns-input { background: #1e1812; color: #f0e6d2; border: 1px solid #2e261c; border-radius: 6px; padding: 4px 8px; font-size: 12px; font-family: inherit; min-width: 180px; }
    .fs-sns-input:focus-visible { outline: 2px solid #f1c40f; outline-offset: 1px; }
    .fs-sns .fs-btn { padding: 3px 10px; font-size: 12px; }
    .fs-linklike { background: none; border: none; color: #8a6d0b; font-size: 12px; cursor: pointer; padding: 0; font-family: inherit; text-decoration: underline; }
    .fs-linklike:hover { color: #f1c40f; }
    .fs-sns-input-sm { min-width: 120px; padding: 2px 6px; font-size: 11px; }
    .fs-xreg { background: transparent; border: 1px solid #8a6d0b; color: #f1c40f; border-radius: 5px; padding: 2px 8px; font-size: 11px; cursor: pointer; font-family: inherit; white-space: nowrap; }
    .fs-xreg:hover { background: #f1c40f; color: #0b0908; }
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
    .fs-form { display: flex; flex-direction: column; gap: 8px; }
    .fs-form-label { font-size: 12px; color: #a89a80; }
    .fs-extract { display: flex; flex-direction: column; gap: 6px; padding: 8px; margin: 2px 0 4px; border: 1px dashed #2e261c; border-radius: 6px; background: rgba(241,196,15,.03); }
    .fs-discover { display: flex; flex-direction: column; gap: 6px; padding-bottom: 6px; margin-bottom: 2px; border-bottom: 1px solid #2e261c; }
    .fs-cands { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; max-height: 220px; overflow-y: auto; }
    .fs-cand { display: flex; gap: 8px; align-items: center; padding: 6px 8px; background: #1e1812; border: 1px solid #2e261c; border-radius: 6px; }
    .fs-cand-body { min-width: 0; flex: 1; }
    .fs-cand-meta { display: flex; gap: 8px; align-items: baseline; font-size: 12px; }
    .fs-cand-who { color: #f1c40f; font-weight: 700; }
    .fs-cand-date { color: #6f6553; font-variant-numeric: tabular-nums; }
    .fs-cand-win { color: #f0e6d2; font-weight: 600; margin-left: auto; }
    .fs-cand-snip { color: #a89a80; font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .fs-textarea { background: #1e1812; color: #f0e6d2; border: 1px solid #2e261c; border-radius: 6px; padding: 6px 10px; font-size: 13px; font-family: inherit; resize: vertical; }
    .fs-textarea:focus-visible { outline: 2px solid #f1c40f; outline-offset: 1px; }
    .fs-form-row { display: flex; gap: 6px; align-items: center; }
    .fs-form-row select { flex: 1; min-width: 0; }
    .fs-form-row input[type="text"] { flex: 1; min-width: 0; }
    .fs-place { font-size: 12px; color: #a89a80; width: 34px; flex: none; }
    .fs-row-del { background: none; border: none; color: #6f6553; cursor: pointer; font-size: 14px; padding: 2px 4px; }
    .fs-row-del:hover { color: #e6b98a; }
    .fs-form-actions { display: flex; gap: 8px; align-items: center; margin-top: 4px; }
    .fs-msg-ok { margin: 4px 0 0; font-size: 12px; color: #7ccf9a; }
    .fs-msg-err { margin: 4px 0 0; font-size: 12px; color: #e6b98a; }
    @media (max-width: 760px) { .fs-kpis { grid-template-columns: repeat(2, 1fr); } .fs-frame { padding: 14px 12px 48px; } }
  `}</style>
);
