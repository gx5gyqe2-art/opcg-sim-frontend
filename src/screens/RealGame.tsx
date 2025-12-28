// src/screens/RealGame.tsx
import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { LAYOUT_CONSTANTS } from '../layout/layout.config';
import { calculateCoordinates } from '../layout/layoutEngine';
import { createBoardSide } from '../ui/BoardSide';
import { useGameAction } from '../game/actions';
import { CardDetailSheet } from '../ui/CardDetailSheet';
import CONST from '../../shared_constants.json';
import { apiClient } from '../api/client';
import { logger } from '../utils/logger';

export const RealGame = () => {
  const pixiContainerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const [gameState, setGameState] = useState<any>(null);
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [isDetailMode, setIsDetailMode] = useState(false);

  const { startGame, isPending } = useGameAction(CONST.PLAYER_KEYS.P1, setGameState);

  const handleAction = async (type: string, payload: any = {}) => {
    if (!gameState?.game_id) return;
    try {
      const newState = await apiClient.sendAction(gameState.game_id, { ...payload, action_type: type, player_id: CONST.c_to_s_interface.PLAYER_KEYS.P1 });
      if (newState) { setGameState(newState); setIsDetailMode(false); }
    } catch (err) { logger.error("api.action_error", "Failed to send action"); }
  };

  useEffect(() => {
    if (!pixiContainerRef.current) return;
    if (!appRef.current) {
      appRef.current = new PIXI.Application({ background: 0xFFFFFF, resizeTo: window, antialias: true, resolution: window.devicePixelRatio || 1 });
      pixiContainerRef.current.appendChild(appRef.current.view as any);
    }

    const app = appRef.current;
    if (!gameState) return;

    app.stage.removeChildren();
    const { width: W, height: H } = app.screen;
    const coords = calculateCoordinates(W, H);
    const midY = H / 2;

    const bg = new PIXI.Graphics();
    bg.beginFill(LAYOUT_CONSTANTS.COLORS.OPPONENT_BG).drawRect(0, 0, W, midY).endFill();
    bg.beginFill(LAYOUT_CONSTANTS.COLORS.PLAYER_BG).drawRect(0, midY + 40, W, H - (midY + 40)).endFill();
    app.stage.addChild(bg);

    const onCardClick = (card: any) => { setSelectedCard({ card }); setIsDetailMode(true); };

    const p2Side = createBoardSide(gameState.players.p2, true, W, coords, onCardClick);
    p2Side.x = W; p2Side.y = midY - 40; p2Side.rotation = Math.PI;
    
    const p1Side = createBoardSide(gameState.players.p1, false, W, coords, onCardClick);
    p1Side.y = midY + 40;

    app.stage.addChild(p2Side, p1Side);

  }, [gameState]);

  return (
    <div ref={pixiContainerRef} className="game-screen">
      {!gameState && !isPending && <button onClick={startGame}>Start</button>}
      {isDetailMode && selectedCard && (
        <CardDetailSheet card={selectedCard.card} onClose={() => setIsDetailMode(false)} onAction={handleAction} />
      )}
    </div>
  );
};
