import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { LAYOUT_CONSTANTS } from '../layout/layout.config';
import { calculateCoordinates } from '../layout/layoutEngine';
import { createSandboxBoardSide } from '../ui/SandboxBoardSide';
import { createCardContainer } from '../ui/CardRenderer';
import { createInspectOverlay } from '../ui/InspectOverlay';
import type { InspectOverlayContainer } from '../ui/InspectOverlay';
import { CardDetailSheet } from '../ui/CardDetailSheet';
import { CardSelectModal } from '../ui/CardSelectModal';
import { DeckSelectModal, type DeckOption } from '../ui/DeckSelectModal';
import { apiClient } from '../api/client';
import type { GameState, CardInstance } from '../game/types';
import { API_CONFIG } from '../api/api.config';
import { logger } from '../utils/logger';
import { handleLocalAction } from '../game/localActionHandler';
import { getCardImageUrl } from '../utils/imageAssets';

const MOCK_DECKS: Record<string, any> = {
  'imu.json': {
    leader: { name: "イム", card_id: "ST01-001", power: 5000, type: "LEADER", life: 5 },
    cards: Array.from({ length: 50 }, (_, i) => ({
      name: `聖地マリージョア兵 ${i + 1}`,
      card_id: `OP01-${String(i + 1).padStart(3, '0')}`,
      power: 3000 + (i % 5) * 1000,
      cost: 1 + (i % 5),
      counter: 1000,
      type: "CHARACTER",
      trigger_text: i % 3 === 0 ? "トリガーあり" : "",
      effect_text: "登場時: カードを1枚引く。"
    }))
  },
  'nami.json': {
    leader: { name: "ナミ", card_id: "OP03-040", power: 5000, type: "LEADER", life: 5 },
    cards: Array.from({ length: 50 }, (_, i) => ({
      name: `クリマ・タクト ${i + 1}`,
      card_id: `OP03-${String(i + 1).padStart(3, '0')}`,
      power: 2000 + (i % 4) * 1000,
      cost: 1 + (i % 4),
      counter: 2000,
      type: "EVENT",
      trigger_text: i % 2 === 0 ? "トリガー: 手札に加える" : "",
      effect_text: "メイン: 相手のキャラ1枚をレストにする。"
    }))
  }
};

type DragState = { card: CardInstance; sprite: PIXI.Container; startPos: { x: number, y: number }; } | null;

// 進行中のローカルサンドボックス状態を保存するsessionStorageキー（クラッシュ/リロード復帰用）
const SANDBOX_STATE_KEY = 'opcg_sandbox_state';

const SMALL_SCALE = 0.7;

const getDropZone = (
  pos: { x: number; y: number },
  isTopArea: boolean,
  W: number,
  H: number,
  coords: ReturnType<typeof calculateCoordinates>
): string | null => {
  const midY = H / 2;
  const THRESHOLD = coords.CH;
  const getX = (val: number) => isTopArea ? W - val : val;
  const yBase = isTopArea ? 0 : midY;
  const r1Y = isTopArea ? coords.midY - coords.getY(1) - coords.CH / 2 : yBase + coords.getY(1) + coords.CH / 2;
  const r2Y = isTopArea ? coords.midY - coords.getY(2) - coords.CH / 2 : yBase + coords.getY(2) + coords.CH / 2;
  const r3Y = isTopArea ? coords.midY - coords.getY(3) - coords.CH / 2 : yBase + coords.getY(3) + coords.CH / 2;
  const r4Y = isTopArea ? coords.midY - coords.getY(4) - coords.CH / 2 : yBase + coords.getY(4) + coords.CH / 2;
  const checkDist = (tx: number, ty: number) => Math.sqrt(Math.pow(tx - pos.x, 2) + Math.pow(ty - pos.y, 2));
  if (checkDist(getX(coords.getLeaderX(W)), r2Y) < THRESHOLD) return 'leader';
  if (checkDist(getX(coords.getStageX(W)), r2Y) < THRESHOLD) return 'stage';
  if (checkDist(getX(coords.getLifeX(W)), r2Y) < THRESHOLD) return 'life';
  if (checkDist(getX(coords.getTrashX(W)), r3Y) < THRESHOLD) return 'trash';
  if (checkDist(getX(coords.getDeckX(W)), r2Y) < THRESHOLD) return 'deck';
  if (Math.abs(r4Y - pos.y) < coords.CH) return 'hand';
  if (checkDist(getX(coords.getDonDeckX(W)), r3Y) < THRESHOLD) return 'don_deck';
  if (checkDist(getX(coords.getDonActiveX(W)), r3Y) < THRESHOLD) return 'don_active';
  if (checkDist(getX(coords.getDonRestX(W)), r3Y) < THRESHOLD) return 'don_rested';
  if (Math.abs(r1Y - pos.y) < coords.CH) return 'field';
  return null;
};

const getZoneRect = (
  zone: string,
  isTopArea: boolean,
  W: number,
  H: number,
  coords: ReturnType<typeof calculateCoordinates>
): { x: number; y: number; w: number; h: number } | null => {
  const midY = H / 2;
  const { CW, CH } = coords;
  const sCW = CW * SMALL_SCALE, sCH = CH * SMALL_SCALE;
  const getX = (val: number) => isTopArea ? W - val : val;
  const yBase = isTopArea ? 0 : midY;
  const r1Y = isTopArea ? coords.midY - coords.getY(1) - CH / 2 : yBase + coords.getY(1) + CH / 2;
  const r2Y = isTopArea ? coords.midY - coords.getY(2) - CH / 2 : yBase + coords.getY(2) + CH / 2;
  const r3Y = isTopArea ? coords.midY - coords.getY(3) - CH / 2 : yBase + coords.getY(3) + CH / 2;
  const r4Y = isTopArea ? coords.midY - coords.getY(4) - CH / 2 : yBase + coords.getY(4) + CH / 2;
  switch (zone) {
    case 'leader':     return { x: getX(coords.getLeaderX(W)),    y: r2Y, w: CW,      h: CH };
    case 'stage':      return { x: getX(coords.getStageX(W)),     y: r2Y, w: CW,      h: CH };
    case 'life':       return { x: getX(coords.getLifeX(W)),      y: r2Y, w: CW,      h: CH };
    case 'deck':       return { x: getX(coords.getDeckX(W)),      y: r2Y, w: CW,      h: CH };
    case 'trash':      return { x: getX(coords.getTrashX(W)),     y: r3Y, w: sCW,     h: sCH };
    case 'don_deck':   return { x: getX(coords.getDonDeckX(W)),   y: r3Y, w: sCW,     h: sCH };
    case 'don_active': return { x: getX(coords.getDonActiveX(W)), y: r3Y, w: sCW,     h: sCH };
    case 'don_rested': return { x: getX(coords.getDonRestX(W)),   y: r3Y, w: sCW,     h: sCH };
    case 'hand':       return { x: W / 2,                         y: r4Y, w: W * 0.9, h: CH };
    case 'field':      return { x: W / 2,                         y: r1Y, w: W * 0.9, h: CH };
    default: return null;
  }
};

