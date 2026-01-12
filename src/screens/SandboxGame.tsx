import { useEffect, useRef, useState, useMemo } from 'react';
import * as PIXI from 'pixi.js';
import { LAYOUT_CONSTANTS, LAYOUT_PARAMS } from '../layout/layout.config';
import { calculateCoordinates } from '../layout/layoutEngine';
import { createSandboxBoardSide } from '../ui/SandboxBoardSide';
import { createCardContainer } from '../ui/CardRenderer';
import { createInspectOverlay } from '../ui/InspectOverlay';
import { apiClient } from '../api/client';
import type { GameState, CardInstance } from '../game/types';
import { API_CONFIG } from '../api/api.config';
import { logger } from '../utils/logger';

type DragState = {
  card: CardInstance;
  sprite: PIXI.Container;
  startPos: { x: number, y: number };
} | null;

interface SandboxGameProps {
  p1Deck: string;
  p2Deck: string;
  gameId?: string; 
  myPlayerId?: string;
  roomName?: string;
  onBack: () => void;
}

export const SandboxGame = ({ gameId: initialGameId, myPlayerId = 'both', roomName, onBack }: SandboxGameProps) => {
  const pixiContainerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [activeGameId, setActiveGameId] = useState<string | null>(initialGameId || null);
  const [dragState, setDragState] = useState<DragState>(null);
  const [isPending, setIsPending] = useState(false);
  const [deckOptions, setDeckOptions] = useState<{id: string, name: string}[]>([]);
  
  const [inspecting, setInspecting] = useState<{ type: 'deck' | 'life' | 'trash', pid: string } | null>(null);
  const [revealedCardIds, setRevealedCardIds] = useState<Set<string>>(new Set());
  const [layoutCoords, setLayoutCoords] = useState<{ x: number, y: number } | null>(null);
  
  const { COLORS } = LAYOUT_CONSTANTS;
  const { Z_INDEX } = LAYOUT_PARAMS;

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

  useEffect(() => {
    const fetchDecks = async () => {
      try {
        const res = await fetch(`${API_CONFIG.BASE_URL}/api/deck/list`);
        const data = await res.json();
        if (data.success) {
          setDeckOptions([
            { id: 'imu.json', name: 'Imu (Default)' },
            { id: 'nami.json', name: 'Nami (Default)' },
            ...data.decks.map((d: any) => ({ id: `db:${d.id}`, name: d.name }))
          ]);
        }
      } catch(e) { console.error(e); }
    };
    fetchDecks();
  }, []);

  useEffect(() => {
    let ws: WebSocket | null = null;
    const initGame = async () => {
      try {
        let currentId = activeGameId;
        if (!currentId) {
            const { state } = await apiClient.createSandboxGame(roomName);
            currentId = state.game_id;
            setActiveGameId(currentId);
            setGameState(state);
        }
        if (currentId) {
            const baseUrl = API_CONFIG.BASE_URL;
            const wsProtocol = baseUrl.startsWith('https') ? 'wss:' : 'ws:';
            const wsHost = baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
            const wsUrl = `${wsProtocol}//${wsHost}/ws/sandbox/${currentId}`;
            ws = new WebSocket(wsUrl);
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'STATE_UPDATE') setGameState(data.state);
                } catch(e) { logger.error('ws.parse_error', String(e)); }
            };
        }
      } catch (e) {
        logger.error('sandbox.init_fail', String(e));
        alert("Failed to start sandbox");
        onBack();
      }
    };
    initGame();
    return () => { if (ws) ws.close(); };
  }, []);

  useEffect(() => {
    if (!pixiContainerRef.current || (gameState && gameState.status === 'WAITING')) return;
    
    while (pixiContainerRef.current.firstChild) {
      pixiContainerRef.current.removeChild(pixiContainerRef.current.firstChild);
    }
    const app = new PIXI.Application({
      width: window.innerWidth, height: window.innerHeight, backgroundColor: COLORS.APP_BG,
      antialias: true, resolution: window.devicePixelRatio || 1, autoDensity: true,
    });
    pixiContainerRef.current.appendChild(app.view as HTMLCanvasElement);
    appRef.current = app;
    const coords = calculateCoordinates(window.innerWidth, window.innerHeight);
    setLayoutCoords(coords.turnEndPos);
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
  }, [gameState?.status]);

  useEffect(() => {
    const app = appRef.current;
    if (!app || !gameState || gameState.status === 'WAITING') return;

    const childrenToDestroy: PIXI.DisplayObject[] = [];
    const children = [...app.stage.children];
    children.forEach(child => {
      if (dragState && child === dragState.sprite) app.stage.removeChild(child);
      else childrenToDestroy.push(child);
    });
    childrenToDestroy.forEach(child => {
      app.stage.removeChild(child);
      child.destroy({ children: true });
    });

    const { width: W, height: H } = app.screen;
    const coords = calculateCoordinates(W, H);
    const midY = H / 2;
    const bg = new PIXI.Graphics();
    bg.beginFill(COLORS.OPPONENT_BG).drawRect(0, 0, W, midY).endFill();
    bg.beginFill(COLORS.PLAYER_BG).drawRect(0, midY, W, H - midY).endFill();
    app.stage.addChild(bg);
    const border = new PIXI.Graphics();
    border.lineStyle(2, COLORS.BORDER_LINE, 0.5);
    border.moveTo(0, midY); border.lineTo(W, midY);
    app.stage.addChild(border);

    const startDrag = (card: CardInstance, startPoint: { x: number, y: number }) => {
        const ghost = createCardContainer(card, coords.CW, coords.CH, { onClick: () => {} });
        ghost.position.set(startPoint.x, startPoint.y);
        ghost.alpha = 0.8; ghost.scale.set(1.1);
        app.stage.addChild(ghost);
        setDragState({ card, sprite: ghost, startPos: startPoint });
    };

    const onCardDown = (e: PIXI.FederatedPointerEvent, card: CardInstance) => {
        if (isPending || inspecting || dragState) return;
        if ((myPlayerId === 'p1' || myPlayerId === 'p2') && gameState) {
             const player = gameState.players[myPlayerId];
             if (card.owner_id && player && card.owner_id !== player.name) return;
        }
        startDrag(card, { x: e.global.x, y: e.global.y });
    };

    const bottomPlayer = isRotated ? gameState.players.p2 : gameState.players.p1;
    const topPlayer = isRotated ? gameState.players.p1 : gameState.players.p2;
    const isOnlineBattle = myPlayerId !== 'both';
    const bottomSide = createSandboxBoardSide(bottomPlayer, false, W, coords, onCardDown, false);
    bottomSide.y = midY; app.stage.addChild(bottomSide);
    const topSide = createSandboxBoardSide(topPlayer, true, W, coords, onCardDown, isOnlineBattle);
    topSide.y = 0; app.stage.addChild(topSide);

    if (inspecting) {
        const overlay = createInspectOverlay(inspecting.type, inspectingCards, revealedCardIds, W, H, () => setInspecting(null), (card, startPos) => startDrag(card, startPos), (uuid) => {
            const newSet = new Set(revealedCardIds);
            if (newSet.has(uuid)) newSet.delete(uuid); else newSet.add(uuid);
            setRevealedCardIds(newSet);
        });
        app.stage.addChild(overlay);
    }
    if (dragState) app.stage.addChild(dragState.sprite);
  }, [gameState, isPending, dragState, inspecting, isRotated, inspectingCards, revealedCardIds]);

  useEffect(() => {
    const app = appRef.current;
    if (!app) return;
    const onPointerMove = (e: PointerEvent) => {
        if (!dragState || dragState.card.type === 'LEADER') return;
        dragState.sprite.position.set(e.clientX, e.clientY);
    };
    const onPointerUp = async (e: PointerEvent) => {
        if (!dragState) return;
        const card = dragState.card;
        const endPos = { x: e.clientX, y: e.clientY };
        const distFromStart = Math.sqrt(Math.pow(endPos.x - dragState.startPos.x, 2) + Math.pow(endPos.y - dragState.startPos.y, 2));
        if (card.type === 'LEADER') {
            if (distFromStart < 10) handleAction('TOGGLE_REST', { card_uuid: card.uuid });
            setDragState(null); return;
        }
        const { width: W, height: H } = app.screen;
        const coords = calculateCoordinates(W, H);
        const midY = H / 2;
        const isTopArea = endPos.y < midY;
        let destPid = isTopArea ? (isRotated ? 'p1' : 'p2') : (isRotated ? 'p2' : 'p1');
        let destZone = 'field'; 
        const checkDist = (tx: number, ty: number) => Math.sqrt(Math.pow(tx - endPos.x, 2) + Math.pow(ty - endPos.y, 2));
        const THRESHOLD = coords.CH; 
        const checkZone = (isTopSide: boolean) => {
            const yBase = isTopSide ? 0 : midY;
            const r2Y = isTopSide ? coords.midY - coords.getY(2) - coords.CH/2 : yBase + coords.getY(2) + coords.CH/2;
            const r3Y = isTopSide ? coords.midY - coords.getY(3) - coords.CH/2 : yBase + coords.getY(3) + coords.CH/2;
            const r4Y = isTopSide ? coords.midY - coords.getY(4) - coords.CH/2 : yBase + coords.getY(4) + coords.CH/2;
            if (checkDist(coords.getLeaderX(W), r2Y) < THRESHOLD) return 'leader';
            if (checkDist(coords.getStageX(W), r2Y) < THRESHOLD) return 'stage';
            if (checkDist(coords.getLifeX(W), r2Y) < THRESHOLD) return 'life';
            if (checkDist(coords.getTrashX(W), r3Y) < THRESHOLD) return 'trash';
            if (checkDist(coords.getDeckX(W), r2Y) < THRESHOLD) return 'deck';
            if (Math.abs(r4Y - endPos.y) < coords.CH) return 'hand';
            if (checkDist(coords.getDonDeckX(W), r3Y) < THRESHOLD) return 'don_deck';
            if (checkDist(coords.getDonActiveX(W), r3Y) < THRESHOLD) return 'don_active';
            if (checkDist(coords.getDonRestX(W), r3Y) < THRESHOLD) return 'don_rested';
            return null;
        };
        if (card.card_id === "DON" || card.type === "DON") {
            const targetPlayer = destPid === 'p1' ? gameState?.players.p1 : gameState?.players.p2;
            if (targetPlayer) {
                const yBase = isTopArea ? 0 : midY;
                const leaderY = isTopArea ? (midY - coords.getY(2) - coords.CH/2) : (yBase + coords.getY(2) + coords.CH/2);
                if (targetPlayer.leader && Math.abs(endPos.x - coords.getLeaderX(W)) < THRESHOLD && Math.abs(endPos.y - leaderY) < THRESHOLD) {
                     handleAction('ATTACH_DON', { card_uuid: card.uuid, target_uuid: targetPlayer.leader.uuid });
                     setDragState(null); return;
                }
                const fieldY = isTopArea ? (midY - coords.getY(1) - coords.CH/2) : (yBase + coords.getY(1) + coords.CH/2);
                const fieldCards = targetPlayer.zones.field;
                for (let i = 0; i < fieldCards.length; i++) {
                    const cx = coords.getFieldX(i, W, coords.CW, fieldCards.length);
                    if (Math.abs(endPos.x - cx) < THRESHOLD && Math.abs(endPos.y - fieldY) < THRESHOLD) {
                        handleAction('ATTACH_DON', { card_uuid: card.uuid, target_uuid: fieldCards[i].uuid });
                        setDragState(null); return;
                    }
                }
            }
            const dZone = checkZone(isTopArea); 
            if (dZone && ['don_active', 'don_rested', 'don_deck'].includes(dZone)) handleAction('MOVE_CARD', { card_uuid: card.uuid, dest_player_id: destPid, dest_zone: dZone });
            setDragState(null); return;
        }
        const detectedZone = checkZone(isTopArea); 
        if (detectedZone) destZone = detectedZone;
        if (distFromStart < 10) {
            if (inspecting) { setDragState(null); return; }
            const currentPlayer = destPid === 'p1' ? gameState?.players.p1 : gameState?.players.p2;
            const findInStack = (p: any) => {
                if (p.zones.deck?.some((c: any) => c.uuid === card.uuid)) return { type: 'deck' };
                if (p.zones.life?.some((c: any) => c.uuid === card.uuid)) return { type: 'life' };
                if (p.zones.trash?.some((c: any) => c.uuid === card.uuid)) return { type: 'trash' };
                return null;
            };
            if (currentPlayer) {
                const stackInfo = findInStack(currentPlayer);
                if (stackInfo) {
                    setInspecting({ type: stackInfo.type as any, pid: destPid });
                    setRevealedCardIds(new Set()); setDragState(null); return;
                }
            }
            if (!currentPlayer?.zones.hand.some(c => c.uuid === card.uuid)) handleAction('TOGGLE_REST', { card_uuid: card.uuid });
            setDragState(null); return;
        }
        await handleAction('MOVE_CARD', { card_uuid: card.uuid, dest_player_id: destPid, dest_zone: destZone });
        setDragState(null);
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
    };
  }, [dragState, gameState, inspecting, isRotated]);

  const handleAction = async (type: string, params: any) => {
      if (isPending || !gameState || !activeGameId) return;
      setIsPending(true);
      try {
          const pid = myPlayerId === 'both' ? (params.player_id || 'p1') : myPlayerId;
          const res = await apiClient.sendSandboxAction(activeGameId, { action_type: type, player_id: pid, ...params });
          setGameState(res.state);
      } catch(e) { logger.error('sandbox.action_fail', String(e)); } finally { setIsPending(false); }
  };

  if (gameState && gameState.status === 'WAITING') {
    const canStart = gameState.ready_states.p1 && gameState.ready_states.p2;
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#1a0b0b', color: '#f0e6d2', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'serif' }}>
        <h1 style={{ color: '#ffd700', textShadow: '0 2px 4px black' }}>ROOM: {gameState.room_name}</h1>
        <div style={{ display: 'flex', gap: '40px', marginTop: '30px' }}>
          {['p1', 'p2'].map(pid => (
            <div key={pid} style={{ background: 'rgba(255,255,255,0.05)', padding: '30px', borderRadius: '12px', border: '2px solid #5d4037', width: '250px', textAlign: 'center' }}>
              <h2 style={{ margin: '0 0 20px 0' }}>{pid.toUpperCase()} {gameState.players[pid].name}</h2>
              <div style={{ marginBottom: '20px' }}>
                {gameState.ready_states[pid] ? <span style={{ color: '#2ecc71', fontWeight: 'bold' }}>READY</span> : <span style={{ color: '#e74c3c' }}>NOT READY</span>}
              </div>
              {(pid === myPlayerId || myPlayerId === 'both') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <select style={{ padding: '10px', background: '#fff8e1', border: '1px solid #8b4513' }} onChange={(e) => handleAction('SET_DECK', { player_id: pid, deck_id: e.target.value })}>
                    <option value="">デッキを選択...</option>
                    {deckOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                  </select>
                  <button onClick={() => handleAction('READY', { player_id: pid })} style={{ padding: '10px', background: gameState.ready_states[pid] ? '#555' : '#d32f2f', color: 'white', border: 'none', cursor: 'pointer' }}>
                    {gameState.ready_states[pid] ? 'キャンセル' : '準備完了'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ marginTop: '50px', display: 'flex', gap: '20px' }}>
           <button onClick={onBack} style={{ padding: '15px 30px', background: '#555', color: 'white', border: 'none', cursor: 'pointer' }}>退出</button>
           {(myPlayerId === 'p1' || myPlayerId === 'both') && (
             <button disabled={!canStart} onClick={() => handleAction('START', {})} style={{ padding: '15px 60px', background: canStart ? '#2ecc71' : '#333', color: 'white', border: 'none', cursor: canStart ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}>開始</button>
           )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', background: '#000' }}>
      <div ref={pixiContainerRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }} />
      {!gameState && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 9999, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', color: 'white' }}>
            <h2>Connecting...</h2>
        </div>
      )}
      {gameState && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 100, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: 10, pointerEvents: 'auto' }}>
                <button onClick={onBack} style={{ background: 'rgba(0, 0, 0, 0.6)', color: 'white', border: '1px solid #555', borderRadius: '4px', padding: '5px 10px' }}>TOPへ</button>
            </div>
            <button onClick={() => handleAction('TURN_END', {})} disabled={isPending} style={{ position: 'absolute', left: layoutCoords ? `${layoutCoords.x}px` : 'auto', top: layoutCoords ? `${layoutCoords.y}px` : '50%', padding: '10px 20px', backgroundColor: isPending ? COLORS.BTN_DISABLED : COLORS.BTN_PRIMARY, color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', pointerEvents: 'auto' }}>
              {isPending ? '送信中' : '終了'}
            </button>
        </div>
      )}
    </div>
  );
};
