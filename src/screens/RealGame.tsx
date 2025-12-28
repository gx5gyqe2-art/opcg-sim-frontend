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

  const { startGame } = useGameAction(CONST.PLAYER_KEYS.P1, setGameState);

  const handleAction = async (type: string, payload: any = {}) => {
    if (!gameState?.game_id) return;
    try {
      const newState = await apiClient.sendAction(gameState.game_id, {
        request_id: Math.random().toString(36).substring(2, 15),
        action_type: type as any,
        player_id: CONST.c_to_s_interface.PLAYER_KEYS.P1,
        card_id: payload.uuid,
        extra: payload.extra
      });

      if (newState) {
        setGameState(newState);
        setIsDetailMode(false);
        setSelectedCard(null);
      }
    } catch (err) {
      logger.log({
        level: 'error',
        action: 'game.action_error',
        msg: 'Failed to execute action',
        payload: { err, type, payload }
      });
    }
  };

  useEffect(() => {
    if (!pixiContainerRef.current) return;

    const app = new PIXI.Application({
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: 0x1a1a1a,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    pixiContainerRef.current.appendChild(app.view as HTMLCanvasElement);
    appRef.current = app;

    startGame();

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

    const renderScene = () => {
      app.stage.removeChildren();
      const { width: W, height: H } = app.screen;
      const coords = calculateCoordinates(W, H);
      const midY = H / 2;

      const bg = new PIXI.Graphics();
      bg.beginFill(LAYOUT_CONSTANTS.COLORS.OPPONENT_BG).drawRect(0, 0, W, midY).endFill();
      bg.beginFill(LAYOUT_CONSTANTS.COLORS.CONTROL_BG).drawRect(0, midY - 40, W, 80).endFill();
      bg.beginFill(LAYOUT_CONSTANTS.COLORS.PLAYER_BG).drawRect(0, midY + 40, W, H - (midY + 40)).endFill();
      app.stage.addChild(bg);

      const onCardClick = (card: any) => { 
        let currentLoc = 'field';
        
        if (card.owner_id === 'p1') {
          const p1 = gameState.players.p1;
          if (p1.zones.hand.some((c: any) => c.uuid === card.uuid)) {
            currentLoc = 'hand';
          } else if (p1.zones.field.some((c: any) => c.uuid === card.uuid)) {
            currentLoc = 'field';
          } else if (p1.zones.trash.some((c: any) => c.uuid === card.uuid)) {
            currentLoc = 'trash';
          } else if (p1.zones.life.some((c: any) => c.uuid === card.uuid)) {
            currentLoc = 'life';
          }
        } else {
          currentLoc = 'opp_field';
        }

        setSelectedCard({ card, location: currentLoc }); 
        setIsDetailMode(true); 
      };

      const p2Side = createBoardSide(gameState.players.p2, true, W, coords, onCardClick);
      p2Side.x = W;      
      p2Side.y = midY - 40; 
      p2Side.rotation = Math.PI; 
      
      const p1Side = createBoardSide(gameState.players.p1, false, W, coords, onCardClick);
      p1Side.y = midY + 40;

      app.stage.addChild(p2Side, p1Side);
    };

    renderScene();
  }, [gameState]);

  return (
    <div ref={pixiContainerRef} style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {isDetailMode && selectedCard && (
        <CardDetailSheet
          card={selectedCard.card}
          location={selectedCard.location}
          onAction={handleAction}
          onClose={() => {
            setIsDetailMode(false);
            setSelectedCard(null);
          }}
        />
      )}
    </div>
  );
};
