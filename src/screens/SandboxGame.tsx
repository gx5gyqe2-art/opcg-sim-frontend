import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { LAYOUT_CONSTANTS, LAYOUT_PARAMS } from '../layout/layout.config';
import { calculateCoordinates } from '../layout/layoutEngine';
import { createSandboxBoardSide } from '../ui/SandboxBoardSide';
import { createCardContainer } from '../ui/CardRenderer';
import { apiClient } from '../api/client';
import type { GameState, CardInstance } from '../game/types';
import { API_CONFIG } from '../api/api.config';

type DragState = {
  card: CardInstance;
  sprite: PIXI.Container;
  startPos: { x: number, y: number };
} | null;

const InspectModal = ({ type, cards, onClose, onMove }: { type: string, cards: CardInstance[], onClose: () => void, onMove: (uuid: string, to: 'hand' | 'trash') => void }) => {
    return (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: 'white', marginBottom: 20, fontSize: 24, fontWeight: 'bold' }}>{type.toUpperCase()} ({cards.length})</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, maxWidth: '80%', maxHeight: '60%', overflowY: 'auto', justifyContent: 'center' }}>
                {cards.map(c => (
                    <div key={c.uuid} style={{ position: 'relative', width: 80, height: 112 }}>
                        <img 
                            src={`${API_CONFIG.IMAGE_BASE_URL}/${c.card_id}.png`} 
                            style={{ width: '100%', height: '100%', borderRadius: 4 }}
                            onError={(e) => { e.currentTarget.style.display='none'; }}
                        />
                        <div style={{ position: 'absolute', bottom: 0, width: '100%', display: 'flex', flexDirection: 'column' }}>
                            <button onClick={() => onMove(c.uuid, 'hand')} style={{ fontSize: 10, background: '#3498db', color: 'white', border: 'none', cursor: 'pointer' }}>To Hand</button>
                            <button onClick={() => onMove(c.uuid, 'trash')} style={{ fontSize: 10, background: '#e74c3c', color: 'white', border: 'none', cursor: 'pointer' }}>To Trash</button>
                        </div>
                    </div>
                ))}
            </div>
            <button onClick={onClose} style={{ marginTop: 20, padding: '10px 30px', fontSize: 18, cursor: 'pointer' }}>Close</button>
        </div>
    );
};