type DonTarget = { kind: 'leader' | 'field'; index: number; x: number; y: number };

// DONカードのアタッチ先（リーダー or フィールドキャラ）を「最も近いカード」で解決する。
// ハイライト(onPointerMove)とドロップ実行(onPointerUp)で共通利用し、判定の不一致を防ぐ。
const getDonAttachTarget = (
  pos: { x: number; y: number },
  isTopArea: boolean,
  W: number,
  H: number,
  coords: ReturnType<typeof calculateCoordinates>,
  hasLeader: boolean,
  fieldCount: number
): DonTarget | null => {
  const midY = H / 2;
  const getX = (val: number) => isTopArea ? W - val : val;
  const yBase = isTopArea ? 0 : midY;
  const leaderY = isTopArea ? (coords.midY - coords.getY(2) - coords.CH / 2) : (yBase + coords.getY(2) + coords.CH / 2);
  const fieldY = isTopArea ? (coords.midY - coords.getY(1) - coords.CH / 2) : (yBase + coords.getY(1) + coords.CH / 2);

  let best: DonTarget | null = null;
  let bestDist = Infinity;
  const consider = (kind: 'leader' | 'field', index: number, cx: number, cy: number) => {
    const dx = pos.x - cx, dy = pos.y - cy;
    // 縦横ともカード幅/高さの半分以内をターゲット領域とし、その中で最も近い中心を採用
    if (Math.abs(dx) < coords.CW / 2 && Math.abs(dy) < coords.CH / 2) {
      const d = dx * dx + dy * dy;
      if (d < bestDist) { bestDist = d; best = { kind, index, x: cx, y: cy }; }
    }
  };

  if (hasLeader) consider('leader', -1, getX(coords.getLeaderX(W)), leaderY);
  for (let i = 0; i < fieldCount; i++) {
    consider('field', i, getX(coords.getFieldX(i, W, coords.CW, fieldCount)), fieldY);
  }
  return best;
};

interface SandboxGameProps {
  gameId?: string;
  myPlayerId?: string;
  roomName?: string;
  onBack: () => void;
  onForceBack?: () => void;
  initialP1DeckId?: string;
  initialP2DeckId?: string;
}

