import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { LAYOUT_CONSTANTS } from '../layout/layout.config';
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

  const { COLORS } = LAYOUT_CONSTANTS;

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

    const handleResize = () => {
      app.renderer.resize(window.innerWidth, window.innerHeight);
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

    while (app.stage.children.length > 0) {
      const c = app.stage.children[0];
      app.stage.removeChild(c);
      c.destroy({ children: true });
    }

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

    const p1Side = createSandboxBoardSide(gameState.players.p1, false, W, coords, onCardDown);
    p1Side.y = midY;
    app.stage.addChild(p1Side);

    const p2Side = createSandboxBoardSide(gameState.players.p2, true, W, coords, onCardDown);
    p2Side.y = 0;
    app.stage.addChild(p2Side);

    if (dragState) {
        app.stage.addChild(dragState.sprite);
    }

  }, [gameState, isPending]);

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
        const checkZone = (pid: string, isOpp: boolean) => {
            const yBase = isOpp ? 0 : midY;
            if (checkDist(coords.getLeaderX(W), isOpp ? coords.getY(2) : yBase + coords.getY(2) + coords.CH/2) < THRESHOLD) return 'leader';
            if (checkDist(coords.getTrashX(W), isOpp ? coords.midY - coords.getY(3) - coords.CH/2 : yBase + coords.getY(3) + coords.CH/2) < THRESHOLD) return 'trash';
            const handY = isOpp ? coords.getY(4) : yBase + coords.getY(4) + coords.CH/2;
            if (Math.abs(handY - endPos.y) < coords.CH) return 'hand';
            if (checkDist(coords.getDeckX(W), isOpp ? coords.getY(2) : yBase + coords.getY(2) + coords.CH/2) < THRESHOLD) return 'deck';
            return null;
        };
        
        const detectedZone = checkZone(destPid, destPid === 'p2');
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
        const res = await apiClient.sendSandboxAction(gameState.game_id, { action_type: 'TURN_END' });
        setGameState(res.state);
    } finally {
        setIsPending(false);
    }
  };

  const handleDraw = async () => {
    if (!gameState || isPending) return;
    setIsPending(true);
    try {
        const res = await apiClient.sendSandboxAction(gameState.game_id, { action_type: 'DRAW' });
        setGameState(res.state);
    } finally {
        setIsPending(false);
    }
  };

  const btnStyle = {
    padding: '10px 20px',
    background: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold'
  };

  return (
    <div ref={pixiContainerRef} style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 10 }}>
          <button onClick={onBack} style={btnStyle}>Exit</button>
          <div style={{ color: 'white', background: 'rgba(0,0,0,0.5)', padding: '5px 10px' }}>
              Turn: {gameState?.turn_info?.turn_count} ({gameState?.turn_info?.active_player_id})
          </div>
      </div>

      <div style={{ position: 'absolute', bottom: 20, right: 20, display: 'flex', gap: 10 }}>
          <button onClick={handleDraw} style={btnStyle} disabled={isPending}>Draw</button>
          <button onClick={handleTurnEnd} style={{ ...btnStyle, background: '#e74c3c' }} disabled={isPending}>Turn End</button>
      </div>
    </div>
  );
};