export const SandboxGame = ({ p1Deck, p2Deck, onBack }: { p1Deck: string, p2Deck: string, onBack: () => void }) => {
  const pixiContainerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [dragState, setDragState] = useState<DragState>(null);
  const [isPending, setIsPending] = useState(false);
  const [inspecting, setInspecting] = useState<{ type: 'deck' | 'life', cards: CardInstance[], pid: string } | null>(null);
  
  const [layoutCoords, setLayoutCoords] = useState<{ x: number, y: number } | null>(null);

  const { COLORS } = LAYOUT_CONSTANTS;
  const { Z_INDEX } = LAYOUT_PARAMS;

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

  useEffect(() => {
    const app = appRef.current;
    if (!app || !gameState) return;

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

    const bg = new PIXI.Graphics();
    bg.beginFill(COLORS.OPPONENT_BG).drawRect(0, 0, W, midY).endFill();
    bg.beginFill(COLORS.PLAYER_BG).drawRect(0, midY, W, H - midY).endFill();
    app.stage.addChild(bg);

    const border = new PIXI.Graphics();
    border.lineStyle(2, COLORS.BORDER_LINE, 0.5);
    border.moveTo(0, midY);
    border.lineTo(W, midY);
    app.stage.addChild(border);

    const onCardDown = (e: PIXI.FederatedPointerEvent, card: CardInstance) => {
        if (isPending || dragState || inspecting) return;

        const globalPos = e.global.clone();
        const ghost = createCardContainer(card, coords.CW, coords.CH, { onClick: () => {} });
        ghost.position.set(globalPos.x, globalPos.y);
        ghost.alpha = 0.8;
        ghost.scale.set(1.1);
        app.stage.addChild(ghost);

        setDragState({
            card,
            sprite: ghost,
            startPos: globalPos
        });
    };

    const handleInspect = (type: 'deck' | 'life', cards: CardInstance[], pid: string) => {
        setInspecting({ type, cards, pid });
    };

    const p1Side = createSandboxBoardSide(
        gameState.players.p1, false, W, coords, onCardDown, 
        (t, c) => handleInspect(t, c, 'p1')
    );
    p1Side.y = midY;
    app.stage.addChild(p1Side);

    const p2Side = createSandboxBoardSide(
        gameState.players.p2, true, W, coords, onCardDown,
        (t, c) => handleInspect(t, c, 'p2')
    );
    p2Side.y = 0;
    app.stage.addChild(p2Side);

    if (dragState) {
        app.stage.addChild(dragState.sprite);
    }

  }, [gameState, isPending, dragState, inspecting]);

  useEffect(() => {
    const app = appRef.current;
    if (!app) return;

    const onPointerMove = (e: PointerEvent) => {
        if (!dragState) return;
        
        // リーダーは固定
        if (dragState.card.type === 'LEADER') return;

        const newPos = { x: e.clientX, y: e.clientY };
        dragState.sprite.position.set(newPos.x, newPos.y);
    };

    const onPointerUp = async (e: PointerEvent) => {
        if (!dragState) return;
        
        const card = dragState.card;
        const endPos = { x: e.clientX, y: e.clientY };
        const distFromStart = Math.sqrt(Math.pow(endPos.x - dragState.startPos.x, 2) + Math.pow(endPos.y - dragState.startPos.y, 2));

        // 1. リーダーの特別処理
        if (card.type === 'LEADER') {
            if (distFromStart < 10) {
                // クリックならレスト切替
                handleAction('TOGGLE_REST', { card_uuid: card.uuid });
            }
            setDragState(null);
            return;
        }
        
        const { width: W, height: H } = app.screen;
        const coords = calculateCoordinates(W, H);
        const midY = H / 2;

        let destPid = endPos.y > midY ? 'p1' : 'p2';
        let destZone = 'field'; 

        // 相手陣地へのドロップ禁止
        if (destPid === 'p2') {
            setDragState(null);
            return;
        }

        const checkDist = (tx: number, ty: number) => {
            const dx = tx - endPos.x;
            const dy = ty - endPos.y;
            return Math.sqrt(dx*dx + dy*dy);
        };

        const THRESHOLD = coords.CH; 
        
        const checkZone = (isOpp: boolean) => {
            const yBase = isOpp ? 0 : midY;
            const row2Y = isOpp ? coords.midY - coords.getY(2) - coords.CH/2 : yBase + coords.getY(2) + coords.CH/2;
            const row3Y = isOpp ? coords.midY - coords.getY(3) - coords.CH/2 : yBase + coords.getY(3) + coords.CH/2;
            const row4Y = isOpp ? coords.midY - coords.getY(4) - coords.CH/2 : yBase + coords.getY(4) + coords.CH/2;

            if (checkDist(coords.getLeaderX(W), row2Y) < THRESHOLD) return 'leader';
            if (checkDist(coords.getStageX(W), row2Y) < THRESHOLD) return 'stage';
            if (checkDist(coords.getTrashX(W), row3Y) < THRESHOLD) return 'trash';
            if (checkDist(coords.getDeckX(W), row2Y) < THRESHOLD) return 'deck';
            
            if (Math.abs(row4Y - endPos.y) < coords.CH) return 'hand';

            if (checkDist(coords.getDonDeckX(W), row3Y) < THRESHOLD) return 'don_deck';
            if (checkDist(coords.getDonActiveX(W), row3Y) < THRESHOLD) return 'don_active';
            if (checkDist(coords.getDonRestX(W), row3Y) < THRESHOLD) return 'don_rested';

            return null;
        };
        
        // 2. ドン!!カードの処理
        if (card.card_id === "DON" || card.type === "DON") {
            const targetPlayer = destPid === 'p1' ? gameState?.players.p1 : gameState?.players.p2;
            if (targetPlayer) {
                // 付与判定
                const leaderX = coords.getLeaderX(W);
                const leaderY = destPid === 'p2' ? (coords.midY - coords.getY(2) - coords.CH/2) : (midY + coords.getY(2) + coords.CH/2);
                if (targetPlayer.leader && checkDist(leaderX, leaderY) < THRESHOLD) {
                     handleAction('ATTACH_DON', { card_uuid: card.uuid, target_uuid: targetPlayer.leader.uuid });
                     setDragState(null);
                     return;
                }
                const fieldY = destPid === 'p2' ? (coords.midY - coords.getY(1) - coords.CH/2) : (midY + coords.getY(1) + coords.CH/2);
                const fieldCards = targetPlayer.zones.field;
                for (let i = 0; i < fieldCards.length; i++) {
                    const cx = coords.getFieldX(i, W, coords.CW, fieldCards.length);
                    if (checkDist(cx, fieldY) < THRESHOLD) {
                        handleAction('ATTACH_DON', { card_uuid: card.uuid, target_uuid: fieldCards[i].uuid });
                        setDragState(null);
                        return;
                    }
                }
            }

            // 移動先判定: ドンエリアのみ許可
            const dZone = checkZone(destPid === 'p2');
            if (dZone === 'don_active' || dZone === 'don_rested' || dZone === 'don_deck') {
                handleAction('MOVE_CARD', { card_uuid: card.uuid, dest_player_id: destPid, dest_zone: dZone });
            }
            setDragState(null);
            return;
        }

        // 3. 通常カードの処理
        const detectedZone = checkZone(destPid === 'p2');
        if (detectedZone) destZone = detectedZone;
        
        // 通常カードがドンエリアに行かないように制限
        if (['don_deck', 'don_active', 'don_rested'].includes(destZone)) {
            setDragState(null);
            return;
        }

        if (distFromStart < 10) {
            // ★追加: 手札の場合はレスト切り替えしない
            // 手札判定: gameStateから検索
            const isInHand = gameState?.players.p1.zones.hand.some(c => c.uuid === card.uuid);
            
            if (!isInHand) {
                handleAction('TOGGLE_REST', { card_uuid: card.uuid });
            }
            setDragState(null);
            return;
        }

        handleAction('MOVE_CARD', {
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
  }, [dragState, gameState]);

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

  const handleInspectMove = async (uuid: string, to: 'hand' | 'trash') => {
      if (!gameState || !inspecting) return;
      await handleAction('MOVE_CARD', {
          card_uuid: uuid,
          dest_player_id: inspecting.pid,
          dest_zone: to
      });
      setInspecting(null);
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

      {inspecting && (
          <div style={{ pointerEvents: 'auto' }}>
              <InspectModal 
                  type={inspecting.type} 
                  cards={inspecting.cards} 
                  onClose={() => setInspecting(null)} 
                  onMove={handleInspectMove}
              />
          </div>
      )}

    </div>
  );
};