export const SandboxGame = ({
  gameId: initialGameId,
  myPlayerId = 'both',
  roomName,
  onBack,
  onForceBack,
  initialP1DeckId,
  initialP2DeckId
}: SandboxGameProps) => {
  const pixiContainerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const overlayRef = useRef<InspectOverlayContainer | null>(null);

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [activeGameId, setActiveGameId] = useState<string | null>(initialGameId || null);
  const [dragState, setDragState] = useState<DragState>(null);
  const [isPending, setIsPending] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  const [deckOptions, setDeckOptions] = useState<DeckOption[]>([]);
  const [selectingDeckFor, setSelectingDeckFor] = useState<string | null>(null);

  const [inspecting, setInspecting] = useState<{ type: 'deck' | 'life' | 'trash', pid: string } | null>(null);
  const [revealedCardIds, setRevealedCardIds] = useState<Set<string>>(new Set());
  const [layoutCoords, setLayoutCoords] = useState<{ x: number, y: number } | null>(null);
  const [dropChoice, setDropChoice] = useState<{ card: CardInstance, destPid: string, destZone: string } | null>(null);
  
  const [replacementState, setReplacementState] = useState<{ card: CardInstance, destPid: string } | null>(null);
  
  const [selectedCard, setSelectedCard] = useState<CardInstance | null>(null);
  const inspectScrollXRef = useRef(20);
  const { COLORS } = LAYOUT_CONSTANTS;

  const longPressTimerRef = useRef<any>(null);
  const pressStartPosRef = useRef<{x: number, y: number} | null>(null);
  
  const pendingDragRef = useRef<{ card: CardInstance, x: number, y: number } | null>(null);
  const longPressTriggeredRef = useRef(false);

  const dragStateRef = useRef(dragState);
  useEffect(() => { dragStateRef.current = dragState; }, [dragState]);

  const dropHighlightRef = useRef<PIXI.Graphics | null>(null);

  // WebSocket 再接続用
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const isMountedRef = useRef(true);
  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; }; }, []);

  const clearDropHighlight = () => {
    if (dropHighlightRef.current) {
      dropHighlightRef.current.destroy();
      dropHighlightRef.current = null;
    }
  };

  const isLocalMode = useMemo(() => myPlayerId === 'both', [myPlayerId]);

  const isMyTurn = useMemo(() => {
    if (!gameState || myPlayerId === 'both') return true;
    return gameState.turn_info.active_player_id === myPlayerId;
  }, [gameState, myPlayerId]);

  const isRotated = useMemo(() => {
    if (myPlayerId === 'p2') return true;
    if (myPlayerId === 'p1') return false;
    return gameState?.turn_info?.active_player_id === 'p2';
  }, [myPlayerId, gameState?.turn_info?.active_player_id]);

  const inspectingCards = useMemo(() => {
      if (!inspecting || !gameState) return [];
      const p = inspecting.pid === 'p1' ? gameState.players.p1 : gameState.players.p2;
      if (inspecting.type === 'deck') return p.zones.deck || [];
      if (inspecting.type === 'life') return p.zones.life || [];
      if (inspecting.type === 'trash') return p.zones.trash || [];
      return [];
  }, [gameState, inspecting]);

  const mulliganStatus = useMemo(() => {
    if (!gameState) return { p1: false, p2: false };
    return (gameState as any).mulligan_finished || { p1: false, p2: false };
  }, [gameState]);

  const isMulliganPhase = useMemo(() => {
    if (!gameState || gameState.turn_info.turn_count > 1) return false;
    return !mulliganStatus.p1 || !mulliganStatus.p2;
  }, [gameState, mulliganStatus]);

  const isActionBlockedByMulligan = useMemo(() => {
    if (!gameState || !isMulliganPhase || myPlayerId === 'both') return false;
    if (myPlayerId === 'p1') return !mulliganStatus.p2 || !mulliganStatus.p1;
    return false;
  }, [gameState, isMulliganPhase, mulliganStatus, myPlayerId]);

  const startLongPress = (card: CardInstance, x: number, y: number) => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      pressStartPosRef.current = { x, y };
      longPressTimerRef.current = setTimeout(() => {
          logger.log({ level: 'info', action: 'ui.long_press', msg: `Show detail: ${card.name}`, payload: { uuid: card.uuid } });
          setSelectedCard(card);
          setDragState(null);
          longPressTriggeredRef.current = true;
          longPressTimerRef.current = null;
      }, 500);
  };

  const cancelLongPress = () => {
      if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
      }
      pressStartPosRef.current = null;
  };

  const startDrag = useCallback((card: CardInstance, startPoint: { x: number, y: number }) => {
    const app = appRef.current;
    if (!app) return;
    const { width: W, height: H } = app.screen;
    const coords = calculateCoordinates(W, H);
    
    const ghost = createCardContainer(card, coords.CW, coords.CH, { onClick: () => {}, isOpponent: false });
    ghost.position.set(startPoint.x, startPoint.y); 
    ghost.alpha = 0.8; 
    ghost.scale.set(1.1);
    app.stage.addChild(ghost); 
    setDragState({ card, sprite: ghost, startPos: startPoint });
  }, []);

  useEffect(() => {
    const fetchDecks = async () => {
      const options: DeckOption[] = [];

      try {
        const res = await fetch(`${API_CONFIG.BASE_URL}/api/deck/list`);
        const data = await res.json();
        if (data.success) {
          data.decks.forEach((d: any) => {
            const id = d.id.endsWith('.json') ? d.id : `db:${d.id}`;
            options.push({ id, name: d.name, leaderId: d.leader_id });
          });
        }
      } catch(e) { console.error(e); }

      const uniqueMap = new Map();
      options.forEach(o => uniqueMap.set(o.id, o));
      setDeckOptions(Array.from(uniqueMap.values()));
    };
    fetchDecks();
  }, []);

  useEffect(() => {
    if (isLocalMode) {
      // 進行中ゲームの復元: クラッシュ/リロードでメモリ上のgameStateが失われても、
      // sessionStorageに保存済みのPLAYING状態があればそれを復元してゲームを継続する。
      // （新規開始時はApp.handleStartでこのキーがクリアされるため、古いゲームの誤復元は起きない）
      try {
        const saved = sessionStorage.getItem(SANDBOX_STATE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as GameState;
          if (parsed && parsed.status && parsed.status !== 'WAITING') {
            setGameState(parsed);
            return;
          }
        }
      } catch (e) { /* 復元失敗時は通常の初期化にフォールバック */ }

      const hasInitialDecks = !!(initialP1DeckId && initialP2DeckId);

      setGameState({
        game_id: 'local-init',
        room_name: roomName || 'LOCAL',
        status: 'WAITING',
        ready_states: { p1: hasInitialDecks, p2: hasInitialDecks },
        players: {
          p1: {
            name: initialP1DeckId || '',
            player_id: 'p1',
            zones: { hand: [], field: [], life: [], trash: [] }
          } as any,
          p2: {
            name: initialP2DeckId || '',
            player_id: 'p2',
            zones: { hand: [], field: [], life: [], trash: [] }
          } as any
        },
        turn_info: { turn_count: 0, active_player_id: 'p1', current_phase: 'SETUP', winner: null }
      });
      return;
    }

    const connectWs = (gameId: string) => {
      if (!isMountedRef.current) return;
      // 既存接続を切断（oncloseによる再接続ループを防ぐため先にハンドラを外す）
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
      const baseUrl = API_CONFIG.BASE_URL;
      const wsProtocol = baseUrl.startsWith('https') ? 'wss:' : 'ws:';
      const wsHost = baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const ws = new WebSocket(`${wsProtocol}//${wsHost}/ws/sandbox/${gameId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        reconnectAttemptRef.current = 0;
        setWsConnected(true);
        logger.log({ level: 'info', action: 'ws.connected', msg: `WebSocket connected: ${gameId}` });
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'STATE_UPDATE') {
            setGameState(data.state);
            if (data.kicked_player && data.kicked_player === myPlayerId) {
              if (onForceBack) onForceBack();
              else onBack();
            }
          }
        } catch(e) { logger.error('ws.parse_error', String(e)); }
      };
      ws.onerror = () => { logger.error('ws.error', 'WebSocket error'); };
      ws.onclose = () => {
        if (!isMountedRef.current) return;
        setWsConnected(false);
        const attempt = reconnectAttemptRef.current;
        // 指数バックオフ: 2s → 4s → 8s → 16s → 30s(上限)
        const delay = Math.min(2000 * Math.pow(2, attempt), 30000);
        reconnectAttemptRef.current += 1;
        logger.warn('ws.disconnected', `Reconnecting in ${delay}ms (attempt ${attempt + 1})`);
        reconnectTimerRef.current = setTimeout(() => connectWs(gameId), delay);
      };
    };

    const initGame = async () => {
      try {
        let currentId = activeGameId;
        if (!currentId) {
            const { state } = await apiClient.createSandboxGame(roomName);
            currentId = state.game_id;
            setActiveGameId(currentId);
            setGameState(state);
        }
        if (currentId) connectWs(currentId);
      } catch (e) { logger.error('sandbox.init_fail', String(e)); alert("Failed to start sandbox"); onBack(); }
    };
    initGame();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); wsRef.current = null; }
    };
  }, [isLocalMode, initialP1DeckId, initialP2DeckId]); 

  const hasAutoStartedRef = useRef(false);
  useEffect(() => {
    if (
      isLocalMode && 
      gameState && 
      gameState.status === 'WAITING' && 
      initialP1DeckId && 
      initialP2DeckId &&
      !hasAutoStartedRef.current
    ) {
      hasAutoStartedRef.current = true;
      setTimeout(() => {
        handleAction('START', {});
      }, 100);
    }
  }, [gameState, isLocalMode, initialP1DeckId, initialP2DeckId]);

  // 進行中ゲームの永続化: ローカルモードでPLAYING中はgameStateをsessionStorageへ保存し、
  // 万一のクラッシュ/リロードでも復元できるようにする。WAITING(セットアップ中)は保存しない。
  useEffect(() => {
    if (!isLocalMode || !gameState) return;
    try {
      if (gameState.status === 'WAITING') {
        sessionStorage.removeItem(SANDBOX_STATE_KEY);
      } else {
        sessionStorage.setItem(SANDBOX_STATE_KEY, JSON.stringify(gameState));
      }
    } catch (e) { /* 保存失敗(容量超過等)は致命的でないため握りつぶす */ }
  }, [isLocalMode, gameState]);

  useEffect(() => {
    if (!pixiContainerRef.current || (gameState && gameState.status === 'WAITING')) return;
    while (pixiContainerRef.current.firstChild) pixiContainerRef.current.removeChild(pixiContainerRef.current.firstChild);
    const app = new PIXI.Application({ width: window.innerWidth, height: window.innerHeight, backgroundColor: COLORS.APP_BG, antialias: true, resolution: window.devicePixelRatio || 1, autoDensity: true });
    pixiContainerRef.current.appendChild(app.view as HTMLCanvasElement);
    appRef.current = app;
    const coords = calculateCoordinates(window.innerWidth, window.innerHeight);
    setLayoutCoords(coords.turnEndPos);
    
    const autoScrollTicker = () => {
      const currentDrag = dragStateRef.current;
      const overlay = overlayRef.current;
      if (!currentDrag || !overlay) return;
      const spriteX = currentDrag.sprite.x;
      const W = app.screen.width;
      const EDGE = 120;
      const MAX_SPEED = 25;
      let scrollSpeed = 0;
      if (spriteX < EDGE) scrollSpeed = -MAX_SPEED * (1 - spriteX / EDGE);
      else if (spriteX > W - EDGE) scrollSpeed = MAX_SPEED * (1 - (W - spriteX) / EDGE);
      if (Math.abs(scrollSpeed) > 1.0) {
        let newScroll = inspectScrollXRef.current + scrollSpeed;
        newScroll = Math.max(0, newScroll);
        inspectScrollXRef.current = newScroll;
        overlay.updateScroll(newScroll);
        overlay.updateLayout(spriteX, currentDrag.card.uuid);
      }
    };
    app.ticker.add(autoScrollTicker);
    const handleResize = () => { app.renderer.resize(window.innerWidth, window.innerHeight); const newCoords = calculateCoordinates(window.innerWidth, window.innerHeight); setLayoutCoords(newCoords.turnEndPos); };
    window.addEventListener('resize', handleResize);
    return () => { 
        window.removeEventListener('resize', handleResize); 
        try {
            app.ticker.remove(autoScrollTicker);
            app.destroy(true, { children: true });
        } catch(e) { console.warn(e); }
        appRef.current = null;
    };
  }, [gameState?.status]);

  useEffect(() => {
    const app = appRef.current;
    if (!app || !gameState || gameState.status === 'WAITING') return;
    // 前フレームの表示オブジェクトを破棄してメモリリークを防止する。
    // ・ドラッグ中のゴースト(dragState.sprite)は再利用するため破棄しない
    // ・共有テクスチャ(Texture.fromキャッシュ)は temporarily 残す(texture:false)
    const liveGhost = dragState?.sprite || null;
    const removedChildren = app.stage.removeChildren();
    for (const child of removedChildren) {
      if (child === liveGhost) continue;
      if (child === dropHighlightRef.current) dropHighlightRef.current = null;
      try { child.destroy({ children: true, texture: false, baseTexture: false }); } catch (e) { /* already destroyed */ }
    }

    const { width: W, height: H } = app.screen;
    const coords = calculateCoordinates(W, H);
    const midY = H / 2;
    const bg = new PIXI.Graphics();
    bg.beginFill(COLORS.OPPONENT_BG).drawRect(0, 0, W, midY).endFill();
    bg.beginFill(COLORS.PLAYER_BG).drawRect(0, midY, W, H - midY).endFill();
    app.stage.addChild(bg);
    
    const onCardDown = (e: PIXI.FederatedPointerEvent, card: CardInstance) => {
        if (isPending || dragState || isActionBlockedByMulligan) return;
        
        if (myPlayerId !== 'both' && gameState) { const me = gameState.players[myPlayerId as 'p1' | 'p2']; if (me && card.owner_id && card.owner_id !== me.name) return; }
        
        longPressTriggeredRef.current = false;
        startLongPress(card, e.global.x, e.global.y);
        pendingDragRef.current = { card, x: e.global.x, y: e.global.y };
    };

    const bottomPlayer = isRotated ? gameState.players.p2 : gameState.players.p1;
    const topPlayer = isRotated ? gameState.players.p1 : gameState.players.p2;
    const isOnlineBattle = myPlayerId !== 'both';
    
    const bottomSide = createSandboxBoardSide(bottomPlayer, false, W, coords, onCardDown, false);
    bottomSide.y = midY; app.stage.addChild(bottomSide);
    const topSide = createSandboxBoardSide(topPlayer, true, W, coords, onCardDown, isOnlineBattle);
    topSide.y = 0; app.stage.addChild(topSide);

    if (inspecting) {
        const overlay = createInspectOverlay(
          inspecting.type, inspectingCards, revealedCardIds, W, H, inspectScrollXRef.current, 
          () => setInspecting(null), 
          (card, startPos) => onCardDown({ global: startPos } as any, card),
          (uuid) => { 
              if (longPressTriggeredRef.current) return;
              const newSet = new Set(revealedCardIds); 
              if (newSet.has(uuid)) newSet.delete(uuid); else newSet.add(uuid); 
              setRevealedCardIds(newSet); 
          },
          () => { const newSet = new Set(revealedCardIds); inspectingCards.forEach(c => newSet.add(c.uuid)); setRevealedCardIds(newSet); }, 
          (uuid) => { handleAction('MOVE_CARD', { card_uuid: uuid, dest_player_id: inspecting.pid, dest_zone: inspecting.type, index: -1 }); }, 
          (uuid) => { handleAction('MOVE_CARD', { card_uuid: uuid, dest_player_id: inspecting.pid, dest_zone: 'hand' }); },
          (uuid) => { handleAction('MOVE_CARD', { card_uuid: uuid, dest_player_id: inspecting.pid, dest_zone: 'trash' }); },
          (x) => { inspectScrollXRef.current = x; },
          () => handleAction('SHUFFLE', { player_id: inspecting.pid }),
          (count) => {
            const newSet = new Set(revealedCardIds);
            inspectingCards.slice(0, count).forEach(c => newSet.add(c.uuid));
            setRevealedCardIds(newSet);
          }
        );
        app.stage.addChild(overlay);
        overlayRef.current = overlay;
        if (dragState) overlay.updateLayout(dragState.sprite.x, dragState.card.uuid);
    } else {
        overlayRef.current = null;
    }

    if (dragState) app.stage.addChild(dragState.sprite);
  }, [gameState, isPending, dragState, inspecting, isRotated, myPlayerId, inspectingCards, revealedCardIds, isActionBlockedByMulligan, startDrag]);

  useEffect(() => {
    const app = appRef.current;
    if (!app) return;
    
    const onPointerMove = (e: PointerEvent) => { 
        if (pressStartPosRef.current) {
            const dx = e.clientX - pressStartPosRef.current.x;
            const dy = e.clientY - pressStartPosRef.current.y;
            if (Math.sqrt(dx * dx + dy * dy) > 10) cancelLongPress();
        }

        if (pendingDragRef.current && !dragState) {
             const dx = e.clientX - pendingDragRef.current.x;
             const dy = e.clientY - pendingDragRef.current.y;
             if (Math.sqrt(dx * dx + dy * dy) > 10) {
                 startDrag(pendingDragRef.current.card, { x: pendingDragRef.current.x, y: pendingDragRef.current.y });
                 pendingDragRef.current = null;
                 cancelLongPress();
             }
        }

        if (!dragState || (dragState.card.type || '').toUpperCase() === 'LEADER') return;
        dragState.sprite.position.set(e.clientX, e.clientY);
        if (overlayRef.current) overlayRef.current.updateLayout(e.clientX, dragState.card.uuid);

        // ドロップ先ゾーンのハイライト更新
        const appForHL = appRef.current;
        if (appForHL) {
          const { width: W, height: H } = appForHL.screen;
          const coords = calculateCoordinates(W, H);
          const isTopArea = e.clientY < H / 2;
          if (!dropHighlightRef.current) {
            const g = new PIXI.Graphics();
            appForHL.stage.addChildAt(g, Math.max(0, appForHL.stage.children.length - 1));
            dropHighlightRef.current = g;
          }
          const g = dropHighlightRef.current;
          g.clear();

          let hlRect: { x: number; y: number; w: number; h: number } | null = null;
          const isDon = dragState.card.card_id === "DON" || dragState.card.type === "DON";

          if (isDon) {
            // DONカード: リーダー/フィールドキャラのうち最も近い1枚にハイライト（バンド表示しない）
            const destPid = isTopArea ? (isRotated ? 'p1' : 'p2') : (isRotated ? 'p2' : 'p1');
            const targetPlayer = destPid === 'p1' ? gameState?.players.p1 : gameState?.players.p2;
            if (targetPlayer) {
              const target = getDonAttachTarget(
                { x: e.clientX, y: e.clientY }, isTopArea, W, H, coords,
                !!targetPlayer.leader, targetPlayer.zones.field.length
              );
              if (target) hlRect = { x: target.x, y: target.y, w: coords.CW, h: coords.CH };
            }
            // アタッチ対象が無い場合はDONゾーンのみ検出（'field'バンドはDONの有効ドロップ先でないためスキップ）
            if (!hlRect) {
              const zone = getDropZone({ x: e.clientX, y: e.clientY }, isTopArea, W, H, coords);
              if (zone && zone !== 'field' && zone !== 'leader') hlRect = getZoneRect(zone, isTopArea, W, H, coords);
            }
          } else {
            const zone = getDropZone({ x: e.clientX, y: e.clientY }, isTopArea, W, H, coords);
            if (zone) hlRect = getZoneRect(zone, isTopArea, W, H, coords);
          }

          if (hlRect) {
            g.lineStyle(3, 0xffd700, 1);
            g.beginFill(0xffd700, 0.2);
            g.drawRoundedRect(hlRect.x - hlRect.w / 2, hlRect.y - hlRect.h / 2, hlRect.w, hlRect.h, 8);
            g.endFill();
          }
        }
    };
    
    const onPointerUp = async (e: PointerEvent) => {
        cancelLongPress();
        
        if (dragState) {
            const card = dragState.card; const endPos = { x: e.clientX, y: e.clientY };
            if ((card.type || '').toUpperCase() === 'LEADER') { clearDropHighlight(); setDragState(null); return; }
            
            if (inspecting && overlayRef.current) {
                 const { width: W, height: H } = app.screen;
                 const PANEL_W = Math.min(W * 0.95, 1200);
                 const PANEL_X = (W - PANEL_W) / 2;
                 const PANEL_Y = 40; 
                 const PLAYER_AREA_RESERVE = Math.max(250, H * 0.4); 
                 
                 const isInsidePanel = endPos.x >= PANEL_X && endPos.x <= PANEL_X + PANEL_W && endPos.y >= PANEL_Y && endPos.y <= H - PLAYER_AREA_RESERVE;
                 
                 if (inspecting.pid === ((endPos.y < H/2) ? (isRotated ? 'p1' : 'p2') : (isRotated ? 'p2' : 'p1'))) {
                     if (isInsidePanel) {
                         const HEADER_HEIGHT = 130;
                         const SCROLL_ZONE_HEIGHT = 50;
                         const listAreaTop = PANEL_Y + HEADER_HEIGHT;
                         const listAreaBottom = Math.min(H - PLAYER_AREA_RESERVE, 450 + PANEL_Y) - SCROLL_ZONE_HEIGHT;

                         if (endPos.y > listAreaTop && endPos.y < listAreaBottom) {
                             const DISPLAY_CARD_WIDTH = 55; 
                             const CARD_GAP = 10;
                             const TOTAL_CARD_WIDTH = DISPLAY_CARD_WIDTH + CARD_GAP;
                             const relativeX = endPos.x + inspectScrollXRef.current - PANEL_X;
                             let newIndex = Math.floor(relativeX / TOTAL_CARD_WIDTH);
                             newIndex = Math.max(0, newIndex);
                             handleAction('MOVE_CARD', { card_uuid: card.uuid, dest_player_id: inspecting.pid, dest_zone: inspecting.type, index: newIndex });
                         }
                         clearDropHighlight(); setDragState(null);
                         return;
                     }
                 }
            }

            const { width: W, height: H } = app.screen; const coords = calculateCoordinates(W, H); const midY = H / 2;
            const isTopArea = endPos.y < midY; const destPid = isTopArea ? (isRotated ? 'p1' : 'p2') : (isRotated ? 'p2' : 'p1');

            if (myPlayerId !== 'both' && destPid !== myPlayerId) { clearDropHighlight(); setDragState(null); return; }

            if (card.card_id === "DON" || card.type === "DON") {
                const targetPlayer = destPid === 'p1' ? gameState?.players.p1 : gameState?.players.p2;
                if (targetPlayer) {
                    // ハイライトと同じリゾルバで「最も近いカード」を解決
                    const target = getDonAttachTarget(endPos, isTopArea, W, H, coords, !!targetPlayer.leader, targetPlayer.zones.field.length);
                    if (target) {
                        const targetUuid = target.kind === 'leader' ? targetPlayer.leader!.uuid : targetPlayer.zones.field[target.index].uuid;
                        handleAction('ATTACH_DON', { card_uuid: card.uuid, target_uuid: targetUuid });
                        clearDropHighlight(); setDragState(null); return;
                    }
                }
                const dZone = getDropZone(endPos, isTopArea, W, H, coords); if (dZone && ['don_active', 'don_rested', 'don_deck'].includes(dZone)) handleAction('MOVE_CARD', { card_uuid: card.uuid, dest_player_id: destPid, dest_zone: dZone });
                clearDropHighlight(); setDragState(null); return;
            }

            const detectedZone = getDropZone(endPos, isTopArea, W, H, coords);

            if (detectedZone === 'deck' || detectedZone === 'life') {
                setDropChoice({ card, destPid, destZone: detectedZone });
                clearDropHighlight(); setDragState(null);
                return;
            }

            const destZone = detectedZone || 'field';

            if (destZone === 'field') {
                const destP = destPid === 'p1' ? gameState?.players.p1 : gameState?.players.p2;
                if (destP && destP.zones.field.length >= 5) {
                    const isAlreadyOnField = destP.zones.field.some(c => c.uuid === card.uuid);
                    if (!isAlreadyOnField) {
                        setReplacementState({ card, destPid });
                        clearDropHighlight(); setDragState(null);
                        return;
                    }
                }
            }

            const animateAndSend = () => {
                clearDropHighlight();
                const tx = endPos.x; const ty = endPos.y; const sprite = dragState.sprite;
                const step = () => {
                    const dx = tx - sprite.x; const dy = ty - sprite.y;
                    if (Math.sqrt(dx*dx + dy*dy) < 5) { app.ticker.remove(step); handleAction('MOVE_CARD', { card_uuid: card.uuid, dest_player_id: destPid, dest_zone: destZone }); setDragState(null); } else { sprite.x += dx * 0.3; sprite.y += dy * 0.3; }
                };
                app.ticker.add(step);
            };
            animateAndSend();
            return;
        }

        if (pendingDragRef.current) {
            const card = pendingDragRef.current.card;
            pendingDragRef.current = null;

            if (longPressTriggeredRef.current) return;

            if ((card.type || '').toUpperCase() === 'LEADER') { 
                handleAction('TOGGLE_REST', { card_uuid: card.uuid }); 
                return; 
            }

            if (inspecting) return;

            const { height: H } = app.screen; const midY = H / 2;
            const isTopArea = e.clientY < midY; 
            const destPid = isTopArea ? (isRotated ? 'p1' : 'p2') : (isRotated ? 'p2' : 'p1');
            
            if (myPlayerId !== 'both' && destPid !== myPlayerId) return;

            const destP = destPid === 'p1' ? gameState?.players.p1 : gameState?.players.p2;
            
            const findInStack = (p: any) => { if (p.zones.deck?.some((c: any) => c.uuid === card.uuid)) return { type: 'deck' }; if (p.zones.life?.some((c: any) => c.uuid === card.uuid)) return { type: 'life' }; if (p.zones.trash?.some((c: any) => c.uuid === card.uuid)) return { type: 'trash' }; return null; };
            if (destP) { 
                const stackInfo = findInStack(destP); 
                if (stackInfo) { 
                    inspectScrollXRef.current = 20; 
                    setInspecting({ type: stackInfo.type as any, pid: destPid }); 
                    setRevealedCardIds(new Set()); 
                    return; 
                } 
            }

            if (destP && !destP.zones.hand.some(c => c.uuid === card.uuid)) {
                 handleAction('TOGGLE_REST', { card_uuid: card.uuid });
            }
        }
    };
    window.addEventListener('pointermove', onPointerMove); window.addEventListener('pointerup', onPointerUp);
    return () => { window.removeEventListener('pointermove', onPointerMove); window.removeEventListener('pointerup', onPointerUp); };
  }, [dragState, gameState, inspecting, isRotated, myPlayerId, inspectingCards, revealedCardIds, isActionBlockedByMulligan, startDrag]);

  const handleReplacement = async (trashCardUuids: string[]) => {
    if (!replacementState || trashCardUuids.length === 0 || !gameState) return;
    const { card, destPid } = replacementState;
    const trashUuid = trashCardUuids[0];
    const pid = myPlayerId === 'both' ? destPid : myPlayerId;

    let tempState = gameState;

    const trashParams = { 
      card_uuid: trashUuid, 
      dest_player_id: destPid, 
      dest_zone: 'trash', 
      player_id: pid 
    };
    tempState = handleLocalAction(tempState, 'MOVE_CARD', trashParams);

    const fieldParams = { 
      card_uuid: card.uuid, 
      dest_player_id: destPid, 
      dest_zone: 'field', 
      player_id: pid 
    };
    tempState = handleLocalAction(tempState, 'MOVE_CARD', fieldParams);

    setGameState(tempState);
    setReplacementState(null);

    if (!isLocalMode && activeGameId) {
      try {
        await apiClient.sendSandboxAction(activeGameId, { action_type: 'MOVE_CARD', ...trashParams });
        await apiClient.sendSandboxAction(activeGameId, { action_type: 'MOVE_CARD', ...fieldParams });
      } catch (e) {
        console.error("Failed to sync replacement actions", e);
      }
    }
  };

  const handleAction = async (type: string, params: any) => {
      if (isPending || !gameState) return;
      if (!isLocalMode && !activeGameId) return;
      setIsPending(true);
      try { 
          const localParams = { ...params };
          const pid = myPlayerId === 'both' ? (params.player_id || 'p1') : myPlayerId;

          const getDeckData = async (deckId: string) => {
              if (!deckId) return { leader: [], cards: [] };
              if (MOCK_DECKS[deckId]) return MOCK_DECKS[deckId];
              let cacheKey = `opcg_deck_${deckId}`;
              if (deckId.startsWith('db:')) cacheKey = `opcg_deck_${deckId.substring(3)}`;
              const cached = localStorage.getItem(cacheKey);
              if (cached) { try { return JSON.parse(cached); } catch { /* キャッシュ不正は無視 */ } }
              if (!deckId.startsWith('db:') && !['imu.json', 'nami.json'].includes(deckId)) return { leader: [], cards: [] };
              const res = await fetch(`${API_CONFIG.BASE_URL}/api/deck/get?id=${deckId}`);
              if (!res.ok) throw new Error();
              const data = await res.json();
              const finalData = data.deck || data;
              localStorage.setItem(cacheKey, JSON.stringify(finalData));
              return finalData;
          };

          const normalizeDeckData = (data: any) => {
            if (!data) return { leader: null, cards: [] };
            let leader = data.leader;
            if (Array.isArray(leader)) {
                leader = leader.length > 0 ? leader[0] : null;
            }
            if (data.deck && data.deck.leader) {
                 if (Array.isArray(data.deck.leader)) {
                     leader = data.deck.leader.length > 0 ? data.deck.leader[0] : null;
                 } else {
                     leader = data.deck.leader;
                 }
            }
            return {
                ...data,
                leader: leader,
                cards: data.cards || (data.deck ? data.deck.cards : [])
            };
          };

          if (isLocalMode && type === 'SET_DECK') {
              const rawData = await getDeckData(params.deck_id);
              localParams.deckData = normalizeDeckData(rawData);
          }

          if (type === 'START') {
              const p1DeckId = gameState.players.p1.name;
              const p2DeckId = gameState.players.p2.name;
              const [d1, d2] = await Promise.all([getDeckData(p1DeckId), getDeckData(p2DeckId)]);
              localParams.p1Deck = normalizeDeckData(d1);
              localParams.p2Deck = normalizeDeckData(d2);
          }

          const newState = handleLocalAction(gameState, type, { ...localParams, player_id: pid });
          setGameState(newState);

          if (!isLocalMode) {
              await apiClient.sendSandboxAction(activeGameId!, { action_type: type, player_id: pid, ...params }); 
          }
      } catch(e) { console.error(e); alert('アクションエラー'); } finally { setIsPending(false); }
  };

  const shouldShowSetupScreen = gameState && gameState.status === 'WAITING' && !(initialP1DeckId && initialP2DeckId);

  if (shouldShowSetupScreen) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: 'radial-gradient(circle at center, #2c3e50 0%, #000000 100%)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box' }}>
        <div style={{ 
          background: '#2c3e50', padding: '30px', borderRadius: '12px', border: '2px solid #7f8c8d', 
          width: '90%', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '20px', 
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)', color: '#ecf0f1'
        }}>
          <h2 style={{ color: '#f1c40f', fontSize: '24px', fontWeight: 'bold', textAlign: 'center', borderBottom: '1px solid #7f8c8d', paddingBottom: '10px', margin: 0 }}>
            {gameState?.room_name || 'GAME SETUP'}
          </h2>

          {(['p1', 'p2'] as const).map(pid => {
            const playerState = gameState?.players[pid];
            const leaderCard = playerState?.leader;
            const hasDeck = !!leaderCard;
            
            return (
              <div key={pid} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ color: '#bdc3c7', fontSize: '12px', fontWeight: 'bold' }}>
                    {pid === 'p1' ? 'Player 1' : 'Player 2'}
                  </label>
                  {gameState?.ready_states?.[pid] ? (
                    <span style={{ color: '#2ecc71', fontSize: '10px', fontWeight: 'bold' }}>READY</span>
                  ) : (
                    <span style={{ color: '#e74c3c', fontSize: '10px' }}>NOT READY</span>
                  )}
                </div>
                
                {(pid === myPlayerId || myPlayerId === 'both') ? (
                  <div
                    onClick={() => setSelectingDeckFor(pid)}
                    style={{
                      height: '60px',
                      background: '#2a1a1a', border: '1px solid #5d4037', borderRadius: '4px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', overflow: 'hidden', position: 'relative'
                    }}
                  >
                    {hasDeck ? (
                      <>
                        <img
                          src={getCardImageUrl(leaderCard?.card_id)}
                          alt="leader"
                          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }}
                        />
                        <span style={{ zIndex: 1, fontWeight: 'bold', textShadow: '0 2px 4px black' }}>{leaderCard?.name || 'Deck Selected'}</span>
                      </>
                    ) : (
                      <span style={{ color: '#7f8c8d', fontSize: '14px' }}>＋ デッキを選択</span>
                    )}
                  </div>
                ) : (
                  <div style={{ height: '60px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7f8c8d', fontSize: '14px', border: '1px dashed #555' }}>
                    {hasDeck ? 'Deck Selected' : 'Waiting for selection...'}
                  </div>
                )}
                {myPlayerId === 'p1' && pid === 'p2' && (
                  <button
                    onClick={() => handleAction('KICK_PLAYER', { target_player_id: 'p2' })}
                    style={{
                      alignSelf: 'flex-end',
                      padding: '4px 10px',
                      background: 'transparent',
                      border: '1px solid #e74c3c',
                      color: '#e74c3c',
                      borderRadius: '4px',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    キック
                  </button>
                )}
              </div>
            );
          })}

          <div style={{ textAlign: 'center', color: '#95a5a6', fontStyle: 'italic', margin: '-10px 0' }}>VS</div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button onClick={onBack} style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid #95a5a6', color: '#95a5a6', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
              退出
            </button>
            {(myPlayerId === 'p1' || myPlayerId === 'both') && (
              <button 
                disabled={!(gameState?.ready_states?.p1 && gameState?.ready_states?.p2)} 
                onClick={() => handleAction('START', {})} 
                style={{ 
                  flex: 1, padding: '12px', 
                  background: (gameState?.ready_states?.p1 && gameState?.ready_states?.p2) ? '#e67e22' : '#34495e', 
                  color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', 
                  cursor: (gameState?.ready_states?.p1 && gameState?.ready_states?.p2) ? 'pointer' : 'not-allowed'
                }}
              >
                GAME START
              </button>
            )}
          </div>
        </div>

        {selectingDeckFor && (
          <DeckSelectModal 
            title={`デッキを選択 (${selectingDeckFor.toUpperCase()})`}
            options={deckOptions}
            onSelect={(deckId) => {
              handleAction('SET_DECK', { player_id: selectingDeckFor, deck_id: deckId });
              setSelectingDeckFor(null);
            }}
            onClose={() => setSelectingDeckFor(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', background: '#000' }}>
      <div ref={pixiContainerRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: inspecting ? 200 : 1 }} />
      {dropChoice && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10000, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
          <div style={{ background: '#2c3e50', padding: '30px', borderRadius: '15px', border: '2px solid #d4af37', textAlign: 'center', width: '80%', maxWidth: '400px' }}>
            <h3 style={{ color: '#ffd700', marginBottom: '25px' }}>{dropChoice.destZone === 'deck' ? '山札' : 'ライフ'}のどこに置きますか？</h3>
            <div style={{ display: 'flex', gap: '15px' }}>
              <button onClick={() => { handleAction('MOVE_CARD', { card_uuid: dropChoice.card.uuid, dest_player_id: dropChoice.destPid, dest_zone: dropChoice.destZone, index: 0 }); setDropChoice(null); }} style={{ flex: 1, padding: '15px', background: '#2ecc71', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>上へ置く</button>
              <button onClick={() => { handleAction('MOVE_CARD', { card_uuid: dropChoice.card.uuid, dest_player_id: dropChoice.destPid, dest_zone: dropChoice.destZone, index: -1 }); setDropChoice(null); }} style={{ flex: 1, padding: '15px', background: '#3498db', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>下へ置く</button>
            </div>
            <button onClick={() => setDropChoice(null)} style={{ marginTop: '20px', background: 'transparent', color: '#bdc3c7', border: 'none', textDecoration: 'underline' }}>キャンセル</button>
          </div>
        </div>
      )}
      {(!gameState || (gameState.status === 'WAITING' && initialP1DeckId && initialP2DeckId)) && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 9999, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', color: 'white' }}>
          <h2>Loading...</h2>
        </div>
      )}
      {selectedCard && <CardDetailSheet card={selectedCard} location="unknown" isMyTurn={false} onAction={async () => {}} onClose={() => setSelectedCard(null)} />}
      
      {replacementState && gameState && (
        <CardSelectModal
          candidates={gameState.players[replacementState.destPid as 'p1'|'p2'].zones.field}
          message="キャラクターエリアが一杯です。入れ替えるカード（トラッシュに送るカード）を選択してください。"
          minSelect={1}
          maxSelect={1}
          onConfirm={handleReplacement}
          onCancel={() => setReplacementState(null)}
        />
      )}

      {gameState && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 100, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: 10, pointerEvents: 'auto' }}>
                <button onClick={onBack} style={{ background: 'rgba(0, 0, 0, 0.6)', color: 'white', border: '1px solid #555', borderRadius: '4px', padding: '5px 10px' }}>TOPへ</button>
                <button onClick={() => { if(window.confirm('ゲームを初期状態にリセットしますか？')) handleAction('RESET', {}); }} style={{ background: 'rgba(200, 0, 0, 0.8)', color: 'white', border: '1px solid #555', borderRadius: '4px', padding: '5px 10px' }}>リセット</button>
            </div>
            {!isLocalMode && (
                <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.6)', border: '1px solid #555', borderRadius: '4px', padding: '5px 10px', pointerEvents: 'none' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: wsConnected ? '#2ecc71' : '#e74c3c', display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ color: 'white', fontSize: '11px' }}>
                        {wsConnected
                            ? (gameState?.status === 'WAITING' ? '相手の接続を待っています...' : '接続中')
                            : `再接続中... (${reconnectAttemptRef.current}回目)`}
                    </span>
                </div>
            )}
            {isMulliganPhase && (
                <div style={{ position: 'absolute', top: (myPlayerId === 'both' && layoutCoords) ? `${layoutCoords.y + 22}px` : '60px', left: '50%', transform: (myPlayerId === 'both' && layoutCoords) ? 'translate(-50%, -50%)' : 'translateX(-50%)', pointerEvents: 'auto', display: 'flex', gap: '20px', background: 'rgba(0,0,0,0.6)', padding: '15px', borderRadius: '12px', border: '1px solid #555' }}>
                    {(['p1', 'p2'] as const).map(pid => {
                        if (myPlayerId !== 'both' && myPlayerId !== pid) return null;
                        const finished = pid === 'p1' ? mulliganStatus.p1 : mulliganStatus.p2;
                        // スロット幅を固定し、完了しても残ったボタンが動かないようにする
                        return (
                            <div key={pid} style={{ width: '160px', textAlign: 'center', flexShrink: 0 }}>
                                <div style={{ color: '#ffd700', fontSize: '12px', marginBottom: '5px', fontWeight: 'bold' }}>{pid.toUpperCase()} マリガン</div>
                                {!finished ? (
                                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                        <button onClick={() => handleAction('MULLIGAN', { player_id: pid })} style={{ background: '#3498db', color: 'white', border: 'none', borderRadius: '4px', padding: '8px 12px', fontWeight: 'bold' }}>引き直す</button>
                                        <button onClick={() => handleAction('MULLIGAN_FINISH', { player_id: pid })} style={{ background: '#2ecc71', color: 'white', border: 'none', borderRadius: '4px', padding: '8px 12px', fontWeight: 'bold' }}>完了</button>
                                    </div>
                                ) : (
                                    <div style={{ color: '#2ecc71', fontSize: '14px', fontWeight: 'bold', padding: '8px 0' }}>完了 ✓</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
            <button 
              onClick={() => handleAction('TURN_END', {})} 
              disabled={isPending || !isMyTurn || isActionBlockedByMulligan} 
              style={{ 
                position: 'absolute', 
                left: layoutCoords ? `${layoutCoords.x + 40}px` : 'auto', 
                top: layoutCoords ? `${layoutCoords.y}px` : '50%', 
                transform: 'translateY(-50%)',
                padding: '5px 20px',
                backgroundColor: (isPending || !isMyTurn || isActionBlockedByMulligan) ? COLORS.BTN_DISABLED : COLORS.BTN_PRIMARY, 
                color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', pointerEvents: 'auto', 
                cursor: (isPending || !isMyTurn || isActionBlockedByMulligan) ? 'not-allowed' : 'pointer', 
                opacity: (isMyTurn && !isActionBlockedByMulligan) ? 1 : 0.6,
                whiteSpace: 'nowrap'
              }}
            >
              {isPending ? '送信中' : '終了'}
            </button>
        </div>
      )}
    </div>
  );
};