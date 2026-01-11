import { useEffect, useRef, useState, useMemo } from 'react';
import * as PIXI from 'pixi.js';
import { LAYOUT_CONSTANTS, LAYOUT_PARAMS } from '../layout/layout.config';
import { calculateCoordinates } from '../layout/layoutEngine';
import { createSandboxBoardSide } from '../ui/SandboxBoardSide';
import { createCardContainer } from '../ui/CardRenderer';
import { createInspectOverlay } from '../ui/InspectOverlay';
import { apiClient } from '../api/client';
import type { GameState, CardInstance } from '../game/types';

type DragState = {
  card: CardInstance;
  sprite: PIXI.Container;
  startPos: { x: number, y: number };
} | null;

export const SandboxGame = ({ p1Deck, p2Deck, onBack }: { p1Deck: string, p2Deck: string, onBack: () => void }) => {
  const pixiContainerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [dragState, setDragState] = useState<DragState>(null);
  const [isPending, setIsPending] = useState(false);
  
  // 状態管理
  const [inspecting, setInspecting] = useState<{ type: 'deck' | 'life' | 'trash', pid: string } | null>(null);
  const [layoutCoords, setLayoutCoords] = useState<{ x: number, y: number } | null>(null);
  
  const isRotated = gameState?.turn_info?.active_player_id === 'p2';
  const { COLORS } = LAYOUT_CONSTANTS;
  const { Z_INDEX } = LAYOUT_PARAMS;

  const inspectingCards = useMemo(() => {
      if (!inspecting || !gameState) return [];
      const p = inspecting.pid === 'p1' ? gameState.players.p1 : gameState.players.p2;
      
      if (inspecting.type === 'deck') return p.zones.deck || [];
      if (inspecting.type === 'life') return p.zones.life || [];
      if (inspecting.type === 'trash') return p.zones.trash || [];
      return [];
  }, [gameState, inspecting]);

  // 初期化
  useEffect(() => {
    const initGame = async () => {
      try {
        const { state } = await apiClient.createSandboxGame(p1Deck, p2Deck);
        setGameState(state);
      } catch (e) {
        console.error(e);
        alert("Failed to start sandbox");
        onBack();
      }
    };
    initGame();
  }, []);

  // PixiJS Setup
  useEffect(() => {
    if (!pixiContainerRef.current) return;
    while (pixiContainerRef.current.firstChild) {
      pixiContainerRef.current.removeChild(pixiContainerRef.current.firstChild);
    }
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
  }, []);

  // 描画ループ
  useEffect(() => {
    const app = appRef.current;
    if (!app || !gameState) return;

    // クリーンアップ
    const childrenToDestroy: PIXI.DisplayObject[] = [];
    const children = [...app.stage.children];
    children.forEach(child => {
      if (dragState && child === dragState.sprite) {
        app.stage.removeChild(child);
      } else {
        childrenToDestroy.push(child);
      }
    });
    childrenToDestroy.forEach(child => {
      app.stage.removeChild(child);
      child.destroy({ children: true });
    });

    const { width: W, height: H } = app.screen;
    const coords = calculateCoordinates(W, H);
    const midY = H / 2;

    // 背景
    const bg = new PIXI.Graphics();
    bg.beginFill(COLORS.OPPONENT_BG).drawRect(0, 0, W, midY).endFill();
    bg.beginFill(COLORS.PLAYER_BG).drawRect(0, midY, W, H - midY).endFill();
    app.stage.addChild(bg);

    const border = new PIXI.Graphics();
    border.lineStyle(2, COLORS.BORDER_LINE, 0.5);
    border.moveTo(0, midY);
    border.lineTo(W, midY);
    app.stage.addChild(border);

    // 共通ドラッグ開始処理
    const startDrag = (card: CardInstance, startPoint: { x: number, y: number }) => {
        const ghost = createCardContainer(card, coords.CW, coords.CH, { onClick: () => {} });
        ghost.position.set(startPoint.x, startPoint.y);
        ghost.alpha = 0.8;
        ghost.scale.set(1.1);
        
        app.stage.addChild(ghost);

        setDragState({
            card,
            sprite: ghost,
            startPos: startPoint
        });
    };

    // ボードからのドラッグ開始
    const onCardDown = (e: PIXI.FederatedPointerEvent, card: CardInstance) => {
        if (isPending) return;
        if (inspecting) return;
        if (dragState) return;

        startDrag(card, { x: e.global.x, y: e.global.y });
    };

    const bottomPlayer = isRotated ? gameState.players.p2 : gameState.players.p1;
    const topPlayer = isRotated ? gameState.players.p1 : gameState.players.p2;

    const bottomSide = createSandboxBoardSide(
        bottomPlayer, false, W, coords, onCardDown
    );
    bottomSide.y = midY;
    app.stage.addChild(bottomSide);

    const topSide = createSandboxBoardSide(
        topPlayer, true, W, coords, onCardDown
    );
    topSide.y = 0;
    app.stage.addChild(topSide);

    // インスペクター
    if (inspecting) {
        const overlay = createInspectOverlay(
            inspecting.type,
            inspectingCards,
            W, H,
            () => setInspecting(null),
            (card, startPos) => {
                startDrag(card, startPos);
            }
        );
        app.stage.addChild(overlay);
    }

    if (dragState) {
        app.stage.addChild(dragState.sprite);
    }

  }, [gameState, isPending, dragState, inspecting, isRotated, inspectingCards]);

  // イベントリスナー
  useEffect(() => {
    const app = appRef.current;
    if (!app) return;

    const onPointerMove = (e: PointerEvent) => {
        if (!dragState) return;
        if (dragState.card.type === 'LEADER') return;
        const newPos = { x: e.clientX, y: e.clientY };
        dragState.sprite.position.set(newPos.x, newPos.y);
    };

    const onPointerUp = async (e: PointerEvent) => {
        if (!dragState) return;
        
        const card = dragState.card;
        const endPos = { x: e.clientX, y: e.clientY };
        const distFromStart = Math.sqrt(Math.pow(endPos.x - dragState.startPos.x, 2) + Math.pow(endPos.y - dragState.startPos.y, 2));

        if (card.type === 'LEADER') {
            if (distFromStart < 10) handleAction('TOGGLE_REST', { card_uuid: card.uuid });
            setDragState(null);
            return;
        }
        
        const { width: W, height: H } = app.screen;
        const coords = calculateCoordinates(W, H);
        const midY = H / 2;

        const isTopArea = endPos.y < midY;
        let destPid = isTopArea ? (isRotated ? 'p1' : 'p2') : (isRotated ? 'p2' : 'p1');
        let destZone = 'field'; 

        // 移動制限
        if (card.owner_id) {
            const p1Name = gameState?.players.p1.name;
            const p2Name = gameState?.players.p2.name;
            
            if (card.owner_id === p1Name && destPid === 'p2') {
                setDragState(null);
                return;
            }
            if (card.owner_id === p2Name && destPid === 'p1') {
                setDragState(null);
                return;
            }
        }

        const checkDist = (tx: number, ty: number) => {
            const dx = tx - endPos.x;
            const dy = ty - endPos.y;
            return Math.sqrt(dx*dx + dy*dy);
        };
        const THRESHOLD = coords.CH; 
        
        const checkZone = (isTopSide: boolean) => {
            const yBase = isTopSide ? 0 : midY;
            const row2Y = isTopSide ? coords.midY - coords.getY(2) - coords.CH/2 : yBase + coords.getY(2) + coords.CH/2;
            const row3Y = isTopSide ? coords.midY - coords.getY(3) - coords.CH/2 : yBase + coords.getY(3) + coords.CH/2;
            const row4Y = isTopSide ? coords.midY - coords.getY(4) - coords.CH/2 : yBase + coords.getY(4) + coords.CH/2;

            if (checkDist(coords.getLeaderX(W), row2Y) < THRESHOLD) return 'leader';
            if (checkDist(coords.getStageX(W), row2Y) < THRESHOLD) return 'stage';
            if (checkDist(coords.getLifeX(W), row2Y) < THRESHOLD) return 'life';
            if (checkDist(coords.getTrashX(W), row3Y) < THRESHOLD) return 'trash';
            if (checkDist(coords.getDeckX(W), row2Y) < THRESHOLD) return 'deck';
            if (Math.abs(row4Y - endPos.y) < coords.CH) return 'hand';
            if (checkDist(coords.getDonDeckX(W), row3Y) < THRESHOLD) return 'don_deck';
            if (checkDist(coords.getDonActiveX(W), row3Y) < THRESHOLD) return 'don_active';
            if (checkDist(coords.getDonRestX(W), row3Y) < THRESHOLD) return 'don_rested';
            return null;
        };
        
        // ドン処理
        if (card.card_id === "DON" || card.type === "DON") {
            const targetPlayer = destPid === 'p1' ? gameState?.players.p1 : gameState?.players.p2;
            if (targetPlayer) {
                const yBase = isTopArea ? 0 : midY;
                const leaderY = isTopArea 
                    ? (midY - coords.getY(2) - coords.CH/2) 
                    : (yBase + coords.getY(2) + coords.CH/2);
                const leaderX = coords.getLeaderX(W);

                if (targetPlayer.leader && 
                    Math.abs(endPos.x - leaderX) < THRESHOLD && 
                    Math.abs(endPos.y - leaderY) < THRESHOLD) {
                     handleAction('ATTACH_DON', { card_uuid: card.uuid, target_uuid: targetPlayer.leader.uuid });
                     setDragState(null);
                     return;
                }
                
                const fieldY = isTopArea 
                    ? (midY - coords.getY(1) - coords.CH/2)
                    : (yBase + coords.getY(1) + coords.CH/2);

                const fieldCards = targetPlayer.zones.field;
                for (let i = 0; i < fieldCards.length; i++) {
                    const cx = coords.getFieldX(i, W, coords.CW, fieldCards.length);
                    if (Math.abs(endPos.x - cx) < THRESHOLD && Math.abs(endPos.y - fieldY) < THRESHOLD) {
                        handleAction('ATTACH_DON', { card_uuid: card.uuid, target_uuid: fieldCards[i].uuid });
                        setDragState(null);
                        return;
                    }
                }
            }
            
            const dZone = checkZone(isTopArea); 
            if (dZone === 'don_active' || dZone === 'don_rested' || dZone === 'don_deck') {
                handleAction('MOVE_CARD', { card_uuid: card.uuid, dest_player_id: destPid, dest_zone: dZone });
            }
            setDragState(null);
            return;
        }

        const detectedZone = checkZone(isTopArea); 
        if (detectedZone) destZone = detectedZone;
        
        if (['don_deck', 'don_active', 'don_rested'].includes(destZone)) {
            setDragState(null);
            return;
        }

        if (distFromStart < 10) {
            if (inspecting) {
                setDragState(null);
                return;
            }

            const currentPlayer = destPid === 'p1' ? gameState?.players.p1 : gameState?.players.p2;
            
            // ★修正: 未使用引数 pid を削除
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
                    setDragState(null);
                    return;
                }
            }

            const isInHand = currentPlayer?.zones.hand.some(c => c.uuid === card.uuid);
            if (!isInHand) handleAction('TOGGLE_REST', { card_uuid: card.uuid });
            
            setDragState(null);
            return;
        }

        await handleAction('MOVE_CARD', {
            card_uuid: card.uuid,
            dest_player_id: destPid,
            dest_zone: destZone
        });
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
      if (isPending || !gameState) return;
      setIsPending(true);
      try {
          const res = await apiClient.sendSandboxAction(gameState.game_id, {
              action_type: type,
              ...params
          });
          setGameState(res.state);
      } catch(e) {
          console.error(e);
      } finally {
          setIsPending(false);
      }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', background: '#000' }}>
      
      <div ref={pixiContainerRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }} />

      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 100, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: 10, pointerEvents: 'auto' }}>
              <button 
                onClick={onBack}
                style={{ zIndex: Z_INDEX.OVERLAY + 20, background: 'rgba(0, 0, 0, 0.6)', color: 'white', border: '1px solid #555', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer' }}
              >
                TOPへ
              </button>
              <div style={{ color: 'white', background: 'rgba(0,0,0,0.6)', padding: '5px 10px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}>
                  Turn: {gameState?.turn_info?.turn_count} ({gameState?.turn_info?.active_player_id?.toUpperCase()})
              </div>
          </div>

          <button 
            onClick={() => handleAction('TURN_END', {})}
            disabled={isPending}
            style={{
              position: 'absolute',
              left: layoutCoords ? `${layoutCoords.x}px` : 'auto',
              top: layoutCoords ? `${layoutCoords.y}px` : '50%',
              right: layoutCoords ? 'auto' : '20px',
              transform: 'translateY(-50%)',
              padding: '10px 20px',
              backgroundColor: isPending ? COLORS.BTN_DISABLED : COLORS.BTN_PRIMARY,
              color: 'white', border: 'none', borderRadius: '5px', cursor: isPending ? 'not-allowed' : 'pointer', zIndex: Z_INDEX.NOTIFICATION, fontWeight: 'bold', pointerEvents: 'auto'
            }}
          >
            {isPending ? '送信中...' : 'ターン終了'}
          </button>
      </div>
    </div>
  );
};
