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
    } catch (err: any) {
      logger.error("api.action_error", err.message || "Unknown error");
    }
  };

  useEffect(() => {
    if (!gameState && !isPending) {
      startGame();
    }
  }, []);

  useEffect(() => {
    if (!pixiContainerRef.current) return;
    
    if (!appRef.current) {
      const app = new PIXI.Application({ 
        background: 0x1a1a1a, 
        resizeTo: window, 
        antialias: true, 
        resolution: window.devicePixelRatio || 1, 
        autoDensity: true 
      });
      appRef.current = app;
      pixiContainerRef.current.appendChild(app.view as any);
    }

    const app = appRef.current;
    if (!gameState) return;

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
        setSelectedCard({ card, location: card.location || 'field' }); 
        setIsDetailMode(true); 
      };

      // 【修正】相手側ボードの描画ロジックを自分側と同様に修正
      const p2Side = createBoardSide(gameState.players.p2, true, W, coords, onCardClick);
      // 回転（rotation）を削除し、x座標のオフセットを 0 に戻します
      p2Side.x = 0; 
      // 相手側エリア（画面上半分）に収まるよう y 座標を調整
      p2Side.y = 40; 
      
      const p1Side = createBoardSide(gameState.players.p1, false, W, coords, onCardClick);
      p1Side.y = midY + 40;

      app.stage.addChild(p2Side, p1Side);
    };

    renderScene();
  }, [gameState]);

  return (
    <div ref={pixiContainerRef} className="game-screen hand-scroll-area">
      {isDetailMode && selectedCard && (
        <CardDetailSheet 
          card={selectedCard.card} 
          location={selectedCard.location}
          onAction={handleAction}
          onClose={() => setIsDetailMode(false)}
        />
      )}
    </div>
  );
};
