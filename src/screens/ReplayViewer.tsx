import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_CONFIG } from '../api/api.config';
import { getCardImageUrl } from '../utils/imageAssets';

/**
 * リプレイビューア（CPU対戦の検討・CPU挙動改善の材料採取用）。
 *
 * バックエンドの `GET /api/game/{id}/replay/frames`（cpu_trace 対局のみ）から
 * 「リプレイ種＋アクション列＋CPU思考トレース＋盤面フレーム列」を取得し、
 * 1 アクション = 1 フレームで対局を追いながら、CPU の各意思決定
 * （候補手スコア・regret・J値成分／learned は訪問%・Q・L1第二意見）を確認する。
 *
 * - 対局データはバックエンドのメモリ常駐（Cloud Run は揮発）なので、
 *   「JSONを保存」でローカルへ書き出し、後から「ファイルを開く」で再閲覧できる。
 * - 疑問手には⚠マークとメモを付けて JSON でエクスポートできる
 *   （leader_specs / cpu 改善タスクへの持ち込み材料）。
 */

interface ReplayViewerProps {
  onBack: () => void;
}

// --- 型（バックエンド services/replay.py の frames 契約） --------------------

interface FrameCard {
  uuid: string;
  card_id: string;
  name?: string;
  power?: number | null;
  cost?: number | null;
  is_rest?: boolean;
  is_face_up?: boolean;
  attached_don?: number;
  keywords?: string[];
  ability_disabled?: boolean;
  is_frozen?: boolean;
}

interface FrameSide {
  leader: FrameCard | null;
  stage: FrameCard | null;
  field: FrameCard[];
  hand: FrameCard[];
  life: FrameCard[];
  trash: FrameCard[];
  don_active: number;
  don_rested: number;
  don_deck: number;
  deck_count: number;
}

interface ReplayFrame {
  action_index: number | null;
  turn: number;
  phase: string;
  active: 'p1' | 'p2';
  winner: string | null;
  players: { p1: FrameSide; p2: FrameSide };
  pending: { action?: string; player_id?: string } | null;
  battle: { attacker_uuid: string; target_uuid: string } | null;
}

interface MoveDesc {
  action_type?: string;
  card?: string | null;
  targets?: string[];
  selected?: string[];
  index?: number;
  position?: string;
  accepted?: boolean;
}

interface ReplayAction extends MoveDesc {
  src: 'human' | 'cpu';
  turn: number;
  player: string;
}

interface Candidate {
  move?: MoveDesc | null;
  // hard: 1-ply 事前スコア / 深掘りスコア
  prelim?: number | null;
  deep?: number | null;
  // learned: MCTS root 統計
  visit_pct?: number;
  q?: number;
  copies?: number;
}

interface Decision {
  turn: number;
  player: string;
  action_index?: number;
  difficulty?: string;
  chosen?: MoveDesc | null;
  folded?: boolean;
  regret?: number;
  candidates?: Candidate[];
  j_components?: Record<string, number>;
  pending_action?: string;
  // learned のみ
  dialog?: string;
  value?: number;
  l1_move?: MoveDesc | null;
  l1_disagrees?: boolean;
}

interface ReplayFramesPayload {
  game_id?: string;
  replay: {
    schema?: string;
    seed?: string | null;
    first_player?: string | null;
    difficulty?: string;
    cpu_player_id?: string;
    leaders?: { p1?: string | null; p2?: string | null };
    decks?: { p1: string[]; p2: string[] };
    actions: ReplayAction[];
  };
  decisions: Decision[];
  frames: ReplayFrame[];
  frames_truncated?: boolean;
}

interface Mark {
  action_index: number;
  turn: number;
  note: string;
}

// --- カード名参照（DeckBuilder と同じ localStorage キャッシュを読む） --------

type CardMaster = { uuid: string; name: string; text?: string; trigger_text?: string };

