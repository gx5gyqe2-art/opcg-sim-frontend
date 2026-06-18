import { useCallback, useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { LAYOUT_CONSTANTS, LAYOUT_PARAMS } from '../layout/layout.config';
import { calculateCoordinates } from '../layout/layoutEngine';
import { createBoardSide, buildBoardItems, type MovableDescriptor } from '../ui/BoardSide';
import { createCardContainer } from '../ui/CardRenderer';
import { useGameAction } from '../game/actions';
import { CardDetailSheet } from '../ui/CardDetailSheet';
import { CardActionMenu } from '../ui/CardActionMenu';
import { CardSelectModal } from '../ui/CardSelectModal';
import { ModalShell } from '../ui/common/ModalShell';
import { ModalButton } from '../ui/common/ModalButton';
import { PromptBanner, type PromptBannerAction } from '../ui/common/PromptBanner';
import { toastPillStyle, TOAST_Z_INDEX } from '../ui/common/toastStyles';
import { getAvailableActions } from '../game/cardActions';
import { normalizeCardType } from '../game/cardTypes';
import { DeckSelectModal, type DeckOption } from '../ui/DeckSelectModal';
import { ActionLog } from '../ui/ActionLog';
import { EffectToast, type EffectToastItem } from '../ui/EffectToast';
import { CoinFlip } from '../ui/CoinFlip';
import { PhaseBanner } from '../ui/banners/PhaseBanner';
import { getBattleDecisionMeta } from '../ui/banners/battleDecision';
import { BattleDecisionHeader, BattleDecisionPanel } from '../ui/banners/BattleDecisionInfo';
import { API_CONFIG } from '../api/api.config';
import { apiClient } from '../api/client';
import { getCardImageUrl } from '../utils/imageAssets';
import { createEffectsLayer, type EffectsLayer } from '../ui/anim/effectsLayer';
import { attachTweenTicker, detachTweenTicker, clearTweens, tween, easeOutCubic, setAnimSpeed } from '../ui/anim/tween';
import { snapshotPositions, type PositionMap } from '../ui/anim/positionTracker';
import { createBoardReconciler, type BoardReconciler } from '../ui/anim/boardReconciler';
import { RECONCILE_BOARD } from '../ui/anim/reconcileFlag';
import { createBoardBackground, type ActiveSide } from '../ui/boardBackground';
import CONST from '../../shared_constants.json';
import { sessionManager } from '../utils/session';
import type { GameState, CardInstance, PendingRequest } from '../game/types';
import type { ActionEvent } from '../api/types';

// 効果トースト（一時的な視覚フィードバック）対象アクションと表示ラベル。
// 盤面が動く主要効果のみを対象にし、no-op 系（RULE_PROCESSING 等）は出さない。
const TOAST_ACTION_LABELS: Record<string, string> = {
  KO: 'KO',
  DRAW: 'ドロー',
  DISCARD: '手札を捨てる',
  TRASH: 'トラッシュ',
  BOUNCE: '手札に戻す',
  MOVE_TO_HAND: '手札に加える',
  DECK_BOTTOM: 'デッキの下へ',
  HEAL: 'ライフ回復',
  PLAY_CARD: '登場',
  REST: 'レスト',
};
// 除去・喪失系は強調表示（赤）にする。
const TOAST_EMPHASIS_ACTIONS = new Set(['KO', 'TRASH', 'DISCARD', 'BOUNCE', 'MOVE_TO_HAND', 'DECK_BOTTOM']);
const TOAST_DURATION_MS = 1800;

function effectToastText(ev: ActionEvent): string {
  const label = TOAST_ACTION_LABELS[ev.action ?? ''] ?? ev.action ?? '';
  const card = ev.card_name ? `${ev.card_name}: ` : '';
  const tgt = ev.targets?.length ? ` → ${ev.targets.join(' / ')}` : '';
  return `${card}${label}${tgt}`;
}

const PENDING_ACTION_LABELS: Record<string, string> = {
  SELECT_BLOCKER: 'ブロッカー選択',
  SELECT_COUNTER: 'カウンター選択',
  SEARCH_AND_SELECT: '対象選択',
  CONFIRM_DECISION: '確認',
  ORDER_CARDS: 'カード並び替え',
  SELECT_RESOURCE: 'リソース選択',
  CHOICE: '選択肢',
};

const resolveCard = (uuid: string | undefined | null, gs: GameState): CardInstance | null => {
  if (!uuid) return null;
  for (const pid of ['p1', 'p2'] as const) {
    const p = gs.players[pid];
    if (p.leader?.uuid === uuid) return p.leader as unknown as CardInstance;
    const z = p.zones;
    for (const zone of [z.field, z.hand, z.life, z.trash]) {
      const c = zone?.find(c => c.uuid === uuid);
      if (c) return c;
    }
  }
  return null;
};

// 演出（Phase2）用ヘルパー: 盤面上のカードコンテナを uuid で探し、画面座標を得る。
// カードコンテナは createCardContainer で name=uuid が設定されている。
const findCardContainer = (app: PIXI.Application, uuid: string): PIXI.Container | null => {
  let found: PIXI.Container | null = null;
  const walk = (c: PIXI.Container) => {
    if (found || c.destroyed) return;
    if (c.name === uuid) { found = c; return; }
    for (const k of c.children) {
      if (k instanceof PIXI.Container) walk(k);
    }
  };
  walk(app.stage);
  return found;
};

const cardGlobalPos = (app: PIXI.Application, uuid: string): { x: number; y: number } | null => {
  const c = findCardContainer(app, uuid);
  if (!c || c.destroyed) return null;
  const p = c.getGlobalPosition();
  return { x: p.x, y: p.y };
};

// ActionEvent は uuid を持たず card_name のみ。現状態から名前→uuid を引く（先頭一致）。
const resolveUuidByName = (name: string | undefined | null, gs: GameState): string | null => {
  if (!name) return null;
  for (const pid of ['p1', 'p2'] as const) {
    const p = gs.players[pid];
    if (!p) continue;
    if (p.leader?.name === name) return p.leader.uuid;
    if (p.stage?.name === name) return p.stage.uuid;
    const z = p.zones;
    for (const zone of [z.field, z.hand, z.life, z.trash, z.deck]) {
      const c = zone?.find(c => c.name === name);
      if (c?.uuid) return c.uuid;
    }
  }
  return null;
};

// 除去・喪失系（赤フラッシュ＋煙）。
const REMOVAL_ACTIONS = new Set(['KO', 'TRASH', 'DISCARD', 'BOUNCE', 'MOVE_TO_HAND', 'DECK_BOTTOM']);

// 攻撃エフェクトのサイド配色（盤面の枠色＝boardBackground の手番グローに対応）。
// 自分＝緑系（0x34e0a6）／相手＝赤系（0xe74c3c）。攻撃元のサイドで色を切り替える。
type FxPalette = { core: number; glow: number; glow2: number; ring: number; spark: number; flash: number };
const FX_SELF: FxPalette = { core: 0xeafff8, glow: 0x21d99a, glow2: 0x4fe6b6, ring: 0x6cf0c8, spark: 0x8affda, flash: 0xeafff8 };
const FX_OPP: FxPalette = { core: 0xffe9e4, glow: 0xe74c3c, glow2: 0xff7d6c, ring: 0xff9e8e, spark: 0xffc2b6, flash: 0xffeee9 };

const resolveCardName = (uuid: string, gs: GameState): string => {
  return resolveCard(uuid, gs)?.name ?? uuid.slice(0, 8);
};

export const RealGame = ({
  p1Deck: initialP1,
  p2Deck: initialP2,
  onBack,
  gameId: onlineGameId,
  myPlayerId = 'both',
  roomName,
  onForceBack,
  vsCpu = false,
  cpuDifficulty = 'normal',
}: {
  p1Deck: string,
  p2Deck: string,
  onBack: () => void,
  // ▼ オンライン対戦用（ソロ時は myPlayerId='both' で未指定相当）
  gameId?: string,
  myPlayerId?: 'both' | 'p1' | 'p2',
  roomName?: string,
  onForceBack?: () => void,
  // ▼ CPU 対戦用（人間=p1 固定・REST＋/api/game/cpu/step ポーリング・WS 不使用）
  vsCpu?: boolean,
  cpuDifficulty?: 'easy' | 'normal' | 'hard',
}) => {
  // オンライン対戦かどうか（'both' = 従来のソロ／ホットシート）
  const isOnline = myPlayerId === 'p1' || myPlayerId === 'p2';
  // 視点を自陣固定にするか（オンライン or CPU 対戦）。CPU 対戦の人間は常に p1。
  const fixedViewer = isOnline || vsCpu;
  const selfId: 'p1' | 'p2' = isOnline ? (myPlayerId as 'p1' | 'p2') : 'p1';

  const pixiContainerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const effectsRef = useRef<EffectsLayer | null>(null);
  const reconcilerRef = useRef<BoardReconciler | null>(null);
  // カード移動グライド（Phase3）用の前回状態。
  const prevPositionsRef = useRef<PositionMap>(new Map());
  const prevGameStateRef = useRef<GameState | null>(null);
  const prevViewerRef = useRef<'p1' | 'p2' | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  // オンライン対戦のルーム状態（WAITING 中はセットアップ画面を表示）
  const [roomStatus, setRoomStatus] = useState<'WAITING' | 'PLAYING' | 'FINISHED'>('WAITING');
  const [readyStates, setReadyStates] = useState<{ p1: boolean; p2: boolean }>({ p1: false, p2: false });
  const [deckPreview, setDeckPreview] = useState<{ p1: { leader_id?: string; leader_name?: string } | null; p2: { leader_id?: string; leader_name?: string } | null }>({ p1: null, p2: null });
  const [wsConnected, setWsConnected] = useState(false);
  // CPU 対戦: CPU 思考中フラグ（人間操作ロック表示用）と多重ポーリング防止。
  const [cpuThinking, setCpuThinking] = useState(false);
  const cpuBusyRef = useRef(false);
  // WebSocket 再接続管理
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const isMountedRef = useRef(true);
  const [selectedCard, setSelectedCard] = useState<{
    card: CardInstance;
    location: string;
    isMyTurn: boolean;
  } | null>(null);
  const [isDetailMode, setIsDetailMode] = useState(false);
  const [actionMenu, setActionMenu] = useState<{
    card: CardInstance;
    location: string;
    anchor: { x: number; y: number };
    // ドン!!ゾーンから対象を選んで開いた場合、最初から枚数ステッパーを表示する。
    donMode?: boolean;
  } | null>(null);
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const [isAttackTargeting, setIsAttackTargeting] = useState(false);
  const [attackingCardUuid, setAttackingCardUuid] = useState<string | null>(null);
  // ドン!!付与の対象選択モード（自分のアクティブドン!!をタップして開始）。
  const [isDonTargeting, setIsDonTargeting] = useState(false);
  const [boardSelected, setBoardSelected] = useState<string[]>([]);

  // ドラッグ&ドロップ操作（タップ/ボタン操作はそのまま残し、追加のジェスチャとして提供）。
  //  - 手札カード → 自陣エリアへドロップ = PLAY（登場/プレイ）
  //  - 自陣のキャラ/リーダー → 相手のカードへドロップ = ATTACK（攻撃）
  //  - アクティブなドン!! → 自陣のリーダー/キャラへドロップ = ATTACH_DON（1枚付与）
  // 状態更新で盤面が再構築されるとゴーストが破棄されるため、ドラッグ中（盤面変化なし）に限り
  // app.stage 直下へゴースト/ハイライトを置く。値は ref 管理で再レンダーを誘発しない。
  type DragKind = 'play' | 'attack' | 'don';
  const pendingDragRef = useRef<{ card: CardInstance; kind: DragKind; x: number; y: number } | null>(null);
  const dragInfoRef = useRef<{ card: CardInstance; kind: DragKind } | null>(null);
  const dragGhostRef = useRef<PIXI.Container | null>(null);
  const dropHighlightRef = useRef<PIXI.Graphics | null>(null);
  // 攻撃ドラッグはカード本体を動かさず、攻撃元→ポインタを結ぶネオン・テザー（発光弦＋照準）で示す。
  const attackLineRef = useRef<PIXI.Graphics | null>(null);
  const attackOriginRef = useRef<{ x: number; y: number } | null>(null);
  const attackToRef = useRef<{ x: number; y: number } | null>(null);
  const attackTickRef = useRef<(() => void) | null>(null);

  // 先行プレイヤー選択（ソロ専用。CPU/対戦はランダム）。既定は P1 先攻。
  const [firstChoice, setFirstChoice] = useState<'p1' | 'p2'>('p1');
  // コイントス演出（CPU/対戦）。coinResult=先行プレイヤー。表示中は coinResult!==null。
  const [coinResult, setCoinResult] = useState<'p1' | 'p2' | null>(null);
  const coinShownRef = useRef(false);

  const [layoutCoords, setLayoutCoords] = useState<{ x: number, y: number } | null>(null);
  
  const [p1DeckId, setP1DeckId] = useState(initialP1);
  const [p2DeckId, setP2DeckId] = useState(initialP2);
  const [isSetupComplete, setIsSetupComplete] = useState(!!(initialP1 && initialP2));
  const [deckOptions, setDeckOptions] = useState<DeckOption[]>([]);
  const [selectingDeckFor, setSelectingDeckFor] = useState<'p1' | 'p2' | null>(null);
  const [eventLog, setEventLog] = useState<ActionEvent[]>([]);
  const [showLog, setShowLog] = useState(false);
  // ログ採取（クリップボードコピーが不可な環境向けのフォールバック表示用）。
  const [captureText, setCaptureText] = useState<string | null>(null);
  const [effectToasts, setEffectToasts] = useState<EffectToastItem[]>([]);
  const toastIdRef = useRef(0);

  const { COLORS } = LAYOUT_CONSTANTS;
  const { Z_INDEX, MODAL } = LAYOUT_PARAMS;

  const activePlayerId = gameState?.turn_info?.active_player_id as "p1" | "p2" | undefined;

  // この端末を操作しているプレイヤー視点。
  // ・ソロ(both): 基本は現在の手番プレイヤーを下側に描画する。ただし手番外のプレイヤーに
  //   選択要求(相手のアタック時の防御・カウンター・捨てコスト等)が来ている間は、その判断者
  //   (pendingRequest.player_id)を下側に向ける。これにより判断者の手札/場が表向き・操作可能な
  //   下段に来て、盤面を覆うモーダルではなく盤面ハイライトで直接選べる。
  // ・オンライン/CPU: 自分の役割(p1/p2)で固定し、自陣を常に下側に描画する。
  const viewerId: "p1" | "p2" = fixedViewer
    ? selfId
    : ((pendingRequest?.player_id as "p1" | "p2" | undefined)
        ?? activePlayerId
        ?? (CONST.PLAYER_KEYS.P1 as "p1"));
  const opponentId: "p1" | "p2" = viewerId === "p1" ? "p2" : "p1";
  // 自陣固定時(オンライン/CPU)、メインの操作が可能なのは自分の手番のときのみ。
  const isMyTurn = !fixedViewer || activePlayerId === selfId;
  // 選択要求(マリガン/ブロッカー/カウンター/効果選択 等)が自分宛てかどうか。
  const isMyDecision = !fixedViewer || pendingRequest?.player_id === selfId;
  // 盤面(PIXI)を初期化・描画してよいか。オンラインはルームが PLAYING になってから。
  // CPU 対戦はソロと同じく createGame 完了（isSetupComplete）後。
  const boardReady = isOnline ? roomStatus === 'PLAYING' : isSetupComplete;

  // 最新 gameState を ref で参照（addEventLog 等の安定コールバックから読む用）。
  const gameStateRef = useRef<GameState | null>(null);
  gameStateRef.current = gameState;

  const MAX_LOG = 50;
  const addEventLog = useCallback((newEvents: ActionEvent[]) => {
    setEventLog(prev => [...newEvents, ...prev].slice(0, MAX_LOG));

    // イベント駆動の盤面フラッシュ（Phase2）。状態適用前（盤面はまだ旧配置）に
    // カード位置を引けるので、除去対象も消える直前の場所で演出できる。演出は
    // 永続レイヤ上に出るため、この後の全再構築でも残る。状態は一切変更しない。
    const app = appRef.current;
    const fx = effectsRef.current;
    const gs = gameStateRef.current;
    if (app && fx && gs) {
      for (const ev of newEvents) {
        if (ev.success === false || !ev.action) continue;
        const uuid = resolveUuidByName(ev.card_name, gs);
        const pos = uuid ? cardGlobalPos(app, uuid) : null;
        if (!pos) continue;
        if (REMOVAL_ACTIONS.has(ev.action)) {
          fx.impactFlash(pos.x, pos.y, 0xff6b6b);
          fx.puff(pos.x, pos.y, 0xff8a8a);
        } else if (ev.action === 'ATTACH_DON') {
          fx.glowPulse(pos.x, pos.y, 30, 0xffd34d);
        } else if (ev.action === 'BUFF') {
          fx.glowPulse(pos.x, pos.y, 30, 0x5fd0ff);
        } else if (ev.action === 'HEAL' || ev.action === 'LIFE_RECOVER') {
          fx.glowPulse(pos.x, pos.y, 34, 0x6bff8c);
        }
      }
    }

    // 主要効果は一時トーストで視覚フィードバックする（失敗/対象なし/no-op は除外）。
    const fresh = newEvents.filter(
      e => e.success !== false && e.action != null && TOAST_ACTION_LABELS[e.action] != null,
    );
    if (fresh.length === 0) return;
    const items: EffectToastItem[] = fresh.slice(0, 4).map(e => ({
      id: (toastIdRef.current += 1),
      text: effectToastText(e),
      emphasis: TOAST_EMPHASIS_ACTIONS.has(e.action ?? ''),
    }));
    setEffectToasts(prev => [...prev, ...items].slice(-6));
    items.forEach(it => {
      window.setTimeout(
        () => setEffectToasts(prev => prev.filter(t => t.id !== it.id)),
        TOAST_DURATION_MS,
      );
    });
  }, []);

  const { startGame, sendAction, sendBattleAction, isPending, errorToast, setErrorToast } = useGameAction(
    fixedViewer ? selfId : (activePlayerId || (CONST.PLAYER_KEYS.P1 as "p1")),
    setGameState,
    setPendingRequest,
    pendingRequest,
    addEventLog,
    isOnline ? onlineGameId : undefined,
  );

  // コイントス演出のトリガー（CPU/対戦のみ）。ゲーム開始直後、turn_info が示す先行
  // プレイヤー(=active_player_id)を結果として一度だけ表示する。ソロは選択制のため出さない。
  useEffect(() => {
    if (coinShownRef.current) return;
    if (!(vsCpu || isOnline)) return;
    if (!gameState || !activePlayerId) return;
    // 開始時(マリガン中)のみ。リロードで途中復帰した際に再演出しないようガードする。
    if (gameState.turn_info?.current_phase !== 'MULLIGAN') return;
    coinShownRef.current = true;
    setCoinResult(activePlayerId);
  }, [gameState, activePlayerId, vsCpu, isOnline]);

  useEffect(() => {
    const fetchDecks = async () => {
      const options: DeckOption[] = [];

      try {
        const res = await fetch(`${API_CONFIG.BASE_URL}/api/deck/list`);
        const data = await res.json();
        if (data.success) {
          data.decks.forEach((d: { id: string; name: string; leader_id?: string }) => {
            options.push({ id: `db:${d.id}`, name: d.name, leaderId: d.leader_id });
          });
        }
      } catch { /* noop */ }

      const uniqueMap = new Map();
      options.forEach(o => uniqueMap.set(o.id, o));
      setDeckOptions(Array.from(uniqueMap.values()));
    };
    fetchDecks();
  }, []);

  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; }; }, []);

  // オンライン対戦: ルーム状態/対局状態を WebSocket で購読する（指数バックオフ再接続）。
  useEffect(() => {
    if (!isOnline || !onlineGameId) return;

    const connectWs = () => {
      if (!isMountedRef.current) return;
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); }
      const base = API_CONFIG.BASE_URL;
      const proto = base.startsWith('https') ? 'wss:' : 'ws:';
      const host = base.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const ws = new WebSocket(`${proto}//${host}/ws/game/${onlineGameId}`);
      wsRef.current = ws;

      ws.onopen = () => { if (!isMountedRef.current) return; reconnectAttemptRef.current = 0; setWsConnected(true); };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'STATE_UPDATE') {
            if (data.status) setRoomStatus(data.status);
            if (data.ready_states) setReadyStates(data.ready_states);
            if (data.deck_preview) setDeckPreview(data.deck_preview);
            if (data.game_state) {
              setGameState(data.game_state);
              setPendingRequest(data.pending_request || null);
              if (data.action_events?.length) addEventLog(data.action_events);
            }
          }
        } catch { /* noop */ }
      };
      ws.onerror = () => { };
      ws.onclose = () => {
        if (!isMountedRef.current) return;
        setWsConnected(false);
        const attempt = reconnectAttemptRef.current;
        const delay = Math.min(2000 * Math.pow(2, attempt), 30000);
        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = setTimeout(connectWs, delay);
      };
    };
    connectWs();

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); wsRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- WS接続はオンライン時マウント1回のみ。addEventLog等は最新を本体で参照
  }, [isOnline, onlineGameId]);

  // オンライン対戦の取りこぼし対策: 対局の進行は WS ブロードキャストでしか相手へ
  // 届かないため、モバイルのバックグラウンド化・通信瞬断で1回でも取りこぼすと、古い
  // 「相手の操作待ち」状態のまま自力復帰できず停止して見える（特にカウンター解決後に
  // 攻撃側の手番が戻らない）。相手待ちの間だけ /api/game/state を軽量ポーリングして
  // 最新状態へ再同期する（読み取り専用・冪等。自分の操作待ち中・決着後は不要）。
  useEffect(() => {
    if (!isOnline || !onlineGameId || roomStatus !== 'PLAYING') return;
    if (gameState?.turn_info?.winner) return;
    if (isMyDecision) return; // 自分の番/自分宛ての選択中は最新（応答で同期済み）
    const gid = onlineGameId;
    const id = setInterval(async () => {
      const resp = await apiClient.fetchGameState(gid);
      if (!resp || !isMountedRef.current || !resp.game_state) return;
      setGameState(resp.game_state);
      setPendingRequest(resp.pending_request || null);
      // action_events は再取得で重複し得るためログには積まない（状態のみ再同期）。
    }, 3000);
    return () => clearInterval(id);
  }, [isOnline, onlineGameId, roomStatus, isMyDecision, gameState?.turn_info?.winner]);

  // CPU 対戦: CPU(p2) が行動すべき状況なら /api/game/cpu/step をポーリングして
  // 1 手ずつ盤面へ反映する（ステップ逐次の演出）。多重起動は cpuBusyRef でガードする。
  useEffect(() => {
    if (!vsCpu) return;
    const gid = gameState?.game_id;
    if (!gid || gameState?.turn_info?.winner) return;
    // CPU が行動すべきか: 選択要求が p2 宛て、または(要求なしで)手番が p2。
    const cpuShouldAct = pendingRequest
      ? pendingRequest.player_id === 'p2'
      : activePlayerId === 'p2';
    if (!cpuShouldAct || cpuBusyRef.current) return;

    cpuBusyRef.current = true;
    setCpuThinking(true);
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    (async () => {
      try {
        await sleep(450); // 初手の思考待ち（演出）
        for (let i = 0; i < 2000; i++) {
          const resp = await apiClient.cpuStep(gid);
          if (!isMountedRef.current) return;
          if (resp.game_state) setGameState(resp.game_state);
          setPendingRequest(resp.pending_request ?? null);
          if (resp.action_events?.length) addEventLog(resp.action_events);
          if (resp.waiting_for !== 'cpu') break;
          await sleep(700); // 1 手ずつ見せる
        }
      } catch (e) {
        if (isMountedRef.current) setErrorToast(`CPUエラー: ${(e as Error).message}`);
      } finally {
        cpuBusyRef.current = false;
        if (isMountedRef.current) setCpuThinking(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- CPU 駆動は手番/要求/勝敗の変化で再評価。ref で多重起動を防止
  }, [vsCpu, gameState?.game_id, gameState?.turn_info?.active_player_id, gameState?.turn_info?.winner, pendingRequest, activePlayerId]);

  // オンライン対戦のロビー操作（デッキ選択/開始/キック）。
  const sendRuleLobbyAction = useCallback(async (
    action: { action_type: string; player_id?: string; deck_id?: string; target_player_id?: string }
  ) => {
    if (!onlineGameId) return;
    try {
      await apiClient.sendRuleAction(onlineGameId, action);
    } catch (e) {
      setErrorToast(`ロビー操作失敗: ${(e as Error).message}`);
    }
  }, [onlineGameId, setErrorToast]);

  const handleGameStart = () => {
    if (p1DeckId && p2DeckId) {
      setIsSetupComplete(true);
    }
  };

  const handleSelectionResolve = async (selectedUuids: string[], position?: 'TOP' | 'BOTTOM') => {
    if (!gameState?.game_id || !pendingRequest) return;

    const battleActionTypes = Object.values(CONST.c_to_s_interface.BATTLE_ACTIONS.TYPES);

    if (battleActionTypes.includes(pendingRequest.action)) {
      await sendBattleAction(pendingRequest.action, selectedUuids[0], pendingRequest.request_id);
    } else {
      // ARRANGE_DECK(課題2a/2b): selected_uuids が配置順、position が上/下。
      await sendAction(CONST.c_to_s_interface.GAME_ACTIONS.TYPES.RESOLVE_EFFECT_SELECTION, {
        extra: position ? { selected_uuids: selectedUuids, position } : { selected_uuids: selectedUuids }
      });
    }
  };

  const handleOptionSelect = async (index: number) => {
    if (!gameState?.game_id || isPending) return;
    
    await sendAction(CONST.c_to_s_interface.GAME_ACTIONS.TYPES.RESOLVE_EFFECT_SELECTION, {
      extra: { index: index }
    });
  };

  // C8: コスト宣言（数値入力）。宣言値を declared_value として送る。
  const handleDeclareCost = async (value: number) => {
    if (!gameState?.game_id || isPending) return;
    await sendAction(CONST.c_to_s_interface.GAME_ACTIONS.TYPES.RESOLVE_EFFECT_SELECTION, {
      extra: { declared_value: value }
    });
  };

  // 任意効果「〜してもよい」の発動可否。accepted で発動/スキップを送る。
  const handleOptionalConfirm = async (accepted: boolean) => {
    if (!gameState?.game_id || isPending) return;
    await sendAction(CONST.c_to_s_interface.GAME_ACTIONS.TYPES.RESOLVE_EFFECT_SELECTION, {
      extra: { accepted }
    });
  };

  const handleAction = async (type: string, payload: { uuid?: string; target_ids?: string[]; extra?: Record<string, unknown> } = {}) => {
    if (!gameState?.game_id || isPending) return;

    if (type === CONST.c_to_s_interface.GAME_ACTIONS.TYPES.ATTACK) {
      setAttackingCardUuid(payload.uuid || null);
      setIsAttackTargeting(true);
      setIsDetailMode(false);
      setActionMenu(null);
      return;
    }

    if (pendingRequest) {
      const battleTypes: Record<string, string> = {
        'COUNTER': CONST.c_to_s_interface.BATTLE_ACTIONS.TYPES.SELECT_COUNTER,
        'BLOCK': CONST.c_to_s_interface.BATTLE_ACTIONS.TYPES.SELECT_BLOCKER
      };
      const actionType = battleTypes[type];
      if (actionType) {
        await sendBattleAction(actionType, payload.uuid, pendingRequest.request_id);
        setIsDetailMode(false);
        setSelectedCard(null);
        return;
      }
    }
    
    if (type === CONST.c_to_s_interface.GAME_ACTIONS.TYPES.ATTACK_CONFIRM) {
      await sendAction(type, {
        card_id: payload.uuid,
        target_ids: payload.target_ids,
      }); 
      setIsDetailMode(false);
      setSelectedCard(null);
      return;
    }

    await sendAction(type, {
      card_id: payload.uuid,
      target_ids: payload.target_ids,
      extra: payload.extra
    });
    setIsDetailMode(false);
    setSelectedCard(null);
  };

  const handlePass = async () => {
    if (!pendingRequest || !gameState?.game_id || isPending) return;
    const currentRequestId = pendingRequest.request_id;
    setPendingRequest(null);
    await sendBattleAction(CONST.c_to_s_interface.BATTLE_ACTIONS.TYPES.PASS, undefined, currentRequestId);
  };

  const handleMulligan = async () => {
    if (!gameState?.game_id || isPending) return;
    await sendAction('MULLIGAN', {});
  };

  const handleKeepHand = async () => {
    if (!gameState?.game_id || isPending) return;
    await sendAction('KEEP_HAND', {});
  };

  const handleTurnEnd = () => {
    handleAction(CONST.c_to_s_interface.GAME_ACTIONS.TYPES.TURN_END);
  };

  // 盤面上で実際にクリックして選べるカードの集合。盤面選択モード(下記 isBoardSelectMode)の
  // 判定に使う。相手の手札は裏向きで個別選択できないため除外する（含めると「盤面で選べる」と
  // 誤判定してモーダルを出さず、ハイライト対象が無くソフトロックする）。
  const boardUuids = gameState ? new Set<string>([
    ...(gameState.players.p1.zones.field.map(c => c.uuid)),
    ...(gameState.players.p2.zones.field.map(c => c.uuid)),
    ...(gameState.players.p1.leader ? [gameState.players.p1.leader.uuid] : []),
    ...(gameState.players.p2.leader ? [gameState.players.p2.leader.uuid] : []),
    ...(gameState.players.p1.stage ? [gameState.players.p1.stage.uuid] : []),
    ...(gameState.players.p2.stage ? [gameState.players.p2.stage.uuid] : []),
    // 手札は自分(viewer)の分のみクリック可能。
    ...(gameState.players[viewerId]?.zones.hand.map(c => c.uuid) ?? []),
  ]) : new Set<string>();

  // 盤面選択モードに切り替えない（専用のモーダル/パネルを持つ、または「カードを選ぶ」操作
  // ではない）アクション。これら以外は、選択候補がすべて盤面上にあれば覆わない盤面選択UIを使う。
  const BOARD_SELECT_EXCLUDED_ACTIONS = new Set<string>([
    CONST.c_to_s_interface.PENDING_ACTION_TYPES.ARRANGE_DECK,   // デッキ並び替え(DnDモーダル)
    CONST.c_to_s_interface.PENDING_ACTION_TYPES.ORDER_CARDS,    // 順番指定(モーダル)
    CONST.c_to_s_interface.PENDING_ACTION_TYPES.SELECT_RESOURCE,// ドン!!返却等(モーダル)
    CONST.c_to_s_interface.PENDING_ACTION_TYPES.CONFIRM_DECISION,
    CONST.c_to_s_interface.GAME_ACTIONS.TYPES.MULLIGAN,
    CONST.c_to_s_interface.GAME_ACTIONS.TYPES.KEEP_HAND,
    CONST.c_to_s_interface.GAME_ACTIONS.TYPES.ACTIVATE_MAIN,
    // RealGame 内で文字列リテラルとして扱う専用UIアクション(Yes/No確認・コスト宣言・メイン操作)。
    'CONFIRM_OPTIONAL', 'CONFIRM_TRIGGER', 'DECLARE_COST', 'MAIN_ACTION',
  ]);

  // 任意効果などで「盤面上のカードを選ぶ」要求のとき、画面を覆うモーダルを出すと盤面の
  // カードをクリックできない。選択候補がすべて盤面上にあれば、覆わずにカードをハイライト＋
  // コンパクトなバナーで直接クリック選択させる（SEARCH_AND_SELECT/カウンター/ブロッカーに
  // 限らず全ての盤面対象選択へ一般化）。デッキ/トラッシュ等の非盤面候補を含む選択は従来通り
  // モーダル（showSearchModal）にフォールバックする。
  const isBoardSelectMode =
    isMyDecision &&
    !isAttackTargeting &&
    !!pendingRequest &&
    !BOARD_SELECT_EXCLUDED_ACTIONS.has(pendingRequest.action) &&
    (pendingRequest.selectable_uuids?.length ?? 0) > 0 &&
    pendingRequest.selectable_uuids!.every(uuid => boardUuids.has(uuid));

  const selectableUuids = isBoardSelectMode
    ? new Set(pendingRequest!.selectable_uuids)
    : new Set<string>();

  // ドン!!付与の対象候補: 自陣のリーダーとフィールドのキャラクター。
  const donTargetUuids = (isDonTargeting && gameState)
    ? new Set<string>([
        ...(gameState.players[viewerId]?.leader ? [gameState.players[viewerId]!.leader!.uuid] : []),
        ...((gameState.players[viewerId]?.zones.field ?? [])
          .filter(c => normalizeCardType(c.type) === 'CHARACTER')
          .map(c => c.uuid)),
      ])
    : new Set<string>();
  // ドン!!返却(RETURN_DON)の対象選択。候補がすべてドン!!（アクティブ/レスト/付与）の場合、
  // モーダルでは「どれがレスト/アクティブ/付与か」を区別しにくいので、盤面のドン!!パイル
  // （アクティブ/レスト）と付与先キャラを直接タップして選ばせる。
  type DonCand = CardInstance & { attached_to?: string | null; is_rest?: boolean };
  const donReturnCandidates: DonCand[] =
    isMyDecision &&
    pendingRequest?.action === CONST.c_to_s_interface.PENDING_ACTION_TYPES.SELECT_RESOURCE &&
    (pendingRequest.candidates?.length ?? 0) > 0 &&
    pendingRequest.candidates!.every(c => c.card_id === 'DON' || (c as DonCand).type === 'DON')
      ? (pendingRequest.candidates as DonCand[])
      : [];
  const isDonReturnMode = donReturnCandidates.length > 0;
  // 付与中ドン!!の付与先キャラ uuid（盤面でハイライト/タップ可能にする）。
  const donAttachTargets = new Set<string>(
    donReturnCandidates.filter(d => d.attached_to).map(d => d.attached_to as string),
  );
  const donReturnHighlight = isDonReturnMode
    ? new Set<string>([
        ...(donReturnCandidates.some(d => !d.attached_to && !d.is_rest) ? [`donactive-${viewerId}`] : []),
        ...(donReturnCandidates.some(d => !d.attached_to && d.is_rest) ? [`donrest-${viewerId}`] : []),
        ...donAttachTargets,
      ])
    : new Set<string>();

  // 盤面のハイライト集合: ドン!!付与中はその対象候補、ドン!!返却中は返却可能なドン!!、
  // それ以外は選択要求の候補。
  const highlightUuids = isDonTargeting
    ? donTargetUuids
    : isDonReturnMode
      ? donReturnHighlight
      : selectableUuids;

  const minSelect = pendingRequest?.constraints?.min ?? 1;
  const maxSelect = pendingRequest?.constraints?.max ?? 1;

  // 守備側（手番でない側）が選択を求められている時の明示プレフィックス。
  // ブロッカー/カウンター選択は相手の攻撃に対する防御側の操作なので、
  // 誰の操作かを明示してハイライトされたカードを選ぶよう促す。
  const isDefendingDecision = !!pendingRequest && !!activePlayerId
    && pendingRequest.player_id !== activePlayerId;
  const decisionNote = isDefendingDecision
    ? `🛡 ${pendingRequest!.player_id?.toUpperCase()} の防御選択 — `
    : '';

  const onCardClick = async (card: CardInstance, pos: { x: number; y: number }) => {
    if (isPending || !gameState) return;

    if (isAttackTargeting && attackingCardUuid) {
      // 攻撃対象は相手のリーダー／フィールドのキャラ（またはステージ）に限定する。
      // 従来は任意のカード（自分のカードや手札）でも ATTACK_CONFIRM を送ってサーバ
      // エラーになり、攻撃ターゲティング状態から復帰できなかった。
      const oppId = isOnline ? opponentId : (activePlayerId === 'p1' ? 'p2' : 'p1');
      const opp = gameState.players[oppId];
      const isValidTarget =
        opp.leader?.uuid === card.uuid ||
        opp.zones.field.some(c => c.uuid === card.uuid) ||
        opp.stage?.uuid === card.uuid;
      if (!isValidTarget) {
        return; // 無効な対象クリックは無視（ターゲティングは継続）
      }
      await handleAction(CONST.c_to_s_interface.GAME_ACTIONS.TYPES.ATTACK_CONFIRM, {
        uuid: attackingCardUuid,
        target_ids: [card.uuid]
      });
      setIsAttackTargeting(false);
      setAttackingCardUuid(null);
      return;
    }

    // ドン!!付与の対象選択中: 自陣のリーダー/キャラクターをタップしたら
    // そのカードへ何枚付与するかのステッパー(ミニメニュー)を開く。
    if (isDonTargeting) {
      if (donTargetUuids.has(card.uuid)) {
        const isLeader = gameState.players[viewerId]?.leader?.uuid === card.uuid;
        setActionMenu({ card, location: isLeader ? 'leader' : 'field', anchor: pos, donMode: true });
        setIsDonTargeting(false);
      }
      // 対象外のタップはターゲティングを継続（無視）。
      return;
    }

    // ドン!!返却: 盤面のドン!!パイル（アクティブ/レスト）・付与先キャラをタップして
    // 戻すドン!!を1枚ずつ選ぶ。種別から候補 uuid を引き当て、必要枚数に達したら確定。
    if (isDonReturnMode) {
      let pick: string | null = null;
      if (card.uuid === `donactive-${viewerId}`) {
        pick = donReturnCandidates.find(d => !d.attached_to && !d.is_rest && !boardSelected.includes(d.uuid))?.uuid ?? null;
      } else if (card.uuid === `donrest-${viewerId}`) {
        pick = donReturnCandidates.find(d => !d.attached_to && d.is_rest && !boardSelected.includes(d.uuid))?.uuid ?? null;
      } else if (donAttachTargets.has(card.uuid)) {
        pick = donReturnCandidates.find(d => d.attached_to === card.uuid && !boardSelected.includes(d.uuid))?.uuid ?? null;
      }
      if (!pick) return;
      const next = [...boardSelected, pick];
      if (next.length >= maxSelect) {
        setBoardSelected([]);
        handleSelectionResolve(next);
      } else {
        setBoardSelected(next);
      }
      return;
    }

    if (isBoardSelectMode) {
      if (selectableUuids.has(card.uuid)) {
        if (maxSelect === 1) {
          handleSelectionResolve([card.uuid]);
        } else {
          setBoardSelected(prev =>
            prev.includes(card.uuid)
              ? prev.filter(id => id !== card.uuid)
              : [...prev, card.uuid]
          );
        }
      }
      return;
    }

    // 自陣のアクティブドン!!をタップ → ドン!!付与の対象選択モードを開始する。
    // 対象（自リーダー/自キャラ）をハイライトし、続けて枚数を選ばせる。
    if (card.uuid === `donactive-${viewerId}` && isMyTurn && activeDonCount > 0) {
      setActionMenu(null);
      setSelectedCard(null);
      setIsDetailMode(false);
      setIsDonTargeting(true);
      return;
    }

    let currentLoc = 'unknown';
    const { p1, p2 } = gameState.players;

    const getPhysicalLocation = (playerState: typeof p1, targetCard: CardInstance) => {
      if (targetCard.uuid.startsWith('life-')) return 'life';
      if (targetCard.uuid.startsWith('trash-')) return 'trash';
      if (targetCard.uuid.startsWith('deck-')) return 'deck';
      if (targetCard.uuid.startsWith('don')) {
        if (targetCard.uuid.includes('donactive')) return 'don_active';
        if (targetCard.uuid.includes('donrest')) return 'don_rest';
        if (targetCard.uuid.includes('dondeck')) return 'don_deck';
      }
      if (playerState.leader?.uuid === targetCard.uuid) return 'leader';
      if (playerState.zones.field.some(c => c.uuid === targetCard.uuid)) return 'field';
      if (playerState.zones.hand.some(c => c.uuid === targetCard.uuid)) return 'hand';
      if (playerState.zones.trash.some(c => c.uuid === targetCard.uuid)) return 'trash';
      if (playerState.zones.life.some(c => c.uuid === targetCard.uuid)) return 'life';
      if (playerState.stage?.uuid === targetCard.uuid) return 'field';
      return null;
    };

    const p1Loc = getPhysicalLocation(p1, card);
    const p2Loc = getPhysicalLocation(p2, card);

    // 「自分」の基準: ソロは現手番、オンラインは自分の役割(viewerId)。
    if (viewerId === 'p1') {
      if (p1Loc) {
        currentLoc = p1Loc;
      } else if (p2Loc) {
        currentLoc = `opp_${p2Loc}`;
      }
    } else if (viewerId === 'p2') {
      if (p2Loc) {
        currentLoc = p2Loc;
      } else if (p1Loc) {
        currentLoc = `opp_${p1Loc}`;
      }
    }

    // オンラインでは自分の手番でなければ自陣カードも操作不可（閲覧のみ）。
    const isOperatable = ['leader', 'hand', 'field'].includes(currentLoc) && isMyTurn;
    // 操作可能カードで実行可能アクションが1つ以上あれば、詳細シートではなく
    // カード近傍のミニメニューを開く（タップ→即操作の導線）。
    const donCount = gameState.players[viewerId]?.don_active.length ?? 0;
    if (isOperatable && getAvailableActions(card, currentLoc, true, donCount).length > 0) {
      setActionMenu({ card, location: currentLoc, anchor: pos });
      return;
    }

    setSelectedCard({
      card,
      location: currentLoc,
      isMyTurn: isOperatable
    });
    setIsDetailMode(true);
  };

  // ドラッグ開始候補の登録（pointerdown 時）。実際のドラッグ開始は移動量が閾値を超えた時点
  // （window pointermove）で行う。ここでは「このカードがどの種類のドラッグになるか」を判定する。
  // タップ（小移動）の場合は pendingDrag が解消され、従来どおり onCardClick（ミニメニュー）が動く。
  const onCardDragStart = (card: CardInstance, pos: { x: number; y: number }) => {
    if (isPending || !gameState || !isMyTurn) return;
    // 攻撃対象選択・ドン付与対象選択・盤面選択モード中はドラッグを開始しない（既存導線を優先）。
    if (isAttackTargeting || isDonTargeting || isBoardSelectMode || isDonReturnMode) return;
    // メインフェイズ以外の選択要求中はドラッグ無効（MAIN_ACTION/ACTIVATE_MAIN は通常のメイン操作）。
    const A = CONST.c_to_s_interface.GAME_ACTIONS.TYPES;
    if (pendingRequest && pendingRequest.action !== 'MAIN_ACTION' && pendingRequest.action !== A.ACTIVATE_MAIN) return;

    const me = gameState.players[viewerId];
    if (!me) return;

    let kind: DragKind | null = null;
    if (card.uuid === `donactive-${viewerId}`) {
      const donCount = me.don_active?.length ?? 0;
      if (donCount > 0) kind = 'don';
    } else if (me.zones.hand.some(c => c.uuid === card.uuid)) {
      kind = 'play';
    } else if (me.leader && me.leader.uuid === card.uuid) {
      const t = normalizeCardType(me.leader.type);
      if (t === 'LEADER' || t === 'CHARACTER') kind = 'attack';
    } else {
      const fc = me.zones.field.find(c => c.uuid === card.uuid);
      if (fc && normalizeCardType(fc.type) === 'CHARACTER') kind = 'attack';
    }
    if (!kind) return;

    pendingDragRef.current = { card, kind, x: pos.x, y: pos.y };
  };

  useEffect(() => {
    setBoardSelected([]);
    // 新しい選択要求が来たら攻撃ターゲティング状態を解除する（ターゲティングと
    // 盤面選択オーバーレイの二重表示・競合を防ぐ）。
    if (pendingRequest && isAttackTargeting) {
      setIsAttackTargeting(false);
      setAttackingCardUuid(null);
    }
    // ドン!!付与の対象選択中に選択要求が割り込んだら解除する。
    if (pendingRequest && isDonTargeting) {
      setIsDonTargeting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- request_id 変化時のみ実行する意図（pendingRequest/isAttackTargeting は最新値を本体で参照）
  }, [pendingRequest?.request_id]);

  // 盤面(PIXI)は gameState 変化のたびに全再構築されカード位置が変わり得るため、
  // 状態変化・新しい選択要求が来たらミニメニューを閉じてアンカーのズレを防ぐ。
  useEffect(() => {
    setActionMenu(null);
  }, [gameState, pendingRequest?.request_id]);

  useEffect(() => {
    if (!pixiContainerRef.current || !boardReady) return;

    const app = new PIXI.Application({
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: COLORS.APP_BG,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    pixiContainerRef.current.appendChild(app.view as HTMLCanvasElement);
    appRef.current = app;

    // 演出レイヤ（全再構築から独立した永続オーバーレイ）と共有 ticker を初期化。
    effectsRef.current = createEffectsLayer();
    if (RECONCILE_BOARD) reconcilerRef.current = createBoardReconciler();
    attachTweenTicker(app);

    const coords = calculateCoordinates(window.innerWidth, window.innerHeight);
    setLayoutCoords(coords.turnEndPos);

    // オンラインではルーム START 時にサーバ側で対局生成済み。状態は WS で届くため
    // ここで createGame は呼ばない（ソロ/CPU のみ自前でゲーム生成）。
    // CPU 対戦は p2 を CPU として生成（p2DeckId を CPU のデッキに使う）。
    if (!isOnline) {
      // 先行: CPU はランダム(コイントス)、ソロは選択した firstChoice。
      startGame(
        p1DeckId, p2DeckId,
        vsCpu ? { vsCpu: true, cpuDifficulty, cpuDeck: p2DeckId } : undefined,
        vsCpu ? 'random' : firstChoice,
      );
    }

    const handleResize = () => {
      app.renderer.resize(window.innerWidth, window.innerHeight);
      const newCoords = calculateCoordinates(window.innerWidth, window.innerHeight);
      setLayoutCoords(newCoords.turnEndPos);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      detachTweenTicker();
      clearTweens();
      effectsRef.current = null;
      reconcilerRef.current = null;
      app.destroy(true, { children: true });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- PIXI app の初期化は盤面準備完了時に1回のみ。startGame等の再実行は不要
  }, [boardReady]);

  useEffect(() => {
    const app = appRef.current;
    if (!app || !gameState) return;

    const renderScene = () => {
      // 永続レイヤ（演出・可動カード）は破棄せず退避し、再構築後に最前面へ戻す。
      const effectsContainer = effectsRef.current?.container ?? null;
      const movableLayer = reconcilerRef.current?.layer ?? null;
      if (effectsContainer?.parent) effectsContainer.parent.removeChild(effectsContainer);
      if (movableLayer?.parent) movableLayer.parent.removeChild(movableLayer);

      while (app.stage.children.length > 0) {
        const child = app.stage.children[0];
        app.stage.removeChild(child);
        child.destroy({ children: true });
      }

      const { width: W, height: H } = app.screen;
      const coords = calculateCoordinates(W, H);
      const midY = H / 2;

      // 盤面の下側は常に viewerId。オンライン/CPU は自陣、ソロは手番(または判断要求中の判断者)。
      const bottomIsP2 = viewerId === 'p2';

      // ダークプレイマット背景（グラデ＋ビネット＋区画パネル＋発光ディバイダ＋手番グロー）。
      // 手番側ハーフ: active_player_id が下側(viewerId)なら bottom、相手なら top。
      const activeSide: ActiveSide = activePlayerId
        ? (activePlayerId === viewerId ? 'bottom' : 'top')
        : null;
      app.stage.addChild(createBoardBackground(W, H, coords, { activeSide }));
      const bottomPlayer = bottomIsP2 ? gameState.players.p2 : gameState.players.p1;
      const topPlayer = bottomIsP2 ? gameState.players.p1 : gameState.players.p2;

      const selectedSet = new Set(boardSelected);
      // viewer 反転時は全カードが鏡像移動するため 1 フレーム skip。
      const viewerFlipped = prevViewerRef.current !== null && prevViewerRef.current !== viewerId;
      // gameState が実際に変化した時だけアニメを動かす（UI のみの再描画で再発火させない）。
      const gameStateChanged = prevGameStateRef.current !== gameState;

      if (RECONCILE_BOARD && reconcilerRef.current) {
        // 固定パイル等は従来どおり再構築、可動実カードは reconcile で使い回す。
        const topItems = buildBoardItems(topPlayer, true, W, coords, onCardClick, highlightUuids, selectedSet, fixedViewer);
        const bottomItems = buildBoardItems(bottomPlayer, false, W, coords, onCardClick, highlightUuids, selectedSet, false, onCardDragStart);

        const topVirtual = new PIXI.Container();
        topVirtual.y = 0;
        const topDescs: MovableDescriptor[] = [];
        for (const it of topItems) {
          if (it.kind === 'virtual') topVirtual.addChild(it.display);
          else topDescs.push(it.desc);
        }
        const bottomVirtual = new PIXI.Container();
        bottomVirtual.y = midY;
        const bottomDescs: MovableDescriptor[] = [];
        for (const it of bottomItems) {
          if (it.kind === 'virtual') bottomVirtual.addChild(it.display);
          else bottomDescs.push(it.desc);
        }
        app.stage.addChild(topVirtual, bottomVirtual);

        reconcilerRef.current.reconcile(topDescs, bottomDescs, midY, viewerFlipped, gameStateChanged);
        if (movableLayer) app.stage.addChild(movableLayer);
      } else {
        // オンライン/CPU 対戦では相手(上側)の手札の中身を伏せて描画する。
        const topSide = createBoardSide(topPlayer, true, W, coords, onCardClick, highlightUuids, selectedSet, fixedViewer);
        topSide.y = 0;
        const bottomSide = createBoardSide(bottomPlayer, false, W, coords, onCardClick, highlightUuids, selectedSet, false, onCardDragStart);
        bottomSide.y = midY;
        app.stage.addChild(topSide, bottomSide);
      }

      // 演出レイヤを最前面へ再アタッチ（飛行中の演出を維持）。
      if (effectsContainer) app.stage.addChild(effectsContainer);

      // --- カード移動グライド（Phase3）---
      // 前回位置→今回位置を uuid で突き合わせ、移動カードを旧位置から滑らせる。
      const prevPos = prevPositionsRef.current;
      const newPos = snapshotPositions(app);
      if (gameStateChanged && !viewerFlipped && prevPos.size > 0) {
        for (const [uuid, np] of newPos) {
          const cont = findCardContainer(app, uuid);
          if (!cont || cont.destroyed) continue;
          const op = prevPos.get(uuid);
          if (op) {
            // 移動: 旧位置（グローバル差分＝ローカル差分; 各サイドは平行移動のみ）から新位置へ。
            const dx = op.x - np.x;
            const dy = op.y - np.y;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
              const baseX = cont.x;
              const baseY = cont.y;
              cont.x = baseX + dx;
              cont.y = baseY + dy;
              tween(
                {
                  durationMs: 220,
                  ease: easeOutCubic,
                  onUpdate: (k) => {
                    if (cont.destroyed) return;
                    cont.x = baseX + dx * (1 - k);
                    cont.y = baseY + dy * (1 - k);
                  },
                },
                cont,
                'glide',
              );
            }
          } else {
            // 登場: スケール/アルファのフェードイン。
            const sx = cont.scale.x;
            const sy = cont.scale.y;
            cont.alpha = 0;
            cont.scale.set(sx * 0.85, sy * 0.85);
            tween(
              {
                durationMs: 200,
                ease: easeOutCubic,
                onUpdate: (k) => {
                  if (cont.destroyed) return;
                  cont.alpha = k;
                  cont.scale.set(sx * (0.85 + 0.15 * k), sy * (0.85 + 0.15 * k));
                },
                onComplete: () => {
                  if (cont.destroyed) return;
                  cont.alpha = 1;
                  cont.scale.set(sx, sy);
                },
              },
              cont,
              'enter',
            );
          }
        }
      }
      // 進行中トゥイーンの中間位置で prevPos を汚さないよう、実変化時のみ保存。
      if (gameStateChanged) prevPositionsRef.current = newPos;
      prevGameStateRef.current = gameState;
      prevViewerRef.current = viewerId;
    };

    renderScene();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 描画は列挙した盤面状態の変化時のみ再実行する意図。定数/コールバックは最新を本体で参照
  }, [gameState, activePlayerId, isAttackTargeting, attackingCardUuid, pendingRequest, boardSelected, isDonTargeting]);

  // ドラッグ&ドロップの実体（window pointermove/pointerup）。onCardDragStart が登録した
  // pendingDrag を起点に、移動量が閾値を超えたらゴーストを生成して追従させ、ドロップ先を
  // 判定して対応アクションを送る。盤面再構築でゴーストが破棄された場合は安全に中断する。
  useEffect(() => {
    const app = appRef.current;
    if (!app || !gameState) return;

    const A = CONST.c_to_s_interface.GAME_ACTIONS.TYPES;
    const DRAG_THRESHOLD = LAYOUT_PARAMS.PHYSICS.TAP_THRESHOLD;

    // 攻撃ドロップ先候補（相手のリーダー/フィールド/ステージ）。
    const opp = gameState.players[opponentId];
    const attackUuids: string[] = opp
      ? [
          ...(opp.leader ? [opp.leader.uuid] : []),
          ...opp.zones.field.map(c => c.uuid),
          ...(opp.stage ? [opp.stage.uuid] : []),
        ]
      : [];
    // ドン!!付与ドロップ先候補（自陣のリーダー/フィールドのキャラクター）。
    const me = gameState.players[viewerId];
    const donUuids: string[] = me
      ? [
          ...(me.leader ? [me.leader.uuid] : []),
          ...me.zones.field
            .filter(c => normalizeCardType(c.type) === 'CHARACTER')
            .map(c => c.uuid),
        ]
      : [];

    const removeGhost = () => {
      const g = dragGhostRef.current;
      if (g) {
        if (!g.destroyed) {
          if (g.parent) g.parent.removeChild(g);
          g.destroy({ children: true });
        }
        dragGhostRef.current = null;
      }
    };
    const clearHighlight = () => {
      const h = dropHighlightRef.current;
      if (h) {
        if (!h.destroyed) h.destroy();
        dropHighlightRef.current = null;
      }
    };
    const removeAttackLine = () => {
      if (attackTickRef.current) {
        app.ticker.remove(attackTickRef.current);
        attackTickRef.current = null;
      }
      const l = attackLineRef.current;
      if (l) {
        if (!l.destroyed) {
          if (l.parent) l.parent.removeChild(l);
          l.destroy();
        }
        attackLineRef.current = null;
      }
      attackOriginRef.current = null;
      attackToRef.current = null;
    };
    // 盤面再構築でゴースト/ハイライトが破棄されたらドラッグを中断する。
    const ghostAlive = () => !!dragGhostRef.current && !dragGhostRef.current.destroyed;
    // ドラッグ中の視覚要素（ゴースト or 攻撃線）がまだ生きているか。
    const dragVisualAlive = () =>
      ghostAlive() || (!!attackLineRef.current && !attackLineRef.current.destroyed);

    // 攻撃元→終点を結ぶ「ネオン・テザー」。根元太→先端細のテーパー発光弦（紅グロー＋白金芯）に、
    // 終点は矢じりではなく回転する照準リング＋十字。phase で脈動・回転させ“生きてる”線にする。
    const drawAttackLine = (to: { x: number; y: number }, phase: number) => {
      const g = attackLineRef.current;
      const from = attackOriginRef.current;
      if (!g || g.destroyed || !from) return;
      g.clear();
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const bow = Math.min(len * 0.16, 70);
      const cx = (from.x + to.x) / 2 + nx * bow;
      const cy = (from.y + to.y) / 2 + ny * bow;
      const bez = (t: number) => {
        const u = 1 - t;
        return {
          x: u * u * from.x + 2 * u * t * cx + t * t * to.x,
          y: u * u * from.y + 2 * u * t * cy + t * t * to.y,
        };
      };
      const pulse = 0.85 + 0.15 * Math.sin(phase * 0.006);
      const ROUND = PIXI.LINE_CAP.ROUND;
      const JROUND = PIXI.LINE_JOIN.ROUND;
      // 自分の攻撃ターゲティングなので自陣カラー（緑系）。
      const pal = FX_SELF;
      // 外側グロー（太）と中間グローは単一ストロークで滑らかに。
      g.lineStyle({ width: 20, color: pal.glow, alpha: 0.12 * pulse, cap: ROUND, join: JROUND });
      g.moveTo(from.x, from.y);
      g.quadraticCurveTo(cx, cy, to.x, to.y);
      g.lineStyle({ width: 11, color: pal.glow2, alpha: 0.22 * pulse, cap: ROUND, join: JROUND });
      g.moveTo(from.x, from.y);
      g.quadraticCurveTo(cx, cy, to.x, to.y);
      // 芯（明・テーパー: 根元太→先端細）。短いセグメントで線幅を補間し、丸キャップで連続に。
      const N = 40;
      for (let i = 0; i < N; i++) {
        const t0 = i / N;
        const t1 = (i + 1) / N;
        const p0 = bez(t0);
        const p1 = bez(t1);
        const w = (6.5 * (1 - (t0 + t1) / 2) + 2.2) * pulse;
        g.lineStyle({ width: w, color: pal.core, alpha: 0.96, cap: ROUND, join: JROUND });
        g.moveTo(p0.x, p0.y);
        g.lineTo(p1.x, p1.y);
      }
      // 起点ノード（リング＋ドット）。
      g.lineStyle(2.5, pal.core, 0.9);
      g.drawCircle(from.x, from.y, 8);
      g.lineStyle(0);
      g.beginFill(pal.glow, 0.9);
      g.drawCircle(from.x, from.y, 3.6);
      g.endFill();
      // 終点の回転照準リング＋十字。
      const ang = phase * 0.0016;
      const R = 15 + Math.sin(phase * 0.006) * 1.5;
      g.lineStyle(1.5, pal.ring, 0.6);
      g.drawCircle(to.x, to.y, R + 5);
      g.lineStyle(2.5, pal.core, 0.95);
      g.drawCircle(to.x, to.y, R);
      for (let k = 0; k < 4; k++) {
        const a = ang + (k * Math.PI) / 2;
        g.moveTo(to.x + Math.cos(a) * (R - 4), to.y + Math.sin(a) * (R - 4));
        g.lineTo(to.x + Math.cos(a) * (R + 8), to.y + Math.sin(a) * (R + 8));
      }
      g.lineStyle(0);
      // 線・照準を最前面へ。
      if (g.parent === app.stage) app.stage.setChildIndex(g, app.stage.children.length - 1);
    };

    // 攻撃線を毎フレーム再描画（脈動・回転のため）。終点は onPointerMove が更新する attackToRef。
    const tickAttackLine = () => {
      if (!attackToRef.current) return;
      drawAttackLine(attackToRef.current, performance.now());
    };


    // uuid 群の中からドロップ点に最も近いカードを返す（実描画位置で判定）。
    const hitCandidate = (
      pos: { x: number; y: number },
      uuids: string[],
      hw: number,
      hh: number,
    ): { uuid: string; x: number; y: number } | null => {
      let best: { uuid: string; x: number; y: number } | null = null;
      let bestD = Infinity;
      for (const uuid of uuids) {
        const c = findCardContainer(app, uuid);
        if (!c || c.destroyed) continue;
        const gp = c.getGlobalPosition();
        const dx = pos.x - gp.x;
        const dy = pos.y - gp.y;
        if (Math.abs(dx) < hw / 2 && Math.abs(dy) < hh / 2) {
          const d = dx * dx + dy * dy;
          if (d < bestD) { bestD = d; best = { uuid, x: gp.x, y: gp.y }; }
        }
      }
      return best;
    };

    // PLAY 有効領域: 自陣（下半分）かつ手札行より上。盤面（フィールド）バンドを示す。
    const playRectAndValid = (pos: { x: number; y: number }) => {
      const W = app.screen.width;
      const H = app.screen.height;
      const coords = calculateCoordinates(W, H);
      const midY = H / 2;
      const handY = midY + coords.getY(4) + coords.CH / 2;
      const valid = pos.y > midY && pos.y < handY - coords.CH * 0.5;
      const rect = { x: W / 2, y: midY + coords.getY(1) + coords.CH / 2, w: W * 0.9, h: coords.CH };
      return { valid, rect };
    };

    const startGhost = (card: CardInstance, kind: DragKind, pos: { x: number; y: number }) => {
      // 攻撃: カード本体は動かさず、攻撃元から伸びるネオン・テザーで示す（ticker で脈動・回転）。
      if (kind === 'attack') {
        const origin = cardGlobalPos(app, card.uuid) ?? pos;
        attackOriginRef.current = origin;
        attackToRef.current = pos;
        const line = new PIXI.Graphics();
        line.eventMode = 'none';
        app.stage.addChild(line);
        attackLineRef.current = line;
        dragInfoRef.current = { card, kind };
        drawAttackLine(pos, performance.now());
        attackTickRef.current = tickAttackLine;
        app.ticker.add(tickAttackLine);
        return;
      }
      const coords = calculateCoordinates(app.screen.width, app.screen.height);
      const isDon = kind === 'don';
      const cw = isDon ? coords.CW * 0.7 : coords.CW;
      const ch = isDon ? coords.CH * 0.7 : coords.CH;
      const ghostCard = isDon
        ? ({ uuid: card.uuid, name: 'Don!! Active', card_id: 'DON' } as CardInstance)
        : card;
      const ghost = createCardContainer(ghostCard, cw, ch, { onClick: () => {}, isOpponent: false });
      ghost.eventMode = 'none';
      ghost.position.set(pos.x, pos.y);
      ghost.alpha = 0.85;
      ghost.scale.set(1.08);
      app.stage.addChild(ghost);
      dragGhostRef.current = ghost;
      dragInfoRef.current = { card, kind };
    };

    const drawHighlight = (rect: { x: number; y: number; w: number; h: number } | null) => {
      if (!rect) { clearHighlight(); return; }
      let g = dropHighlightRef.current;
      if (!g || g.destroyed) {
        g = new PIXI.Graphics();
        g.eventMode = 'none';
        app.stage.addChild(g);
        dropHighlightRef.current = g;
      }
      g.clear();
      g.lineStyle(3, 0xffd700, 1);
      g.beginFill(0xffd700, 0.18);
      g.drawRoundedRect(rect.x - rect.w / 2, rect.y - rect.h / 2, rect.w, rect.h, 8);
      g.endFill();
      // ゴーストを常に最前面へ。
      if (ghostAlive() && dragGhostRef.current!.parent === app.stage) {
        app.stage.setChildIndex(dragGhostRef.current!, app.stage.children.length - 1);
      }
    };

    const cancelDrag = () => {
      removeGhost();
      removeAttackLine();
      clearHighlight();
      dragInfoRef.current = null;
      pendingDragRef.current = null;
    };

    const onPointerMove = (e: PointerEvent) => {
      const pos = { x: e.clientX, y: e.clientY };

      // 閾値を超えたらゴーストを生成してドラッグ開始。
      if (pendingDragRef.current && !dragInfoRef.current) {
        const dx = pos.x - pendingDragRef.current.x;
        const dy = pos.y - pendingDragRef.current.y;
        if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
          startGhost(pendingDragRef.current.card, pendingDragRef.current.kind, pos);
          pendingDragRef.current = null;
        }
      }

      if (!dragInfoRef.current) return;
      // 盤面が再構築され視覚要素（ゴースト/線）が消えた場合は中断。
      if (!dragVisualAlive()) { cancelDrag(); return; }

      const coords = calculateCoordinates(app.screen.width, app.screen.height);
      const { kind } = dragInfoRef.current;

      // 対象カードがレスト（90°横向き）なら、枠の縦横を入れ替えて footprint に合わせる
      // （アクティブ向きの縦長枠のままだとレストのカードと向きが合わず不恰好になる）。
      const targetRect = (best: { uuid: string; x: number; y: number }) => {
        const rested = resolveCard(best.uuid, gameState)?.is_rest === true;
        return {
          x: best.x,
          y: best.y,
          w: rested ? coords.CH : coords.CW,
          h: rested ? coords.CW : coords.CH,
        };
      };

      // 攻撃: ゴーストではなく線の終点を更新する（描画は ticker が毎フレーム行う）。
      // 対象に重なれば終点をカード中心へスナップ。
      if (kind === 'attack') {
        const best = hitCandidate(pos, attackUuids, coords.CW, coords.CH);
        attackToRef.current = best ? { x: best.x, y: best.y } : pos;
        drawHighlight(best ? targetRect(best) : null);
        return;
      }

      dragGhostRef.current!.position.set(pos.x, pos.y);

      let rect: { x: number; y: number; w: number; h: number } | null = null;
      if (kind === 'don') {
        const best = hitCandidate(pos, donUuids, coords.CW, coords.CH);
        if (best) rect = targetRect(best);
      } else {
        const { valid, rect: pr } = playRectAndValid(pos);
        if (valid) rect = pr;
      }
      drawHighlight(rect);
    };

    const onPointerUp = async (e: PointerEvent) => {
      // ドラッグ未開始（タップ）の場合は何もしない（onCardClick が従来どおり処理する）。
      if (!dragInfoRef.current) { pendingDragRef.current = null; return; }

      const pos = { x: e.clientX, y: e.clientY };
      const info = dragInfoRef.current;
      cancelDrag();

      const coords = calculateCoordinates(app.screen.width, app.screen.height);
      if (info.kind === 'attack') {
        const best = hitCandidate(pos, attackUuids, coords.CW, coords.CH);
        if (best) {
          await handleAction(A.ATTACK_CONFIRM, { uuid: info.card.uuid, target_ids: [best.uuid] });
        }
      } else if (info.kind === 'don') {
        const best = hitCandidate(pos, donUuids, coords.CW, coords.CH);
        // ATTACH_DON は「付与先カード」を card_id として送る（ミニメニューと同じ）。
        if (best) await handleAction(A.ATTACH_DON, { uuid: best.uuid });
      } else {
        const { valid } = playRectAndValid(pos);
        if (valid) await handleAction(A.PLAY, { uuid: info.card.uuid });
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- ドラッグ系ハンドラは列挙状態の変化時のみ再登録。handleAction は最新を本体で参照
  }, [gameState, viewerId, opponentId, isMyTurn, isPending, pendingRequest, isAttackTargeting, isDonTargeting]);

  // 攻撃演出（Phase2）: active_battle の攻撃者/対象が確定したら、攻撃者の位置から
  // 対象へ ghost トークンを突進させ、最接近時に着弾フラッシュ＋対象シェイク。
  // この effect は renderScene の後に走るため、新盤面のカードを名前ではなく uuid で引ける。
  const battleAttacker = gameState?.active_battle?.attacker_uuid;
  const battleTarget = gameState?.active_battle?.target_uuid;
  useEffect(() => {
    if (!battleAttacker || !battleTarget) return;
    const app = appRef.current;
    const fx = effectsRef.current;
    if (!app || !fx) return;
    const from = cardGlobalPos(app, battleAttacker);
    const to = cardGlobalPos(app, battleTarget);
    if (!from || !to) return;

    // 攻撃元のサイドで配色（自分の攻撃＝緑 / 相手の攻撃＝赤）。盤面の枠色に対応。
    const me = gameState?.players[viewerId];
    const isMyAttack = !!me && (
      me.leader?.uuid === battleAttacker ||
      me.zones.field.some(c => c.uuid === battleAttacker) ||
      me.stage?.uuid === battleAttacker
    );
    const pal: FxPalette = isMyAttack ? FX_SELF : FX_OPP;

    const ROUND = PIXI.LINE_CAP.ROUND;
    const JROUND = PIXI.LINE_JOIN.ROUND;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const bow = Math.min(len * 0.16, 70);
    const cx = (from.x + to.x) / 2 + nx * bow;
    const cy = (from.y + to.y) / 2 + ny * bow;
    const bez = (t: number) => {
      const u = 1 - t;
      return { x: u * u * from.x + 2 * u * t * cx + t * t * to.x, y: u * u * from.y + 2 * u * t * cy + t * t * to.y };
    };

    const teth = new PIXI.Graphics(); teth.eventMode = 'none'; fx.container.addChild(teth);
    const bolt = new PIXI.Graphics(); bolt.eventMode = 'none'; fx.container.addChild(bolt);

    const drawTether = (alpha: number) => {
      teth.clear();
      teth.lineStyle({ width: 14, color: pal.glow, alpha: 0.12 * alpha, cap: ROUND, join: JROUND });
      teth.moveTo(from.x, from.y); teth.quadraticCurveTo(cx, cy, to.x, to.y);
      teth.lineStyle({ width: 8, color: pal.glow2, alpha: 0.22 * alpha, cap: ROUND, join: JROUND });
      teth.moveTo(from.x, from.y); teth.quadraticCurveTo(cx, cy, to.x, to.y);
      const N = 34;
      for (let i = 0; i < N; i++) {
        const t0 = i / N;
        const t1 = (i + 1) / N;
        const p0 = bez(t0);
        const p1 = bez(t1);
        teth.lineStyle({ width: 4 * (1 - (t0 + t1) / 2) + 1.4, color: pal.core, alpha: 0.9 * alpha, cap: ROUND, join: JROUND });
        teth.moveTo(p0.x, p0.y); teth.lineTo(p1.x, p1.y);
      }
    };
    const drawBolt = (p: { x: number; y: number }, r: number) => {
      bolt.clear();
      bolt.beginFill(pal.glow, 0.18); bolt.drawCircle(p.x, p.y, r * 2.3); bolt.endFill();
      bolt.beginFill(pal.glow2, 0.30); bolt.drawCircle(p.x, p.y, r * 1.4); bolt.endFill();
      bolt.beginFill(pal.core, 0.98); bolt.drawCircle(p.x, p.y, r); bolt.endFill();
    };
    const shockwave = (p: { x: number; y: number }) => {
      const r = new PIXI.Graphics(); r.eventMode = 'none'; fx.container.addChild(r);
      tween({ durationMs: 440, ease: easeOutCubic, onUpdate: (k) => {
        if (r.destroyed) return;
        r.clear();
        const rad = 8 + k * 48;
        r.lineStyle(3 * (1 - k) + 0.5, pal.ring, 0.9 * (1 - k));
        r.drawCircle(p.x, p.y, rad);
        r.lineStyle(2 * (1 - k), pal.glow, 0.5 * (1 - k));
        r.drawCircle(p.x, p.y, rad * 0.66);
      }, onComplete: () => { if (!r.destroyed) r.destroy(); } });
    };

    // ① チャージ: テザーが伸び、弾が攻撃元で溜まる。
    tween({ durationMs: 140, ease: easeOutCubic, onUpdate: (k) => {
      if (teth.destroyed) return;
      drawTether(0.9 * k);
      drawBolt(from, 5 + 2 * k);
    }, onComplete: () => {
      // ② ストライク: 弾がテザーを走って対象へ。
      tween({ durationMs: 200, ease: easeOutCubic, onUpdate: (k) => {
        if (bolt.destroyed) return;
        drawTether(0.9);
        drawBolt(bez(k), 8);
      }, onComplete: () => {
        // ③ 着弾: フラッシュ＋衝撃波リング＋火花＋対象シェイク。テザー/弾はフェードアウト。
        const t2 = cardGlobalPos(app, battleTarget) ?? to;
        fx.impactFlash(t2.x, t2.y, pal.flash);
        shockwave(t2);
        fx.puff(t2.x, t2.y, pal.spark);
        const tc = findCardContainer(app, battleTarget);
        if (tc) fx.shake(tc, 7, 260);
        tween({ durationMs: 160, ease: easeOutCubic, onUpdate: (k) => {
          if (!teth.destroyed) teth.alpha = 1 - k;
          if (!bolt.destroyed) bolt.alpha = 1 - k;
        }, onComplete: () => {
          if (!teth.destroyed) teth.destroy();
          if (!bolt.destroyed) bolt.destroy();
        } });
      } });
    } });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 攻撃確定時のみ発火。viewerId/gameState は最新を本体参照
  }, [battleAttacker, battleTarget]);

  // CPU 思考中はアニメを高速化し、cpu/step ポーリングを詰まらせない（Phase5）。
  useEffect(() => {
    setAnimSpeed(cpuThinking ? 2.6 : 1);
    return () => setAnimSpeed(1);
  }, [cpuThinking]);

  // ターン交代バナー（Phase5）。
  const [phaseBanner, setPhaseBanner] = useState<{ id: number; text: string } | null>(null);
  const bannerIdRef = useRef(0);
  const lastTurnRef = useRef<'p1' | 'p2' | null>(null);
  useEffect(() => {
    if (!activePlayerId || !boardReady) return;
    if (lastTurnRef.current === null) {
      lastTurnRef.current = activePlayerId;
      return;
    }
    if (lastTurnRef.current !== activePlayerId) {
      lastTurnRef.current = activePlayerId;
      const text = fixedViewer
        ? activePlayerId === selfId
          ? 'あなたのターン'
          : '相手のターン'
        : `${activePlayerId.toUpperCase()} のターン`;
      setPhaseBanner({ id: (bannerIdRef.current += 1), text });
    }
  }, [activePlayerId, boardReady, fixedViewer, selfId]);

  useEffect(() => {
    const handleBeforeUnload = () => {
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const handleBackToTitle = () => {
    // オンライン対戦からの離脱はルールロビーへ戻す（指定があれば）。
    if (isOnline && onForceBack) onForceBack();
    else onBack();
  };

  // ログ採取: クライアントのイベント履歴＋盤面に、CPU 思考トレース（/replay・cpu_trace 対局のみ）を
  // まとめて 1 つの JSON にし、クリップボードへコピーする（不可ならフォールバックで画面表示）。
  const handleCaptureLogs = async () => {
    const gid = gameState?.game_id ?? null;
    const dump: Record<string, unknown> = {
      capturedAt: new Date().toISOString(),
      game_id: gid,
      sessionId: sessionManager.getSessionId(),
      turn_info: gameState?.turn_info ?? null,
      winner: gameState?.turn_info?.winner ?? null,
      eventLog,
    };
    if (gid) {
      const replay = await apiClient.getReplay(gid);
      if (replay) {
        dump.replay = replay.replay;       // リプレイ種（seed/leaders/decks/actions）
        dump.cpuDecisions = replay.decisions; // CPU の各意思決定トレース
      }
    }
    const text = JSON.stringify(dump, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      window.alert('ログをクリップボードにコピーしました。チャットに貼り付けてください。');
    } catch {
      // クリップボード不可（非セキュアコンテキスト等）はテキスト表示にフォールバック。
      setCaptureText(text);
    }
  };

  // ── オンライン対戦のルームセットアップ（WAITING 中） ──
  if (isOnline && roomStatus !== 'PLAYING') {
    const myPreview = deckPreview[myPlayerId as 'p1' | 'p2'];
    const oppPreview = deckPreview[opponentId];
    const bothReady = readyStates.p1 && readyStates.p2;
    const isHost = myPlayerId === 'p1';

    const slot = (pid: 'p1' | 'p2') => {
      const isMine = pid === myPlayerId;
      const preview = pid === myPlayerId ? myPreview : (pid === opponentId ? oppPreview : null);
      const ready = readyStates[pid];
      return (
        <div key={pid} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ color: '#bdc3c7', fontSize: '12px', fontWeight: 'bold' }}>
              {pid === 'p1' ? 'Player 1 (先攻)' : 'Player 2 (後攻)'}{isMine ? '（あなた）' : ''}
            </label>
            <span style={{ color: ready ? '#2ecc71' : '#e74c3c', fontSize: '10px', fontWeight: 'bold' }}>{ready ? 'READY' : 'NOT READY'}</span>
          </div>
          {isMine ? (
            <div
              onClick={() => setSelectingDeckFor(pid)}
              style={{ height: '60px', background: '#2a1a1a', border: '1px solid #5d4037', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', position: 'relative' }}
            >
              {preview?.leader_id ? (
                <>
                  <img src={getCardImageUrl(preview.leader_id) || ''} alt="leader" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                  <span style={{ zIndex: 1, fontWeight: 'bold', textShadow: '0 2px 4px black' }}>{preview.leader_name || 'Deck Selected'}</span>
                </>
              ) : (
                <span style={{ color: '#7f8c8d', fontSize: '14px' }}>＋ デッキを選択</span>
              )}
            </div>
          ) : (
            <div style={{ height: '60px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7f8c8d', fontSize: '14px', border: '1px dashed #555' }}>
              {preview?.leader_id ? (preview.leader_name || 'Deck Selected') : '相手のデッキ選択を待っています...'}
            </div>
          )}
        </div>
      );
    };

    return (
      <div style={{ width: '100vw', height: '100vh', background: 'radial-gradient(circle at center, #3a2020 0%, #000000 100%)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box' }}>
        <div style={{ background: '#2c3e50', padding: '30px', borderRadius: '12px', border: '2px solid #7f8c8d', width: '90%', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', color: '#ecf0f1' }}>
          <h2 style={{ color: '#e74c3c', fontSize: '22px', fontWeight: 'bold', textAlign: 'center', borderBottom: '1px solid #7f8c8d', paddingBottom: '10px', margin: 0 }}>
            {roomName || 'ONLINE BATTLE'}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', fontSize: '11px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: wsConnected ? '#2ecc71' : '#e74c3c', display: 'inline-block' }} />
            <span style={{ color: '#bdc3c7' }}>{wsConnected ? '接続中' : `再接続中... (${reconnectAttemptRef.current}回目)`}</span>
          </div>

          {slot('p1')}
          <div style={{ textAlign: 'center', color: '#95a5a6', fontStyle: 'italic', margin: '-10px 0' }}>VS</div>
          {slot('p2')}

          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button onClick={onBack} style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid #95a5a6', color: '#95a5a6', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
              退出
            </button>
            {isHost && (
              <button
                onClick={() => sendRuleLobbyAction({ action_type: 'START', player_id: 'p1' })}
                disabled={!bothReady}
                style={{ flex: 1, padding: '12px', background: bothReady ? '#e67e22' : '#34495e', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: bothReady ? 'pointer' : 'not-allowed' }}
              >
                GAME START
              </button>
            )}
          </div>
          {!isHost && (
            <p style={{ color: '#7f8c8d', fontSize: '11px', textAlign: 'center', margin: 0 }}>
              ホスト(Player 1)の開始操作を待っています...
            </p>
          )}
        </div>

        {selectingDeckFor && (
          <DeckSelectModal
            title={`デッキを選択 (${selectingDeckFor.toUpperCase()})`}
            options={deckOptions}
            onSelect={(deckId) => {
              sendRuleLobbyAction({ action_type: 'SET_DECK', player_id: myPlayerId, deck_id: deckId });
              setSelectingDeckFor(null);
            }}
            onClose={() => setSelectingDeckFor(null)}
          />
        )}
        {errorToast && (
          <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#e74c3c', color: 'white', padding: '10px 20px', borderRadius: '5px', fontWeight: 'bold' }}>
            ⚠️ {errorToast}
            <button onClick={() => setErrorToast(null)} style={{ background: 'transparent', border: 'none', color: 'white', marginLeft: '10px', cursor: 'pointer' }}>×</button>
          </div>
        )}
      </div>
    );
  }

  if (!isOnline && !isSetupComplete) {
    const getLeaderImage = (deckId: string) => {
      const opt = deckOptions.find(d => d.id === deckId);
      return opt?.leaderId ? getCardImageUrl(opt.leaderId) : null;
    };
    const getDeckName = (deckId: string) => {
      const opt = deckOptions.find(d => d.id === deckId);
      return opt?.name || deckId;
    };

    return (
      <div style={{ width: '100vw', height: '100vh', background: 'radial-gradient(circle at center, #2c3e50 0%, #000000 100%)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box' }}>
        <div style={{ 
          background: '#2c3e50', padding: '30px', borderRadius: '12px', border: '2px solid #7f8c8d', 
          width: '90%', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '20px', 
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)', color: '#ecf0f1'
        }}>
          <h2 style={{ color: '#f1c40f', fontSize: '24px', fontWeight: 'bold', textAlign: 'center', borderBottom: '1px solid #7f8c8d', paddingBottom: '10px', margin: 0 }}>
            VS CPU SETUP
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ color: '#bdc3c7', fontSize: '12px', fontWeight: 'bold' }}>Player 1 (あなた)</label>
            <div 
              onClick={() => setSelectingDeckFor('p1')}
              style={{ 
                height: '60px', background: '#2a1a1a', border: '1px solid #5d4037', borderRadius: '4px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', position: 'relative'
              }}
            >
              {p1DeckId ? (
                <>
                  <img src={getLeaderImage(p1DeckId) || ''} alt="leader" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                  <span style={{ zIndex: 1, fontWeight: 'bold', textShadow: '0 2px 4px black' }}>{getDeckName(p1DeckId)}</span>
                </>
              ) : (
                <span style={{ color: '#7f8c8d', fontSize: '14px' }}>＋ デッキを選択</span>
              )}
            </div>
          </div>

          <div style={{ textAlign: 'center', color: '#95a5a6', fontStyle: 'italic', margin: '-10px 0' }}>VS</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ color: '#bdc3c7', fontSize: '12px', fontWeight: 'bold' }}>Player 2 (CPU)</label>
            <div 
              onClick={() => setSelectingDeckFor('p2')}
              style={{ 
                height: '60px', background: '#2a1a1a', border: '1px solid #5d4037', borderRadius: '4px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', position: 'relative'
              }}
            >
              {p2DeckId ? (
                <>
                  <img src={getLeaderImage(p2DeckId) || ''} alt="leader" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                  <span style={{ zIndex: 1, fontWeight: 'bold', textShadow: '0 2px 4px black' }}>{getDeckName(p2DeckId)}</span>
                </>
              ) : (
                <span style={{ color: '#7f8c8d', fontSize: '14px' }}>＋ デッキを選択</span>
              )}
            </div>
          </div>

          {/* 先行プレイヤー: ソロは選択、CPU はランダム(コイントス) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ color: '#bdc3c7', fontSize: '12px', fontWeight: 'bold' }}>先行プレイヤー</label>
            {vsCpu ? (
              <div style={{
                padding: '10px', borderRadius: '4px', textAlign: 'center',
                background: '#1f2a36', border: '1px dashed #5d6d7e', color: '#f1c40f', fontWeight: 'bold', fontSize: '13px',
              }}>
                🪙 ランダム（コイントス）
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '10px' }}>
                {(['p1', 'p2'] as const).map((pid) => {
                  const active = firstChoice === pid;
                  return (
                    <button
                      key={pid}
                      onClick={() => setFirstChoice(pid)}
                      style={{
                        flex: 1, padding: '10px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer',
                        border: active ? '2px solid #f1c40f' : '1px solid #5d6d7e',
                        background: active ? 'rgba(241,196,15,0.18)' : '#1f2a36',
                        color: active ? '#f1c40f' : '#bdc3c7',
                      }}
                    >
                      {pid.toUpperCase()} が先攻
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button onClick={onBack} style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid #95a5a6', color: '#95a5a6', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
              キャンセル
            </button>
            <button
              onClick={handleGameStart}
              disabled={!p1DeckId || !p2DeckId}
              style={{ 
                flex: 1, padding: '12px', 
                background: (p1DeckId && p2DeckId) ? '#e67e22' : '#34495e', 
                color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', 
                cursor: (p1DeckId && p2DeckId) ? 'pointer' : 'not-allowed'
              }}
            >
              GAME START
            </button>
          </div>
        </div>

        {selectingDeckFor && (
          <DeckSelectModal 
            title={`デッキを選択 (${selectingDeckFor.toUpperCase()})`}
            options={deckOptions}
            onSelect={(deckId) => {
              if (selectingDeckFor === 'p1') setP1DeckId(deckId);
              else setP2DeckId(deckId);
              setSelectingDeckFor(null);
            }}
            onClose={() => setSelectingDeckFor(null)}
          />
        )}
      </div>
    );
  }

  const showSearchModal =
    isMyDecision &&
    !isBoardSelectMode &&
    !isDonReturnMode && (
      pendingRequest?.action === CONST.c_to_s_interface.PENDING_ACTION_TYPES.SEARCH_AND_SELECT ||
      pendingRequest?.action === CONST.c_to_s_interface.PENDING_ACTION_TYPES.ARRANGE_DECK ||
      // ドン!!返却(RETURN_DON)で候補が盤面外/混在のとき等はモーダルにフォールバック。
      // 候補がすべてドン!!なら isDonReturnMode により盤面から直接選ばせる。
      pendingRequest?.action === CONST.c_to_s_interface.PENDING_ACTION_TYPES.SELECT_RESOURCE ||
      pendingRequest?.action === CONST.c_to_s_interface.BATTLE_ACTIONS.TYPES.SELECT_COUNTER
    );
    
  const constraints = pendingRequest?.constraints || {};

  // selectable_uuids からカード実体を引く際は、両プレイヤーの全ゾーンを走査する。
  // 従来は手札・場・リーダーのみで、トラッシュ/デッキ/ライフ/ドン!!を対象にした選択
  // （蘇生・デッキ操作・ライフ操作・ドン返却 等）で候補が空になり選べず停止し得た。
  // サーバが candidates 実体を送る場合はそれを優先する。
  const modalCandidates = pendingRequest?.candidates || (
    (gameState && pendingRequest?.selectable_uuids)
      ? ([gameState.players.p1, gameState.players.p2].flatMap((p) => [
          // サーバ state は非公開ゾーン（deck/don_deck）や don_attached の配列を送らない（count のみ）。
          // 未定義ゾーンをそのままスプレッドすると TypeError になるため全て || [] でガードする。
          ...(p.zones.hand || []),
          ...(p.zones.field || []),
          ...(p.zones.life || []),
          ...(p.zones.trash || []),
          ...(p.zones.deck || []),
          ...(p.zones.don_deck || []),
          ...(p.don_active || []),
          ...(p.don_rested || []),
          ...(p.don_attached || []),
          p.leader,
          p.stage,
        ]) as (CardInstance | null | undefined)[])
          .filter((c): c is CardInstance => !!c && pendingRequest.selectable_uuids!.includes(c.uuid))
      : []
  );

  const activeDonCount = gameState
    ? gameState.players[viewerId]?.don_active.length ?? 0
    : 0;

  return (
    <div ref={pixiContainerRef} style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>

      {/* 先行決定コイントス（CPU/対戦）。閉じるとゲーム画面へ。 */}
      {coinResult && (
        <CoinFlip
          firstPlayerId={coinResult}
          viewerId={viewerId}
          onClose={() => setCoinResult(null)}
        />
      )}

      <button
        onClick={handleBackToTitle}
        style={{
          position: 'absolute',
          top: layoutCoords ? `${layoutCoords.y}px` : '50%',
          left: '10px',
          transform: 'translateY(-50%)',
          zIndex: Z_INDEX.OVERLAY + 20,
          background: 'rgba(0, 0, 0, 0.6)',
          color: '#aaa',
          border: '1px solid #444',
          borderRadius: '4px',
          padding: '4px 9px',
          cursor: 'pointer',
          fontSize: '11px',
        }}
      >
        TOP
      </button>

      <button
        onClick={() => setShowLog(p => !p)}
        style={{
          position: 'absolute',
          top: layoutCoords ? `${layoutCoords.y}px` : '50%',
          left: '55px',
          transform: 'translateY(-50%)',
          zIndex: Z_INDEX.OVERLAY + 20,
          background: showLog ? 'rgba(41,128,185,0.7)' : 'rgba(0, 0, 0, 0.6)',
          color: showLog ? '#fff' : '#aaa',
          border: showLog ? '1px solid #2980b9' : '1px solid #444',
          borderRadius: '4px',
          padding: '4px 9px',
          cursor: 'pointer',
          fontSize: '11px',
        }}
      >
        ログ
      </button>

      <button
        onClick={handleCaptureLogs}
        title="ログ（イベント履歴＋CPU思考トレース）をクリップボードにコピー"
        style={{
          position: 'absolute',
          top: layoutCoords ? `${layoutCoords.y}px` : '50%',
          left: '100px',
          transform: 'translateY(-50%)',
          zIndex: Z_INDEX.OVERLAY + 20,
          background: 'rgba(0, 0, 0, 0.6)',
          color: '#aaa',
          border: '1px solid #444',
          borderRadius: '4px',
          padding: '4px 9px',
          cursor: 'pointer',
          fontSize: '11px',
        }}
      >
        採取
      </button>

      {showLog && layoutCoords && (
        <ActionLog
          events={eventLog}
          anchorY={layoutCoords.y}
          onClose={() => setShowLog(false)}
        />
      )}

      {captureText !== null && (
        <ModalShell width="min(680px, 92vw)" padding="14px" onClose={() => setCaptureText(null)}>
            <div style={{ color: MODAL.TEXT_MUTED, fontSize: '12px', marginBottom: '8px' }}>
              クリップボードに自動コピーできませんでした。下のテキストを選択してコピーしてください。
            </div>
            <textarea
              readOnly
              autoFocus
              onFocus={e => e.currentTarget.select()}
              value={captureText}
              style={{ width: '100%', height: '50vh', fontFamily: 'monospace', fontSize: '11px', background: 'rgba(0,0,0,0.4)', color: '#ccc', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '8px', boxSizing: 'border-box' }}
            />
            <div style={{ textAlign: 'right', marginTop: '8px' }}>
              <ModalButton variant="primary" onClick={() => setCaptureText(null)} style={{ padding: '7px 16px', fontSize: '12px' }}>閉じる</ModalButton>
            </div>
        </ModalShell>
      )}

      {/* 効果適用の一時的な視覚フィードバック（KO/ドロー/バウンス等） */}
      <EffectToast toasts={effectToasts} />
      <PhaseBanner banner={phaseBanner} />

      {/* CPU 対戦: 手番/勝敗の表示と CPU 思考中インジケータ */}
      {vsCpu && (
        <div style={{ position: 'absolute', top: '8px', right: '10px', zIndex: Z_INDEX.OVERLAY + 20, display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.6)', border: '1px solid #555', borderRadius: '4px', padding: '4px 10px' }}>
          {cpuThinking && (
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f1c40f', display: 'inline-block', flexShrink: 0, animation: 'pulse 1s infinite' }} />
          )}
          <span style={{ color: 'white', fontSize: '11px', whiteSpace: 'nowrap' }}>
            {gameState?.turn_info?.winner
              ? (gameState.turn_info.winner === selfId ? '🏆 勝利' : '敗北')
              : cpuThinking
              ? 'CPU 思考中...'
              : isMyTurn
              ? (isMyDecision || !pendingRequest ? 'あなたの番' : '選択してください')
              : 'CPU の番'}
          </span>
        </div>
      )}

      {/* オンライン対戦: 接続状況と手番/待機状態の表示 */}
      {isOnline && (
        <div style={{ position: 'absolute', top: '8px', right: '10px', zIndex: Z_INDEX.OVERLAY + 20, display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.6)', border: '1px solid #555', borderRadius: '4px', padding: '4px 10px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: wsConnected ? '#2ecc71' : '#e74c3c', display: 'inline-block', flexShrink: 0 }} />
          <span style={{ color: 'white', fontSize: '11px', whiteSpace: 'nowrap' }}>
            {!wsConnected
              ? `再接続中... (${reconnectAttemptRef.current}回目)`
              : gameState?.turn_info?.winner
              ? (gameState.turn_info.winner === myPlayerId ? '🏆 勝利' : '敗北')
              : isMyTurn
              ? (isMyDecision || !pendingRequest ? `あなたの番 (${(myPlayerId as string).toUpperCase()})` : '相手の操作待ち')
              : '相手の番'}
          </span>
        </div>
      )}

      {isMyDecision && pendingRequest?.action === 'MULLIGAN' && (
        <ModalShell width="540px" onBackdropClick={null}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <h2 style={{ color: MODAL.ACCENT, margin: 0, fontSize: '22px' }}>マリガン</h2>
            <p style={{ color: MODAL.TEXT_PRIMARY, margin: 0, fontSize: '13px', textAlign: 'center' }}>
              手札を確認してください。マリガンを選ぶと<br />手札5枚を全てデッキに戻し、引き直します。
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '500px' }}>
              {(pendingRequest.candidates || []).map((card: CardInstance) => (
                <div
                  key={card.uuid}
                  style={{
                    width: '72px', height: '100px', borderRadius: '5px',
                    border: '2px solid rgba(255,255,255,0.2)', overflow: 'hidden',
                  }}
                >
                  <img
                    src={getCardImageUrl(card.card_id)}
                    alt={card.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '14px' }}>
              <ModalButton variant="warning" disabled={isPending} onClick={handleMulligan} style={{ padding: '11px 28px', fontSize: '15px' }}>
                マリガン（全交換）
              </ModalButton>
              <ModalButton variant="success" disabled={isPending} onClick={handleKeepHand} style={{ padding: '11px 28px', fontSize: '15px' }}>
                キープ
              </ModalButton>
            </div>
            <p style={{ color: MODAL.TEXT_MUTED, fontSize: '11px', margin: 0 }}>
              ※マリガンは1回のみ・全枚交換です。新しい手札はそのまま確定します。
            </p>
          </div>
        </ModalShell>
      )}

      {isMyDecision && (pendingRequest?.action === 'CONFIRM_OPTIONAL' || pendingRequest?.action === 'CONFIRM_TRIGGER') && (() => {
        // 盤面とどのカードの効果かを確認できるよう、背景は透過しコンパクトなパネルで表示する。
        const sourceCard = gameState ? resolveCard(pendingRequest.source_card_uuid, gameState) : null;
        const sourceImg = sourceCard?.card_id ? getCardImageUrl(sourceCard.card_id) : null;
        return (
          <ModalShell width="320px" transparentScrim onBackdropClick={null}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <h2 style={{ color: MODAL.ACCENT, margin: 0, fontSize: '17px' }}>
                {pendingRequest?.action === 'CONFIRM_TRIGGER' ? '【トリガー】' : '任意効果'}
              </h2>
              {sourceImg && (
                <img
                  src={sourceImg}
                  alt={sourceCard?.name ?? ''}
                  style={{ width: '110px', borderRadius: '6px', boxShadow: '0 2px 10px rgba(0,0,0,0.6)' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <p style={{ color: MODAL.TEXT_PRIMARY, margin: 0, fontSize: '13px', textAlign: 'center', maxWidth: '260px' }}>
                {pendingRequest.message}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px' }}>
                <ModalButton variant="success" disabled={isPending} onClick={() => handleOptionalConfirm(true)}>
                  発動する
                </ModalButton>
                <ModalButton variant="secondary" disabled={isPending} onClick={() => handleOptionalConfirm(false)}>
                  発動しない
                </ModalButton>
              </div>
            </div>
          </ModalShell>
        );
      })()}

      {isMyDecision && pendingRequest?.action === 'DECLARE_COST' && (
        <ModalShell width="480px" onBackdropClick={null}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <h2 style={{ color: MODAL.ACCENT, margin: 0, fontSize: '22px' }}>コスト宣言</h2>
            <p style={{ color: MODAL.TEXT_PRIMARY, margin: 0, fontSize: '13px', textAlign: 'center' }}>
              {pendingRequest.message}<br />
              コストを宣言します。相手のデッキトップが宣言コストと一致すると効果が発動します。
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '440px' }}>
              {Array.from(
                { length: (pendingRequest.constraints?.max ?? 10) - (pendingRequest.constraints?.min ?? 0) + 1 },
                (_, i) => (pendingRequest.constraints?.min ?? 0) + i
              ).map((n) => (
                <ModalButton
                  key={n}
                  variant="primary"
                  disabled={isPending}
                  onClick={() => handleDeclareCost(n)}
                  style={{ width: '48px', height: '48px', padding: 0, fontSize: '18px' }}
                >
                  {n}
                </ModalButton>
              ))}
            </div>
          </div>
        </ModalShell>
      )}

      {errorToast && (
        <div style={{
          ...toastPillStyle('error', false),
          position: 'absolute', top: '80px', left: '50%', transform: 'translateX(-50%)',
          zIndex: TOAST_Z_INDEX,
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span>⚠️ {errorToast}</span>
          <button onClick={() => setErrorToast(null)} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '16px', cursor: 'pointer', marginLeft: '10px' }}>×</button>
        </div>
      )}

      {isAttackTargeting && (
        <PromptBanner
          position="center"
          topPx={layoutCoords?.y}
          accentDot
          message="攻撃対象を選択してください"
          actions={[{ label: 'キャンセル', variant: 'secondary', onClick: () => { setIsAttackTargeting(false); setAttackingCardUuid(null); } }]}
        />
      )}

      {isDonTargeting && (
        <PromptBanner
          position="center"
          topPx={layoutCoords?.y}
          accentDot
          message="ドン!!を付与する対象を選択してください"
          subText={`アクティブなドン!!: ${activeDonCount}枚`}
          actions={[{ label: 'キャンセル', variant: 'secondary', onClick: () => setIsDonTargeting(false) }]}
        />
      )}

      {isBoardSelectMode && (() => {
        // 盤面に覆い被さらず最上部中央へスリムに配置する（PromptBanner が背後タップを透過、
        // ボタンのみ有効化）。選択候補はカードのハイライトで示す。
        // ブロック/カウンターは専用の見出し・配色・効果説明で明確に区別する。
        const battleMeta = getBattleDecisionMeta(pendingRequest!.action);
        const actions: PromptBannerAction[] = [];
        if (maxSelect > 1) {
          actions.push({
            label: '確定', variant: 'success',
            disabled: boardSelected.length < minSelect || isPending,
            onClick: () => handleSelectionResolve(boardSelected),
          });
        }
        // 「〜1枚まで」等の任意対象(min=0,max=1)で0枚を選ぶ導線。空選択で確定する。
        if (maxSelect === 1 && minSelect === 0) {
          actions.push({ label: '選ばない', variant: 'ghost', disabled: isPending, onClick: () => handleSelectionResolve([]) });
        }
        if (pendingRequest!.can_skip) {
          // バトル選択時は「パス」の意味（ブロックしない／カウンターしない）を明示する。
          actions.push({ label: battleMeta?.passLabel ?? 'パス', variant: 'danger', disabled: isPending, onClick: handlePass });
        }
        const baseHint = maxSelect > 1
          ? `${boardSelected.length} / ${maxSelect} 枚選択中（最小 ${minSelect}）`
          : (minSelect === 0 ? 'カードをタップ、または「選ばない」' : 'カードをタップして選択');
        const subText = battleMeta
          ? (maxSelect > 1 ? `${battleMeta.selectHint}（${boardSelected.length}/${maxSelect}）` : battleMeta.selectHint)
          : baseHint;

        const battlePanel = gameState?.active_battle && battleMeta ? (() => {
          const ab = gameState.active_battle!;
          const attacker = resolveCard(ab.attacker_uuid, gameState);
          const target = resolveCard(ab.target_uuid, gameState);
          return (
            <BattleDecisionPanel
              meta={battleMeta}
              info={{
                attackerName: attacker?.name ?? '攻撃',
                attackerPower: attacker?.power ?? 0,
                targetName: target?.name ?? '対象',
                targetBasePower: target?.power ?? 0,
                counterBuff: ab.counter_buff ?? 0,
              }}
            />
          );
        })() : null;

        return (
          <PromptBanner
            pointerThrough
            accentDot={!battleMeta}
            accentColor={battleMeta?.color}
            message={battleMeta
              ? <BattleDecisionHeader meta={battleMeta} defenderLabel={isDefendingDecision ? (pendingRequest!.player_id?.toUpperCase() ?? null) : null} />
              : `${decisionNote}${pendingRequest!.message}`}
            subText={subText}
            actions={actions}
          >
            {battleMeta ? battlePanel : (gameState?.active_battle && (() => {
              const ab = gameState.active_battle;
              const attacker = resolveCard(ab.attacker_uuid, gameState);
              const target = resolveCard(ab.target_uuid, gameState);
              const counterBuff = ab.counter_buff ?? 0;
              const attackerPwr = attacker?.power ?? 0;
              const targetBase = target?.power ?? 0;
              const targetEff = targetBase + counterBuff;
              const survives = attackerPwr < targetEff;
              return (
                <div style={{
                  margin: '1px 0 2px', padding: '7px 10px', borderRadius: '8px',
                  background: 'rgba(0,0,0,0.3)', fontSize: '12px', lineHeight: 1.6,
                }}>
                  <div style={{ color: COLORS.OVERLAY_BORDER_HIGHLIGHT, marginBottom: '4px' }}>
                    ⚔ {attacker?.name ?? '攻撃'}（{attackerPwr}） → {target?.name ?? '対象'}
                  </div>
                  <div>
                    対象パワー：{targetBase}
                    {counterBuff > 0 && (
                      <span style={{ color: '#ffff00', fontWeight: 'bold' }}> +{counterBuff}</span>
                    )}
                    {' '}= <span style={{ fontWeight: 'bold' }}>{targetEff}</span>
                  </div>
                  {counterBuff > 0 && (
                    <div style={{ color: '#f1c40f' }}>カウンター累計：+{counterBuff}</div>
                  )}
                  <div style={{ fontWeight: 'bold', color: survives ? '#2ecc71' : '#e74c3c' }}>
                    {survives ? '✔ このパワーで耐えられます' : '✖ あと ' + (attackerPwr - targetEff + 1) + ' 必要'}
                  </div>
                </div>
              );
            })())}
          </PromptBanner>
        );
      })()}

      {/* ドン!!返却: 盤面のドン!!（アクティブ/レスト）・付与先キャラを直接タップして選ぶ。 */}
      {isDonReturnMode && (() => {
        const remaining = Math.max(0, maxSelect - boardSelected.length);
        const actions: PromptBannerAction[] = [];
        if (boardSelected.length > 0) {
          actions.push({ label: 'やり直す', variant: 'ghost', disabled: isPending, onClick: () => setBoardSelected([]) });
        }
        return (
          <PromptBanner
            pointerThrough
            accentDot
            message={pendingRequest!.message || 'デッキに戻すドン!!を選んでください'}
            subText={`盤面のドン!!（アクティブ／レスト）か、付与先のキャラをタップ — あと ${remaining} 枚`}
            actions={actions}
          />
        );
      })()}

      {isMyDecision && pendingRequest && !isAttackTargeting && !showSearchModal && !isBoardSelectMode && !isDonReturnMode && pendingRequest.action !== 'MAIN_ACTION' && (
        <PromptBanner
          position="center"
          topPx={layoutCoords?.y}
          message={`${decisionNote}${pendingRequest.message}`}
          subText={PENDING_ACTION_LABELS[pendingRequest.action] || pendingRequest.action}
          actions={pendingRequest.can_skip
            ? [{ label: isPending ? '送信中...' : 'パス', variant: 'danger', disabled: isPending, onClick: handlePass }]
            : undefined}
        >
          {gameState?.active_battle && (
            <div style={{ fontSize: '12px', color: COLORS.OVERLAY_BORDER_HIGHLIGHT }}>
              ⚔ 「{resolveCardName(gameState.active_battle.attacker_uuid, gameState)}」
              →「{resolveCardName(gameState.active_battle.target_uuid, gameState)}」
            </div>
          )}

          {pendingRequest.options && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', pointerEvents: 'auto' }}>
              {(pendingRequest.options as unknown as string[]).map((label: string, idx: number) => (
                <ModalButton key={idx} variant="primary" fullWidth disabled={isPending} onClick={() => handleOptionSelect(idx)}>
                  {label}
                </ModalButton>
              ))}
            </div>
          )}
        </PromptBanner>
      )}

      {isMyDecision && isMyTurn && (pendingRequest?.action === CONST.c_to_s_interface.GAME_ACTIONS.TYPES.ACTIVATE_MAIN || pendingRequest?.action === 'MAIN_ACTION') && (
        <button
          onClick={handleTurnEnd} disabled={isPending}
          style={{
            position: 'absolute',
            left: layoutCoords ? `${layoutCoords.x}px` : 'auto',
            top: layoutCoords ? `${layoutCoords.y}px` : '50%',
            right: layoutCoords ? 'auto' : '20px',
            transform: 'translateY(-50%)',
            padding: '10px 20px',
            backgroundColor: isPending ? COLORS.BTN_DISABLED : COLORS.BTN_PRIMARY,
            color: 'white', border: 'none', borderRadius: '5px',
            cursor: isPending ? 'not-allowed' : 'pointer', zIndex: Z_INDEX.NOTIFICATION, fontWeight: 'bold',
            whiteSpace: 'nowrap'
          }}
        >
          {isPending ? '送信中...' : 'ターン終了'}
        </button>
      )}

    {actionMenu && (
      <CardActionMenu
        key={actionMenu.card.uuid + (actionMenu.donMode ? ':don' : '')}
        card={actionMenu.card}
        location={actionMenu.location}
        activeDonCount={activeDonCount}
        anchor={actionMenu.anchor}
        initialDonMode={actionMenu.donMode}
        onAction={handleAction}
        onShowDetail={() => {
          setSelectedCard({ card: actionMenu.card, location: actionMenu.location, isMyTurn: true });
          setIsDetailMode(true);
          setActionMenu(null);
        }}
        onClose={() => setActionMenu(null)}
      />
    )}

    {isDetailMode && selectedCard && (
      <CardDetailSheet
        card={selectedCard.card}
        location={selectedCard.location}
        isMyTurn={selectedCard.isMyTurn}
        activeDonCount={activeDonCount}
        onAction={handleAction}
        onClose={() => {
          setIsDetailMode(false);
          setSelectedCard(null);
        }}
      />
    )}

    {showSearchModal && modalCandidates.length > 0 && (
      <CardSelectModal
        key={pendingRequest?.request_id}
        candidates={modalCandidates}
        message={decisionNote + (pendingRequest?.message || "")}
        minSelect={constraints.min ?? 1}
        maxSelect={constraints.max ?? 1}
        onConfirm={handleSelectionResolve}
        onCancel={pendingRequest?.can_skip ? handlePass : undefined}
        selectableUuids={pendingRequest?.selectable_uuids ?? undefined}
        allowPosition={pendingRequest?.allow_position ?? false}
      />
    )}


    </div>
  );
};
