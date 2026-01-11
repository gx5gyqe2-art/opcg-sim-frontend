import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { LAYOUT_CONSTANTS, LAYOUT_PARAMS } from '../layout/layout.config';
import { calculateCoordinates } from '../layout/layoutEngine';
import { createSandboxBoardSide } from '../ui/SandboxBoardSide';
import { createCardContainer } from '../ui/CardRenderer';
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
  
  // 座標管理用のステート
  const [layoutCoords, setLayoutCoords] = useState<{ x: number, y: number } | null>(null);

  const { COLORS } = LAYOUT_CONSTANTS;
  const { Z_INDEX } = LAYOUT_PARAMS;

  // ゲーム初期化
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

  // PixiJS初期化 & リサイズハンドラ
  useEffect(() => {
    if (!pixiContainerRef.current) return;

    // 既存のCanvasがあれば削除
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

    // 初回座標計算
    const coords = calculateCoordinates(window.innerWidth, window.innerHeight);
    setLayoutCoords(coords.turnEndPos);

    const handleResize = () => {
      app.renderer.resize(window.innerWidth, window.innerHeight);
      // リサイズ時に座標を再計算
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

    while (app.stage.children.length > 0) {
      const c = app.stage.children[0];
      app.stage.removeChild(c);
      c.destroy({ children: true });
    }

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

    // ドラッグ開始ハンドラ
    const onCardDown = (e: PIXI.FederatedPointerEvent, card: CardInstance) => {
        if (isPending || dragState) return;

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

    // ボード描画
    const p1Side = createSandboxBoardSide(gameState.players.p1, false, W, coords, onCardDown);
    p1Side.y = midY;
    app.stage.addChild(p1Side);

    const p2Side = createSandboxBoardSide(gameState.players.p2, true, W, coords, onCardDown);
    p2Side.y = 0;
    app.stage.addChild(p2Side);

    // ドラッグ中のスプライト維持
    if (dragState) {
        app.stage.addChild(dragState.sprite);
    }

  }, [gameState, isPending]);

  // グローバルイベントリスナー (Drag Move/Up)
  useEffect(() => {
    const app = appRef.current;
    if (!app) return;

    const onPointerMove = (e: PointerEvent) => {
        if (!dragState) return;
        const newPos = { x: e.clientX, y: e.clientY };
        dragState.sprite.position.set(newPos.x, newPos.y);
    };

    const onPointerUp = async (e: PointerEvent) => {
        if (!dragState) return;
        
        const endPos = { x: e.clientX, y: e.clientY };
        const card = dragState.card;
        
        const { width: W, height: H } = app.screen;
        const coords = calculateCoordinates(W, H);
        const midY = H / 2;

        let destPid = endPos.y > midY ? 'p1' : 'p2';
        let destZone = 'field'; 

        const checkDist = (tx: number, ty: number) => {
            const dx = tx - endPos.x;
            const dy = ty - endPos.y;
            return Math.sqrt(dx*dx + dy*dy);
        };

        const THRESHOLD = coords.CH; 
        
        const checkZone = (isOpp: boolean) => {
            const yBase = isOpp ? 0 : midY;
            if (checkDist(coords.getLeaderX(W), isOpp ? coords.getY(2) : yBase + coords.getY(2) + coords.CH/2) < THRESHOLD) return 'leader';
            if (checkDist(coords.getTrashX(W), isOpp ? coords.midY - coords.getY(3) - coords.CH/2 : yBase + coords.getY(3) + coords.CH/2) < THRESHOLD) return 'trash';
            const handY = isOpp ? coords.getY(4) : yBase + coords.getY(4) + coords.CH/2;
            if (Math.abs(handY - endPos.y) < coords.CH) return 'hand';
            if (checkDist(coords.getDeckX(W), isOpp ? coords.getY(2) : yBase + coords.getY(2) + coords.CH/2) < THRESHOLD) return 'deck';
            return null;
        };
        
        const detectedZone = checkZone(destPid === 'p2');
        if (detectedZone) destZone = detectedZone;
        
        const distFromStart = Math.sqrt(Math.pow(endPos.x - dragState.startPos.x, 2) + Math.pow(endPos.y - dragState.startPos.y, 2));
        if (distFromStart < 10) {
            setIsPending(true);
            try {
                const res = await apiClient.sendSandboxAction(gameState!.game_id, {
                    action_type: 'TOGGLE_REST',
                    card_uuid: card.uuid
                });
                setGameState(res.state);
            } finally {
                setIsPending(false);
                setDragState(null);
            }
            return;
        }

        setIsPending(true);
        try {
            const res = await apiClient.sendSandboxAction(gameState!.game_id, {
                action_type: 'MOVE_CARD',
                card_uuid: card.uuid,
                dest_player_id: destPid,
                dest_zone: destZone
            });
            setGameState(res.state);
        } catch(e) {
            console.error(e);
        } finally {
            setIsPending(false);
            setDragState(null);
        }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
    };
  }, [dragState, gameState]);

  const handleTurnEnd = async () => {
    if (!gameState || isPending) return;
    setIsPending(true);
    try {
        const res = await apiClient.sendSandboxAction(gameState.game_id, {
            action_type: 'TURN_END'
        });
        setGameState(res.state);
    } catch(e) {
        console.error("Turn end failed", e);
    } finally {
        setIsPending(false);
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', background: '#000' }}>
      
      {/* 1. Canvas Layer */}
      <div 
        ref={pixiContainerRef} 
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }} 
      />

      {/* 2. UI Overlay Layer */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 100, pointerEvents: 'none' }}>
          
          {/* 左上: 戻るボタンなど */}
          <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: 10, pointerEvents: 'auto' }}>
              <button 
                onClick={onBack}
                style={{
                  zIndex: Z_INDEX.OVERLAY + 20,
                  background: 'rgba(0, 0, 0, 0.6)',
                  color: 'white',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  padding: '5px 10px',
                  cursor: 'pointer'
                }}
              >
                TOPへ
              </button>
              <div style={{ color: 'white', background: 'rgba(0,0,0,0.6)', padding: '5px 10px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}>
                  Turn: {gameState?.turn_info?.turn_count} ({gameState?.turn_info?.active_player_id?.toUpperCase()})
              </div>
          </div>

          {/* ターン終了ボタン */}
          <button 
            onClick={handleTurnEnd} 
            disabled={isPending}
            style={{
              position: 'absolute',
              left: layoutCoords ? `${layoutCoords.x}px` : 'auto',
              top: layoutCoords ? `${layoutCoords.y}px` : '50%',
              right: layoutCoords ? 'auto' : '20px',
              transform: 'translateY(-50%)',
              padding: '10px 20px',
              backgroundColor: isPending ? COLORS.BTN_DISABLED : COLORS.BTN_PRIMARY,
              color: 'white', 
              border: 'none', 
              borderRadius: '5px',
              cursor: isPending ? 'not-allowed' : 'pointer', 
              zIndex: Z_INDEX.NOTIFICATION, 
              fontWeight: 'bold',
              pointerEvents: 'auto'
            }}
          >
            {isPending ? '送信中...' : 'ターン終了'}
          </button>

      </div>

    </div>
  );
};