function useCardDb(): Map<string, CardMaster> {
  const [db, setDb] = useState<Map<string, CardMaster>>(new Map());
  useEffect(() => {
    const build = (cards: CardMaster[]) => {
      const m = new Map<string, CardMaster>();
      cards.forEach(c => { if (c.uuid) m.set(c.uuid, c); });
      setDb(m);
    };
    try {
      const cached = localStorage.getItem('opcg_card_db');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) { build(parsed); return; }
      }
    } catch { /* noop */ }
    fetch(`${API_CONFIG.BASE_URL}/api/cards`)
      .then(r => r.json())
      .then(d => { if (d?.success && Array.isArray(d.cards)) build(d.cards); })
      .catch(() => { /* カード名は card_id 表示へフォールバック */ });
  }, []);
  return db;
}

// --- 小物 ---------------------------------------------------------------------

const PHASE_LABEL: Record<string, string> = {
  MULLIGAN: 'マリガン', DON_PHASE: 'ドン', DRAW_PHASE: 'ドロー', MAIN: 'メイン',
  BATTLE: 'バトル', COUNTER: 'カウンター', END: 'エンド', REFRESH: 'リフレッシュ',
};

function fmtScore(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return v.toFixed(1);
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// --- 本体 ---------------------------------------------------------------------

export const ReplayViewer: React.FC<ReplayViewerProps> = ({ onBack }) => {
  const cardDb = useCardDb();
  const [payload, setPayload] = useState<ReplayFramesPayload | null>(null);
  const [frameIdx, setFrameIdx] = useState(0);
  const [gameIdInput, setGameIdInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [zoomCard, setZoomCard] = useState<FrameCard | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [showZones, setShowZones] = useState<{ [k: string]: boolean }>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const cardName = useCallback((cardId?: string | null): string => {
    if (!cardId) return '—';
    return cardDb.get(cardId)?.name || cardId;
  }, [cardDb]);

  // --- 読み込み -------------------------------------------------------------

  const fetchByGameId = useCallback(async (gid: string) => {
    setLoading(true); setLoadError(null);
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/api/game/${encodeURIComponent(gid)}/replay/frames`);
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data?.error?.message || `取得に失敗しました (${res.status})`);
      }
      if (!Array.isArray(data.frames) || data.frames.length === 0) {
        throw new Error('この対局には盤面フレームがありません（旧バージョンでの録画）。');
      }
      setPayload(data); setFrameIdx(0); setMarks([]);
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLastCpuGame = useCallback(() => {
    const gid = localStorage.getItem('opcg_last_cpu_game');
    if (!gid) { setLoadError('直近のCPU対戦が見つかりません。CPU対戦を1局プレイしてください。'); return; }
    fetchByGameId(gid);
  }, [fetchByGameId]);

  const openFile = useCallback((f: File) => {
    setLoadError(null);
    f.text().then(txt => {
      try {
        const data = JSON.parse(txt) as ReplayFramesPayload;
        if (!data?.replay || !Array.isArray(data.frames)) throw new Error('形式が違います');
        setPayload(data); setFrameIdx(0);
        setMarks(Array.isArray((data as unknown as { marks?: Mark[] }).marks)
          ? (data as unknown as { marks: Mark[] }).marks : []);
      } catch {
        setLoadError('リプレイJSONとして読み込めませんでした。');
      }
    });
  }, []);

  // --- 派生データ -------------------------------------------------------------

  // action_index → decision。旧録画（action_index 無し）は「k番目のCPUアクション=k番目の決定」で補完。
  const decisionByAction = useMemo(() => {
    const m = new Map<number, Decision>();
    if (!payload) return m;
    const withIdx = payload.decisions.filter(d => d.action_index !== undefined);
    if (withIdx.length === payload.decisions.length) {
      withIdx.forEach(d => m.set(d.action_index as number, d));
    } else {
      const cpuActionIdxs = payload.replay.actions
        .map((a, i) => (a.src === 'cpu' ? i : -1)).filter(i => i >= 0);
      payload.decisions.forEach((d, k) => {
        const ai = d.action_index !== undefined ? d.action_index : cpuActionIdxs[k];
        if (ai !== undefined && ai >= 0) m.set(ai, d);
      });
    }
    return m;
  }, [payload]);

  const frame = payload?.frames[frameIdx] || null;
  const action = (frame && frame.action_index !== null && payload)
    ? payload.replay.actions[frame.action_index] : null;
  const decision = (frame && frame.action_index !== null)
    ? decisionByAction.get(frame.action_index) || null : null;
  const cpuSeat: 'p1' | 'p2' = payload?.replay.cpu_player_id === 'P1' ? 'p1' : 'p2';

  const jumpDecision = useCallback((dir: 1 | -1) => {
    if (!payload) return;
    for (let i = frameIdx + dir; i >= 0 && i < payload.frames.length; i += dir) {
      const ai = payload.frames[i].action_index;
      if (ai !== null && decisionByAction.has(ai)) { setFrameIdx(i); return; }
    }
  }, [payload, frameIdx, decisionByAction]);

  const moveLabel = useCallback((d?: MoveDesc | null): string => {
    if (!d) return '—';
    const parts: string[] = [d.action_type || '?'];
    if (d.card) parts.push(cardName(d.card));
    if (d.accepted === false) parts.push('(使わない)');
    if (d.targets && d.targets.length) parts.push('→ ' + d.targets.map(t => cardName(t)).join(', '));
    if (d.selected && d.selected.length) parts.push('選択: ' + d.selected.map(t => cardName(t)).join(', '));
    if (d.position) parts.push(`[${d.position}]`);
    return parts.join(' ');
  }, [cardName]);

  const toggleMark = useCallback(() => {
    if (!frame || frame.action_index === null) return;
    const ai = frame.action_index;
    const existing = marks.find(m => m.action_index === ai);
    if (existing) {
      setMarks(marks.filter(m => m.action_index !== ai));
      return;
    }
    const note = window.prompt('この判断へのメモ（なぜ疑問か・期待する手など）', '') || '';
    setMarks([...marks, { action_index: ai, turn: frame.turn, note }]);
  }, [frame, marks]);

  const exportMarks = useCallback(() => {
    if (!payload) return;
    downloadJson(`opcg_replay_marks_${payload.replay.seed || 'x'}.json`, {
      kind: 'opcg-replay-marks',
      game_id: payload.game_id, seed: payload.replay.seed,
      difficulty: payload.replay.difficulty,
      leaders: payload.replay.leaders,
      marks: marks.map(m => ({
        ...m,
        action: payload.replay.actions[m.action_index],
        decision: decisionByAction.get(m.action_index) || null,
      })),
    });
  }, [payload, marks, decisionByAction]);

  const saveReplay = useCallback(() => {
    if (!payload) return;
    downloadJson(`opcg_replay_${payload.replay.seed || 'x'}.json`, { ...payload, marks });
  }, [payload, marks]);

  // --- 盤面描画 ---------------------------------------------------------------

  const cardChip = (c: FrameCard, opts?: { small?: boolean }) => {
    const w = opts?.small ? 40 : 52;
    const faceUp = c.is_face_up !== false;
    return (
      <div key={c.uuid} style={{ position: 'relative', width: w, flexShrink: 0 }}
           onClick={() => faceUp && setZoomCard(c)}>
        <img
          src={faceUp ? getCardImageUrl(c.card_id) : ''}
          alt={faceUp ? (c.name || c.card_id) : '裏向き'}
          style={{
            width: w, borderRadius: 3, display: 'block',
            transform: c.is_rest ? 'rotate(90deg) scale(0.86)' : 'none',
            opacity: c.ability_disabled ? 0.6 : 1,
            background: faceUp ? '#222' : 'repeating-linear-gradient(45deg,#333,#333 4px,#444 4px,#444 8px)',
            minHeight: faceUp ? undefined : w * 1.4,
            border: c.is_frozen ? '2px solid #6cf' : '1px solid #555',
          }}
          loading="lazy"
        />
        {(c.attached_don || 0) > 0 && (
          <span style={{ position: 'absolute', top: -4, right: -4, background: '#111', color: '#ffd54f',
                         fontSize: 10, borderRadius: 8, padding: '1px 4px', border: '1px solid #ffd54f' }}>
            +{c.attached_don}
          </span>
        )}
        {faceUp && c.power !== null && c.power !== undefined && (
          <div style={{ fontSize: 9, textAlign: 'center', color: '#eee' }}>{c.power}</div>
        )}
      </div>
    );
  };

  const zoneRow = (sideKey: string, label: string, cards: FrameCard[], collapsedDefault: boolean) => {
    const key = `${sideKey}:${label}`;
    const open = showZones[key] ?? !collapsedDefault;
    return (
      <div style={{ marginTop: 4 }}>
        <div style={{ fontSize: 11, color: '#9ab', cursor: 'pointer', userSelect: 'none' }}
             onClick={() => setShowZones(s => ({ ...s, [key]: !open }))}>
          {open ? '▾' : '▸'} {label}（{cards.length}）
        </div>
        {open && cards.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
            {cards.map(c => cardChip(c, { small: true }))}
          </div>
        )}
      </div>
    );
  };

  const sideBoard = (seat: 'p1' | 'p2', side: FrameSide) => {
    const isCpu = seat === cpuSeat;
    const isActive = frame?.active === seat;
    return (
      <div style={{
        border: `1px solid ${isActive ? '#f1c40f' : '#444'}`, borderRadius: 8,
        padding: 8, background: '#20242c',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontWeight: 700, color: isCpu ? '#e67e22' : '#2ecc71' }}>
            {seat.toUpperCase()}{isCpu ? '（CPU）' : ''}
          </span>
          {isActive && <span style={{ fontSize: 11, color: '#f1c40f' }}>手番</span>}
          <span style={{ fontSize: 11, color: '#9ab', marginLeft: 'auto' }}>
            ライフ {side.life.length} ・ 手札 {side.hand.length} ・ デッキ {side.deck_count} ・
            ドン {side.don_active}/{side.don_active + side.don_rested}（残 {side.don_deck}）
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          {side.leader && cardChip(side.leader)}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
            {side.field.map(c => cardChip(c))}
            {side.stage && cardChip(side.stage, { small: true })}
          </div>
        </div>
        {zoneRow(seat, '手札', side.hand, !isCpu ? false : false)}
        {zoneRow(seat, 'ライフ', side.life, true)}
        {zoneRow(seat, 'トラッシュ', side.trash, true)}
      </div>
    );
  };

  // --- 思考パネル -------------------------------------------------------------

  const decisionPanel = (d: Decision) => {
    const isLearned = (d.difficulty || payload?.replay.difficulty) === 'learned';
    const jc = d.j_components || {};
    const jcEntries = Object.entries(jc)
      .filter(([k, v]) => k !== 'total' && typeof v === 'number' && Math.abs(v) > 0.05)
      .sort((a, b) => Math.abs(b[1] as number) - Math.abs(a[1] as number))
      .slice(0, 10);
    const marked = frame && frame.action_index !== null
      && marks.some(m => m.action_index === frame.action_index);
    return (
      <div style={{ border: '1px solid #566', borderRadius: 8, padding: 10, background: '#1b2733', marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: '#8fd' }}>CPU思考</span>
          <span style={{ fontSize: 12, color: '#9ab' }}>{d.difficulty || payload?.replay.difficulty}</span>
          {(d.dialog || d.pending_action) && (
            <span style={{ fontSize: 11, color: '#cba', border: '1px solid #665', borderRadius: 4, padding: '1px 5px' }}>
              {d.dialog || d.pending_action}
            </span>
          )}
          {!isLearned && (d.regret ?? 0) > 0 && (
            <span style={{ fontSize: 12, color: (d.regret ?? 0) >= 100 ? '#ff7043' : '#ffd54f' }}>
              regret {fmtScore(d.regret)}
            </span>
          )}
          {isLearned && d.l1_disagrees && (
            <span style={{ fontSize: 12, color: '#ff7043' }}>L1不一致: {moveLabel(d.l1_move)}</span>
          )}
          <button onClick={toggleMark} style={{
            marginLeft: 'auto', background: marked ? '#7a4' : '#333', color: '#fff',
            border: '1px solid #666', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12,
          }}>
            {marked ? '✓ マーク済' : '⚠ この判断をマーク'}
          </button>
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: '#fff' }}>
          選択: <b>{moveLabel(d.chosen)}</b>{d.folded ? '（ターンを畳む）' : ''}
          {isLearned && d.value !== undefined && (
            <span style={{ color: '#9ab', marginLeft: 8 }}>Q={d.value}</span>
          )}
        </div>
        {(d.candidates?.length ?? 0) > 0 && (
          <table style={{ width: '100%', marginTop: 6, borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ color: '#9ab', textAlign: 'left' }}>
                <th style={{ padding: '2px 4px' }}>候補手</th>
                {isLearned
                  ? (<><th style={{ padding: '2px 4px', width: 64 }}>訪問%</th>
                       <th style={{ padding: '2px 4px', width: 64 }}>Q</th></>)
                  : (<><th style={{ padding: '2px 4px', width: 64 }}>1-ply</th>
                       <th style={{ padding: '2px 4px', width: 64 }}>深掘り</th></>)}
              </tr>
            </thead>
            <tbody>
              {(d.candidates || []).map((c, i) => {
                const isChosen = JSON.stringify(c.move) === JSON.stringify(d.chosen);
                return (
                  <tr key={i} style={{
                    background: isChosen ? '#284' : (i % 2 ? '#202a34' : 'transparent'),
                    color: isChosen ? '#fff' : '#cde',
                  }}>
                    <td style={{ padding: '2px 4px' }}>{moveLabel(c.move)}{c.copies ? ` ×${c.copies}` : ''}</td>
                    {isLearned
                      ? (<><td style={{ padding: '2px 4px' }}>{c.visit_pct ?? '—'}</td>
                           <td style={{ padding: '2px 4px' }}>{c.q ?? '—'}</td></>)
                      : (<><td style={{ padding: '2px 4px' }}>{fmtScore(c.prelim)}</td>
                           <td style={{ padding: '2px 4px' }}>{fmtScore(c.deep)}</td></>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {jcEntries.length > 0 && (
          <details style={{ marginTop: 6 }}>
            <summary style={{ fontSize: 12, color: '#9ab', cursor: 'pointer' }}>
              J値成分（total {fmtScore(jc.total)}・上位{jcEntries.length}件）
            </summary>
            <table style={{ borderCollapse: 'collapse', fontSize: 12, marginTop: 4 }}>
              <tbody>
                {jcEntries.map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ padding: '1px 8px 1px 4px', color: '#cde' }}>{k}</td>
                    <td style={{ padding: '1px 4px', color: (v as number) >= 0 ? '#8f8' : '#f88', textAlign: 'right' }}>
                      {(v as number).toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </div>
    );
  };

  // --- 画面 -------------------------------------------------------------------

  const styles: Record<string, React.CSSProperties> = {
    root: {
      position: 'absolute', inset: 0, background: '#141821', color: '#eee',
      overflowY: 'auto', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y',
      fontFamily: 'system-ui, sans-serif', padding: 12, boxSizing: 'border-box',
    },
    topBar: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
    btn: {
      background: '#2c3e50', color: '#fff', border: '1px solid #567', borderRadius: 6,
      padding: '6px 12px', cursor: 'pointer', fontSize: 13,
    },
    navBtn: {
      background: '#333', color: '#fff', border: '1px solid #666', borderRadius: 6,
      padding: '6px 10px', cursor: 'pointer', fontSize: 14, minWidth: 40,
    },
  };

  if (!payload) {
    return (
      <div style={styles.root}>
        <div style={styles.topBar}>
          <button style={styles.btn} onClick={onBack}>← 戻る</button>
          <span style={{ fontSize: 18, fontWeight: 700 }}>リプレイビューア</span>
        </div>
        <div style={{ maxWidth: 520, margin: '40px auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button style={{ ...styles.btn, padding: '14px', fontSize: 15 }} onClick={loadLastCpuGame} disabled={loading}>
            ▶ 直近のCPU対戦を読み込む
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={gameIdInput} onChange={e => setGameIdInput(e.target.value)}
              placeholder="game_id を貼り付け"
              style={{ flex: 1, background: '#222', color: '#eee', border: '1px solid #555',
                       borderRadius: 6, padding: '8px 10px', fontSize: 13 }}
            />
            <button style={styles.btn} disabled={!gameIdInput.trim() || loading}
                    onClick={() => fetchByGameId(gameIdInput.trim())}>取得</button>
          </div>
          <button style={styles.btn} onClick={() => fileRef.current?.click()}>
            📂 保存済みリプレイJSONを開く
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }}
                 onChange={e => { const f = e.target.files?.[0]; if (f) openFile(f); e.target.value = ''; }} />
          {loading && <div style={{ color: '#9ab' }}>読み込み中…</div>}
          {loadError && <div style={{ color: '#ff8a80' }}>{loadError}</div>}
          <div style={{ fontSize: 12, color: '#789', lineHeight: 1.6 }}>
            対局データはサーバのメモリ常駐です（時間経過で消えます）。CPU対戦の直後に読み込み、
            「JSONを保存」で手元に残すのがおすすめです。
          </div>
        </div>
      </div>
    );
  }

  const totalFrames = payload.frames.length;
  const decisionCount = payload.decisions.length;
  const markedCount = marks.length;

  return (
    <div style={styles.root}>
      <div style={styles.topBar}>
        <button style={styles.btn} onClick={() => { setPayload(null); setLoadError(null); }}>← 一覧へ</button>
        <span style={{ fontWeight: 700 }}>リプレイ</span>
        <span style={{ fontSize: 12, color: '#9ab' }}>
          {payload.replay.difficulty} / seed {payload.replay.seed || '—'} / 決定 {decisionCount} 件
          {payload.frames_truncated ? ' / ⚠末尾フレーム欠落' : ''}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button style={styles.btn} onClick={saveReplay}>💾 JSONを保存</button>
          <button style={{ ...styles.btn, opacity: markedCount ? 1 : 0.5 }} onClick={exportMarks}
                  disabled={!markedCount}>⚠ マーク書出（{markedCount}）</button>
        </span>
      </div>

      {/* ナビゲーション */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <button style={styles.navBtn} onClick={() => setFrameIdx(0)} disabled={frameIdx === 0}>|«</button>
        <button style={styles.navBtn} onClick={() => setFrameIdx(i => Math.max(0, i - 1))}
                disabled={frameIdx === 0}>«</button>
        <button style={styles.navBtn} onClick={() => setFrameIdx(i => Math.min(totalFrames - 1, i + 1))}
                disabled={frameIdx >= totalFrames - 1}>»</button>
        <button style={styles.navBtn} onClick={() => setFrameIdx(totalFrames - 1)}
                disabled={frameIdx >= totalFrames - 1}>»|</button>
        <span style={{ fontSize: 12, color: '#9ab', minWidth: 90, textAlign: 'center' }}>
          {frameIdx + 1} / {totalFrames}
        </span>
        <button style={{ ...styles.navBtn, color: '#8fd' }} onClick={() => jumpDecision(-1)}>← 判断</button>
        <button style={{ ...styles.navBtn, color: '#8fd' }} onClick={() => jumpDecision(1)}>判断 →</button>
      </div>
      <input
        type="range" min={0} max={totalFrames - 1} value={frameIdx}
        onChange={e => setFrameIdx(Number(e.target.value))}
        style={{ width: '100%', marginBottom: 8 }}
      />

      {frame && (
        <>
          {/* このフレームの状況 */}
          <div style={{ fontSize: 13, color: '#cde', marginBottom: 8 }}>
            <b>T{frame.turn}</b> {PHASE_LABEL[frame.phase] || frame.phase}
            {frame.winner && <span style={{ color: '#f1c40f', marginLeft: 8 }}>🏆 勝者: {frame.winner}</span>}
            {action && (
              <span style={{ marginLeft: 8, color: action.src === 'cpu' ? '#e67e22' : '#2ecc71' }}>
                {action.player}{action.src === 'cpu' ? '(CPU)' : ''}: {moveLabel(action)}
              </span>
            )}
            {frame.pending && !frame.winner && (
              <span style={{ marginLeft: 8, color: '#9ab', fontSize: 12 }}>
                待ち: {frame.pending.player_id} / {frame.pending.action}
              </span>
            )}
          </div>

          {/* 盤面（上=CPU側デフォルト） */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sideBoard(cpuSeat, frame.players[cpuSeat])}
            {sideBoard(cpuSeat === 'p2' ? 'p1' : 'p2', frame.players[cpuSeat === 'p2' ? 'p1' : 'p2'])}
          </div>

          {/* CPU思考 */}
          {decision && decisionPanel(decision)}
        </>
      )}

      {/* マーク一覧 */}
      {marks.length > 0 && (
        <div style={{ marginTop: 12, border: '1px solid #453', borderRadius: 8, padding: 8, background: '#231f1a' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fc6', marginBottom: 4 }}>⚠ マークした判断</div>
          {marks.sort((a, b) => a.action_index - b.action_index).map(m => (
            <div key={m.action_index} style={{ fontSize: 12, color: '#dcb', padding: '2px 0', cursor: 'pointer' }}
                 onClick={() => {
                   const fi = payload.frames.findIndex(f => f.action_index === m.action_index);
                   if (fi >= 0) setFrameIdx(fi);
                 }}>
              T{m.turn} · #{m.action_index} · {moveLabel(payload.replay.actions[m.action_index])}
              {m.note && <span style={{ color: '#987' }}> — {m.note}</span>}
            </div>
          ))}
        </div>
      )}

      {/* カードズーム */}
      {zoomCard && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 50,
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}
             onClick={() => setZoomCard(null)}>
          <div style={{ maxWidth: 340, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <img src={getCardImageUrl(zoomCard.card_id)} alt={zoomCard.name || zoomCard.card_id}
                 style={{ width: 260, borderRadius: 10 }} />
            <div style={{ background: '#1b2733', borderRadius: 8, padding: 10, marginTop: 8,
                          fontSize: 12, color: '#dde', textAlign: 'left', lineHeight: 1.5 }}>
              <b>{cardName(zoomCard.card_id)}</b>（{zoomCard.card_id}）
              {zoomCard.power !== null && zoomCard.power !== undefined && ` / パワー ${zoomCard.power}`}
              {(zoomCard.keywords?.length ?? 0) > 0 && ` / ${zoomCard.keywords!.join('・')}`}
              <div style={{ marginTop: 4, color: '#abc' }}>{cardDb.get(zoomCard.card_id)?.text || ''}</div>
            </div>
            <button style={{ ...styles.btn, marginTop: 8 }} onClick={() => setZoomCard(null)}>閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
};
