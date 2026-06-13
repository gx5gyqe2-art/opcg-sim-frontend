import { useCallback, useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { LAYOUT_CONSTANTS, LAYOUT_PARAMS } from '../layout/layout.config';
import { calculateCoordinates } from '../layout/layoutEngine';
import { createBoardSide } from '../ui/BoardSide';
import { useGameAction } from '../game/actions';
import { CardDetailSheet } from '../ui/CardDetailSheet';
import { CardActionMenu } from '../ui/CardActionMenu';
import { CardSelectModal } from '../ui/CardSelectModal';
import { getAvailableActions } from '../game/cardActions';
import { DeckSelectModal, type DeckOption } from '../ui/DeckSelectModal';
import { ActionLog } from '../ui/ActionLog';
import { EffectToast, type EffectToastItem } from '../ui/EffectToast';
import { API_CONFIG } from '../api/api.config';
import { apiClient } from '../api/client';
import { getCardImageUrl } from '../utils/imageAssets';
import CONST from '../../shared_constants.json';
import { logger } from '../utils/logger';
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
  } | null>(null);
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const [isAttackTargeting, setIsAttackTargeting] = useState(false);
  const [attackingCardUuid, setAttackingCardUuid] = useState<string | null>(null);
  const [boardSelected, setBoardSelected] = useState<string[]>([]);

  const [layoutCoords, setLayoutCoords] = useState<{ x: number, y: number } | null>(null);
  
  const [p1DeckId, setP1DeckId] = useState(initialP1);
  const [p2DeckId, setP2DeckId] = useState(initialP2);
  const [isSetupComplete, setIsSetupComplete] = useState(!!(initialP1 && initialP2));
  const [deckOptions, setDeckOptions] = useState<DeckOption[]>([]);
  const [selectingDeckFor, setSelectingDeckFor] = useState<'p1' | 'p2' | null>(null);
  const [eventLog, setEventLog] = useState<ActionEvent[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [effectToasts, setEffectToasts] = useState<EffectToastItem[]>([]);
  const toastIdRef = useRef(0);

  const { COLORS } = LAYOUT_CONSTANTS;
  const { Z_INDEX, ALPHA } = LAYOUT_PARAMS;

  const activePlayerId = gameState?.turn_info?.active_player_id as "p1" | "p2" | undefined;

  // この端末を操作しているプレイヤー視点。
  // ・ソロ(both): 現在の手番プレイヤー（下側操作者）が常に切り替わる従来挙動。
  // ・オンライン: 自分の役割(p1/p2)で固定し、自陣を常に下側に描画する。
  const viewerId: "p1" | "p2" = fixedViewer ? selfId : (activePlayerId ?? (CONST.PLAYER_KEYS.P1 as "p1"));
  const opponentId: "p1" | "p2" = viewerId === "p1" ? "p2" : "p1";
  // 自陣固定時(オンライン/CPU)、メインの操作が可能なのは自分の手番のときのみ。
  const isMyTurn = !fixedViewer || activePlayerId === selfId;
  // 選択要求(マリガン/ブロッカー/カウンター/効果選択 等)が自分宛てかどうか。
  const isMyDecision = !fixedViewer || pendingRequest?.player_id === selfId;
  // 盤面(PIXI)を初期化・描画してよいか。オンラインはルームが PLAYING になってから。
  // CPU 対戦はソロと同じく createGame 完了（isSetupComplete）後。
  const boardReady = isOnline ? roomStatus === 'PLAYING' : isSetupComplete;

  const MAX_LOG = 50;
  const addEventLog = useCallback((newEvents: ActionEvent[]) => {
    setEventLog(prev => [...newEvents, ...prev].slice(0, MAX_LOG));

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
      } catch(e) {
        console.error(e);
      }

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
        } catch (e) { logger.error('ws.parse_error', String(e)); }
      };
      ws.onerror = () => { logger.error('ws.error', 'WebSocket error'); };
      ws.onclose = () => {
        if (!isMountedRef.current) return;
        setWsConnected(false);
        const attempt = reconnectAttemptRef.current;
        const delay = Math.min(2000 * Math.pow(2, attempt), 30000);
        reconnectAttemptRef.current += 1;
        logger.warn('ws.disconnected', `Reconnecting in ${delay}ms (attempt ${attempt + 1})`);
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

  const boardUuids = gameState ? new Set<string>([
    ...(gameState.players.p1.zones.field.map(c => c.uuid)),
    ...(gameState.players.p1.zones.hand.map(c => c.uuid)),
    ...(gameState.players.p2.zones.field.map(c => c.uuid)),
    ...(gameState.players.p2.zones.hand.map(c => c.uuid)),
    ...(gameState.players.p1.leader ? [gameState.players.p1.leader.uuid] : []),
    ...(gameState.players.p2.leader ? [gameState.players.p2.leader.uuid] : []),
    ...(gameState.players.p1.stage ? [gameState.players.p1.stage.uuid] : []),
    ...(gameState.players.p2.stage ? [gameState.players.p2.stage.uuid] : []),
  ]) : new Set<string>();

  const isBoardSelectMode =
    isMyDecision &&
    !isAttackTargeting &&
    !!pendingRequest &&
    (pendingRequest.action === CONST.c_to_s_interface.PENDING_ACTION_TYPES.SEARCH_AND_SELECT ||
     pendingRequest.action === CONST.c_to_s_interface.BATTLE_ACTIONS.TYPES.SELECT_COUNTER ||
     // ブロッカー選択も盤面（防御側フィールド）からの選択。これが抜けていたため
     // 「ブロッカーを選択」要求でカードをクリックできず、パスしかできなかった（=ブロック不能）。
     pendingRequest.action === CONST.c_to_s_interface.BATTLE_ACTIONS.TYPES.SELECT_BLOCKER) &&
    (pendingRequest.selectable_uuids?.length ?? 0) > 0 &&
    pendingRequest.selectable_uuids!.some(uuid => boardUuids.has(uuid));

  const selectableUuids = isBoardSelectMode
    ? new Set(pendingRequest!.selectable_uuids)
    : new Set<string>();

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

    logger.log({
      level: 'info',
      action: "ui.onCardClick",
      msg: `Card: ${card.name}, Loc: ${currentLoc}, Turn: ${activePlayerId}, Operatable: ${isOperatable}`,
      payload: { uuid: card.uuid, activePlayerId, currentLoc }
    });

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
  
  useEffect(() => {
    setBoardSelected([]);
    // 新しい選択要求が来たら攻撃ターゲティング状態を解除する（ターゲティングと
    // 盤面選択オーバーレイの二重表示・競合を防ぐ）。
    if (pendingRequest && isAttackTargeting) {
      setIsAttackTargeting(false);
      setAttackingCardUuid(null);
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

    const coords = calculateCoordinates(window.innerWidth, window.innerHeight);
    setLayoutCoords(coords.turnEndPos);

    // オンラインではルーム START 時にサーバ側で対局生成済み。状態は WS で届くため
    // ここで createGame は呼ばない（ソロ/CPU のみ自前でゲーム生成）。
    // CPU 対戦は p2 を CPU として生成（p2DeckId を CPU のデッキに使う）。
    if (!isOnline) {
      startGame(p1DeckId, p2DeckId, vsCpu ? { vsCpu: true, cpuDifficulty, cpuDeck: p2DeckId } : undefined);
    }

    const handleResize = () => {
      app.renderer.resize(window.innerWidth, window.innerHeight);
      const newCoords = calculateCoordinates(window.innerWidth, window.innerHeight);
      setLayoutCoords(newCoords.turnEndPos);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      app.destroy(true, { children: true });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- PIXI app の初期化は盤面準備完了時に1回のみ。startGame等の再実行は不要
  }, [boardReady]);

  useEffect(() => {
    const app = appRef.current;
    if (!app || !gameState) return;

    const renderScene = () => {
      while (app.stage.children.length > 0) {
        const child = app.stage.children[0];
        app.stage.removeChild(child);
        child.destroy({ children: true });
      }

      const { width: W, height: H } = app.screen;
      const coords = calculateCoordinates(W, H);
      const midY = H / 2;

      const bg = new PIXI.Graphics();
      bg.beginFill(LAYOUT_CONSTANTS.COLORS.OPPONENT_BG).drawRect(0, 0, W, midY).endFill();
      bg.beginFill(LAYOUT_CONSTANTS.COLORS.PLAYER_BG).drawRect(0, midY, W, H - midY).endFill();
      app.stage.addChild(bg);

      const border = new PIXI.Graphics();
      border.lineStyle(2, COLORS.BORDER_LINE, ALPHA.BORDER_LINE);
      border.moveTo(0, midY);
      border.lineTo(W, midY);
      app.stage.addChild(border);

      // 自陣固定時(オンライン/CPU)は自陣(viewerId)を常に下側へ。ソロは現手番を下側へ（従来挙動）。
      const bottomIsP2 = fixedViewer ? viewerId === 'p2' : activePlayerId === 'p2';
      const bottomPlayer = bottomIsP2 ? gameState.players.p2 : gameState.players.p1;
      const topPlayer = bottomIsP2 ? gameState.players.p1 : gameState.players.p2;

      const selectedSet = new Set(boardSelected);
      // オンライン/CPU 対戦では相手(上側)の手札の中身を伏せて描画する。
      const topSide = createBoardSide(topPlayer, true, W, coords, onCardClick, selectableUuids, selectedSet, fixedViewer);
      topSide.y = 0;

      const bottomSide = createBoardSide(bottomPlayer, false, W, coords, onCardClick, selectableUuids, selectedSet, false);
      bottomSide.y = midY;

      app.stage.addChild(topSide, bottomSide);
    };

    renderScene();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 描画は列挙した盤面状態の変化時のみ再実行する意図。定数/コールバックは最新を本体で参照
  }, [gameState, activePlayerId, isAttackTargeting, attackingCardUuid, pendingRequest, boardSelected]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      logger.flushLogs();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const handleBackToTitle = () => {
    logger.flushLogs();
    // オンライン対戦からの離脱はルールロビーへ戻す（指定があれば）。
    if (isOnline && onForceBack) onForceBack();
    else onBack();
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
    !isBoardSelectMode && (
      pendingRequest?.action === CONST.c_to_s_interface.PENDING_ACTION_TYPES.SEARCH_AND_SELECT ||
      pendingRequest?.action === CONST.c_to_s_interface.PENDING_ACTION_TYPES.ARRANGE_DECK ||
      // ドン!!返却(RETURN_DON)の対象選択。場のドン!!（候補）からモーダルで選ばせる。
      pendingRequest?.action === CONST.c_to_s_interface.PENDING_ACTION_TYPES.SELECT_RESOURCE ||
      pendingRequest?.action === CONST.c_to_s_interface.BATTLE_ACTIONS.TYPES.SELECT_COUNTER
    );
    
  const constraints = pendingRequest?.constraints || {};

  const modalCandidates = pendingRequest?.candidates || (
    (gameState && pendingRequest?.selectable_uuids) ? 
      [
        ...gameState.players.p1.zones.hand, 
        ...gameState.players.p1.zones.field, 
        ...gameState.players.p2.zones.hand, 
        ...gameState.players.p2.zones.field,
        gameState.players.p1.leader,
        gameState.players.p2.leader
      ].filter((c): c is CardInstance => !!c && pendingRequest.selectable_uuids!.includes(c.uuid)) 
      : []
  );

  const activeDonCount = gameState
    ? gameState.players[viewerId]?.don_active.length ?? 0
    : 0;

  return (
    <div ref={pixiContainerRef} style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      
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

      {showLog && layoutCoords && (
        <ActionLog
          events={eventLog}
          anchorY={layoutCoords.y}
          onClose={() => setShowLog(false)}
        />
      )}

      {/* 効果適用の一時的な視覚フィードバック（KO/ドロー/バウンス等） */}
      <EffectToast toasts={effectToasts} />

      {/* CPU 対戦: 手番/勝敗の表示と CPU 思考中インジケータ */}
      {vsCpu && (
        <div style={{ position: 'absolute', top: '8px', right: '10px', zIndex: Z_INDEX.OVERLAY + 20, display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.6)', border: '1px solid #555', borderRadius: '4px', padding: '4px 10px' }}>
          {cpuThinking && (
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f1c40f', display: 'inline-block', flexShrink: 0, animation: 'pulse 1s infinite' }} />
          )}
          <span style={{ color: 'white', fontSize: '11px' }}>
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
          <span style={{ color: 'white', fontSize: '11px' }}>
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
        <div style={{
          position: 'absolute', inset: 0, zIndex: Z_INDEX.OVERLAY + 50,
          background: 'rgba(0,0,0,0.90)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '16px', padding: '20px', boxSizing: 'border-box',
        }}>
          <h2 style={{ color: '#f1c40f', margin: 0, fontSize: '22px' }}>マリガン</h2>
          <p style={{ color: '#ecf0f1', margin: 0, fontSize: '13px', textAlign: 'center' }}>
            手札を確認してください。マリガンを選ぶと<br />手札5枚を全てデッキに戻し、引き直します。
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '500px' }}>
            {(pendingRequest.candidates || []).map((card: CardInstance) => (
              <div
                key={card.uuid}
                style={{
                  width: '72px', height: '100px', borderRadius: '5px',
                  border: '2px solid #555', overflow: 'hidden',
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
          <div style={{ display: 'flex', gap: '14px' }}>
            <button
              onClick={handleMulligan}
              disabled={isPending}
              style={{
                padding: '11px 30px', borderRadius: '6px', fontWeight: 'bold', fontSize: '15px',
                background: isPending ? '#555' : '#e67e22',
                color: 'white', border: 'none',
                cursor: isPending ? 'not-allowed' : 'pointer',
              }}
            >
              マリガン（全交換）
            </button>
            <button
              onClick={handleKeepHand}
              disabled={isPending}
              style={{
                padding: '11px 30px', borderRadius: '6px', fontWeight: 'bold', fontSize: '15px',
                background: isPending ? '#555' : '#27ae60',
                color: 'white', border: 'none',
                cursor: isPending ? 'not-allowed' : 'pointer',
              }}
            >
              キープ
            </button>
          </div>
          <p style={{ color: '#7f8c8d', fontSize: '11px', margin: 0 }}>
            ※マリガンは1回のみ・全枚交換です。新しい手札はそのまま確定します。
          </p>
        </div>
      )}

      {isMyDecision && (pendingRequest?.action === 'CONFIRM_OPTIONAL' || pendingRequest?.action === 'CONFIRM_TRIGGER') && (() => {
        // 盤面とどのカードの効果かを確認できるよう、背景は透過しコンパクトなパネルで表示する。
        const sourceCard = gameState ? resolveCard(pendingRequest.source_card_uuid, gameState) : null;
        const sourceImg = sourceCard?.card_id ? getCardImageUrl(sourceCard.card_id) : null;
        return (
          <div style={{
            position: 'absolute', inset: 0, zIndex: Z_INDEX.OVERLAY + 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <div style={{
              pointerEvents: 'auto',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
              padding: '16px 20px', borderRadius: '12px',
              background: 'rgba(20,24,33,0.78)', border: `2px solid ${COLORS.OVERLAY_BORDER_HIGHLIGHT}`,
              boxShadow: '0 6px 24px rgba(0,0,0,0.5)', maxWidth: '90%',
            }}>
              <h2 style={{ color: '#f1c40f', margin: 0, fontSize: '17px' }}>
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
              <p style={{ color: '#ecf0f1', margin: 0, fontSize: '13px', textAlign: 'center', maxWidth: '260px' }}>
                {pendingRequest.message}
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => handleOptionalConfirm(true)}
                  disabled={isPending}
                  style={{
                    padding: '9px 26px', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px',
                    background: isPending ? '#555' : '#27ae60', color: 'white', border: 'none',
                    cursor: isPending ? 'not-allowed' : 'pointer',
                  }}
                >
                  発動する
                </button>
                <button
                  onClick={() => handleOptionalConfirm(false)}
                  disabled={isPending}
                  style={{
                    padding: '9px 26px', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px',
                    background: isPending ? '#555' : '#7f8c8d', color: 'white', border: 'none',
                    cursor: isPending ? 'not-allowed' : 'pointer',
                  }}
                >
                  発動しない
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {isMyDecision && pendingRequest?.action === 'DECLARE_COST' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: Z_INDEX.OVERLAY + 50,
          background: 'rgba(0,0,0,0.90)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '16px', padding: '20px', boxSizing: 'border-box',
        }}>
          <h2 style={{ color: '#f1c40f', margin: 0, fontSize: '22px' }}>コスト宣言</h2>
          <p style={{ color: '#ecf0f1', margin: 0, fontSize: '13px', textAlign: 'center' }}>
            {pendingRequest.message}<br />
            コストを宣言します。相手のデッキトップが宣言コストと一致すると効果が発動します。
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '440px' }}>
            {Array.from(
              { length: (pendingRequest.constraints?.max ?? 10) - (pendingRequest.constraints?.min ?? 0) + 1 },
              (_, i) => (pendingRequest.constraints?.min ?? 0) + i
            ).map((n) => (
              <button
                key={n}
                onClick={() => handleDeclareCost(n)}
                disabled={isPending}
                style={{
                  width: '48px', height: '48px', borderRadius: '8px', fontWeight: 'bold', fontSize: '18px',
                  background: isPending ? '#555' : '#2980b9', color: 'white', border: '1px solid #fff',
                  cursor: isPending ? 'not-allowed' : 'pointer',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {errorToast && (
        <div style={{
          position: 'absolute', top: '80px', left: '50%', transform: 'translateX(-50%)',
          zIndex: Z_INDEX.OVERLAY + 10, backgroundColor: '#e74c3c', color: 'white',
          padding: '10px 20px', borderRadius: '5px', boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', border: '1px solid white'
        }}>
          <span>⚠️ {errorToast}</span>
          <button onClick={() => setErrorToast(null)} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '16px', cursor: 'pointer', marginLeft: '10px' }}>×</button>
        </div>
      )}

      {isAttackTargeting && (
        <div style={{ position: 'absolute', top: layoutCoords ? `${layoutCoords.y}px` : '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: Z_INDEX.OVERLAY, background: COLORS.OVERLAY_ATTACK_BG, padding: '15px', borderRadius: '8px', color: 'white', fontWeight: 'bold', border: '2px solid white' }}>
          攻撃対象を選択してください
          <button onClick={() => { setIsAttackTargeting(false); setAttackingCardUuid(null); }} style={{ marginLeft: '15px', padding: '2px 10px', cursor: 'pointer' }}>キャンセル</button>
        </div>
      )}

      {isBoardSelectMode && (
        <div style={{
          position: 'absolute', top: layoutCoords ? `${layoutCoords.y}px` : '50%', left: '50%', transform: 'translate(-50%, -50%)',
          zIndex: Z_INDEX.NOTIFICATION, background: COLORS.OVERLAY_INFO_BG,
          padding: '15px', borderRadius: '8px', color: 'white', textAlign: 'center',
          border: `2px solid ${COLORS.HIGHLIGHT_SELECTABLE_CSS}`,
          minWidth: '220px', maxWidth: '320px',
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: maxSelect > 1 ? '8px' : 0 }}>
            {decisionNote}{pendingRequest!.message}
          </div>
          {gameState?.active_battle && (() => {
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
                margin: '4px 0 10px', padding: '8px 10px', borderRadius: '6px',
                background: 'rgba(0,0,0,0.35)', fontSize: '12px', lineHeight: 1.6,
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
          })()}
          {maxSelect > 1 && (
            <>
              <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '8px' }}>
                {boardSelected.length} / {maxSelect}枚選択中
              </div>
              <button
                onClick={() => handleSelectionResolve(boardSelected)}
                disabled={boardSelected.length < minSelect || isPending}
                style={{
                  padding: '6px 20px', background: boardSelected.length >= minSelect ? COLORS.BTN_SUCCESS : COLORS.BTN_DISABLED,
                  color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold',
                  cursor: boardSelected.length >= minSelect && !isPending ? 'pointer' : 'not-allowed',
                  marginBottom: pendingRequest!.can_skip ? '8px' : 0,
                }}
              >
                確定
              </button>
            </>
          )}
          {pendingRequest!.can_skip && (
            <button
              onClick={handlePass}
              disabled={isPending}
              style={{
                display: 'block', margin: '0 auto', marginTop: maxSelect > 1 ? '0' : '0',
                padding: '6px 20px', background: isPending ? COLORS.BTN_DISABLED : COLORS.BTN_DANGER,
                color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold',
                cursor: isPending ? 'not-allowed' : 'pointer',
              }}
            >
              パス
            </button>
          )}
        </div>
      )}

      {isMyDecision && pendingRequest && !isAttackTargeting && !showSearchModal && !isBoardSelectMode && pendingRequest.action !== 'MAIN_ACTION' && (
        <div style={{
            position: 'absolute', top: layoutCoords ? `${layoutCoords.y}px` : '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: Z_INDEX.NOTIFICATION, background: COLORS.OVERLAY_INFO_BG,
            padding: '15px', borderRadius: '8px', color: 'white', textAlign: 'center',
            border: `2px solid ${COLORS.OVERLAY_BORDER_HIGHLIGHT}`,
            maxWidth: '320px', minWidth: '220px',
        }}>
          <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>
            {PENDING_ACTION_LABELS[pendingRequest.action] || pendingRequest.action}
          </div>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '13px' }}>
            {decisionNote}{pendingRequest.message}
          </div>
          {gameState?.active_battle && (
            <div style={{ fontSize: '12px', color: COLORS.OVERLAY_BORDER_HIGHLIGHT, marginBottom: '10px' }}>
              ⚔ 「{resolveCardName(gameState.active_battle.attacker_uuid, gameState)}」
              →「{resolveCardName(gameState.active_battle.target_uuid, gameState)}」
            </div>
          )}

          {pendingRequest.options && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
              {(pendingRequest.options as unknown as string[]).map((label: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => handleOptionSelect(idx)}
                  disabled={isPending}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: COLORS.BTN_PRIMARY,
                    color: 'white',
                    border: '1px solid white',
                    borderRadius: '4px',
                    cursor: isPending ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {pendingRequest.can_skip && (
            <button 
              onClick={handlePass} disabled={isPending}
              style={{ 
                padding: '8px 24px', backgroundColor: isPending ? COLORS.BTN_DISABLED : COLORS.BTN_DANGER, 
                color: 'white', border: 'none', borderRadius: '4px', cursor: isPending ? 'not-allowed' : 'pointer', fontWeight: 'bold' 
              }}
            >
              {isPending ? '送信中...' : 'パス'}
            </button>
          )}
        </div>
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
            cursor: isPending ? 'not-allowed' : 'pointer', zIndex: Z_INDEX.NOTIFICATION, fontWeight: 'bold'
          }}
        >
          {isPending ? '送信中...' : 'ターン終了'}
        </button>
      )}

    {actionMenu && (
      <CardActionMenu
        card={actionMenu.card}
        location={actionMenu.location}
        activeDonCount={activeDonCount}
        anchor={actionMenu.anchor}
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
