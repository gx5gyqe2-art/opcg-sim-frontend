import { useEffect, useRef, useCallback, useState } from 'react';
import * as PIXI from 'pixi.js';
import { COLORS } from '../layout/layout.constants';
import { calculateCoordinates } from '../layout/layoutEngine';
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

  const truncateText = (text: string, style: PIXI.TextStyle, maxWidth: number): string => {
    const metrics = PIXI.TextMetrics.measureText(text || "", style);
    if (metrics.width <= maxWidth) return text || "";
    let truncated = text || "";
    while (truncated.length > 0) {
      truncated = truncated.slice(0, -1);
      if (PIXI.TextMetrics.measureText(truncated + '...', style).width <= maxWidth) return truncated + '...';
    }
    return '...';
  };

  const validateGameState = (state: any) => {
    if (!state?.players?.p1?.zones || !state?.players?.p2?.zones) {
      logger.warn('game.state_validation', 'Unexpected GameState structure: zones are missing', { state });
    }
  };

  const handleAction = async (type: string, payload: any = {}) => {
    logger.log({
      level: 'info',
      action: 'game.handle_action',
      msg: `Attempting action: ${type} on card: ${payload.uuid || 'none'}`,
      payload: { type, cardId: payload.uuid, extra: payload.extra }
    });

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
        validateGameState(newState);
        setGameState(newState);
        setIsDetailMode(false);
        setSelectedCard(null);
      }
    } catch (err: any) {
      logger.error("api.action_error", err.message || "Unknown error", { 
        player: CONST.c_to_s_interface.PLAYER_KEYS.P1,
        action_type: type 
      });
    }
  };

  const renderCard = useCallback((
    card: any, 
    cw: number, 
    ch: number, 
    isOpp: boolean, 
    isWide = false,
    count = 0
  ) => {
    const container = new PIXI.Container();
    
    const isRest = card?.is_rest === true || card?.location === 'don_rest';
    if (isRest) container.rotation = Math.PI / 2;

    const isBack = card?.is_face_up === false && 
                   card?.location !== 'leader' && 
                   !(!isOpp && card?.location === 'hand');
    
    const attachedDon = card?.attached_don || 0;
    if (attachedDon > 0 && !isBack) {
      for (let i = 0; i < Math.min(attachedDon, 3); i++) {
        const donG = new PIXI.Graphics();
        donG.lineStyle(2, 0x000000);
        donG.beginFill(0xFFFFFF);
        const offset = (i + 1) * 4;
        donG.drawRoundedRect(-cw / 2 + offset, -ch / 2 - offset, cw, ch, 6);
        donG.endFill();
        container.addChild(donG);
      }
    }

    const g = new PIXI.Graphics();
    g.lineStyle(2, COLORS.ZONE_BORDER);
    g.beginFill(isBack ? COLORS.CARD_BACK : COLORS.ZONE_FILL);
    g.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, 6);
    g.endFill();
    container.addChild(g);

    const textRotation = isRest ? -Math.PI / 2 : 0;
    const yDir = isOpp ? -1 : 1;
    const cardName = card?.name || "";
    const isResource = ['DON!!', 'Trash', 'Deck', 'Don!!', 'Life', 'Stage'].includes(cardName);

    if (!isBack) {
      if (card?.power !== undefined) {
        const pTxt = new PIXI.Text(`POWER ${card.power}`, { fontSize: 11, fill: 0xFF0000, fontWeight: 'bold' });
        pTxt.anchor.set(0.5); 
        pTxt.rotation = textRotation;
        if (isRest) {
          pTxt.x = (-ch / 2 - 10) * yDir;
          pTxt.y = 0;
        } else {
          pTxt.x = 0;
          pTxt.y = (-ch / 2 - 10) * yDir;
        }
        container.addChild(pTxt);
      }

      const nameStyle = new PIXI.TextStyle({ fontSize: isResource ? 11 : 9, fontWeight: 'bold', fill: isResource ? 0x000000 : 0x333333 });
      const displayName = truncateText(cardName, nameStyle, isWide ? cw * 2.2 : cw * 1.8);
      const nTxt = new PIXI.Text(displayName, nameStyle);
      nTxt.anchor.set(0.5);
      nTxt.rotation = textRotation;

      if (isResource) {
        nTxt.x = 0;
        nTxt.y = 0;
      } else {
        if (isRest) {
          nTxt.x = (ch / 2 + 2) * yDir;
          nTxt.y = 0;
        } else {
          nTxt.x = 0;
          nTxt.y = (ch / 2 + 2) * yDir;
        }
      }
      container.addChild(nTxt);
    } else {
      const backTxt = new PIXI.Text("ONE\nPIECE", { fontSize: 8, fontWeight: 'bold', fill: 0xFFFFFF, align: 'center' });
      backTxt.anchor.set(0.5);
      backTxt.rotation = textRotation;
      container.addChild(backTxt);
    }

    if (count > 0) {
      const badge = new PIXI.Graphics();
      badge.beginFill(0x000000, 0.8);
      badge.drawCircle(cw / 2 - 10, ch / 2 - 10, 12);
      badge.endFill();
      container.addChild(badge);

      const countTxt = new PIXI.Text(count.toString(), { fontSize: 12, fill: 0xFFFFFF, fontWeight: 'bold' });
      countTxt.anchor.set(0.5);
      countTxt.position.set(cw / 2 - 10, ch / 2 - 10);
      countTxt.rotation = textRotation;
      container.addChild(countTxt);
    }

    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      setSelectedCard({ card, location: card?.location || (isOpp ? 'opponent' : 'player') });
      setIsDetailMode(true);
    });

    return container;
  }, [truncateText]);

  useEffect(() => {
    if (!pixiContainerRef.current) return;
    if (!appRef.current) {
      const app = new PIXI.Application({ background: 0xFFFFFF, resizeTo: window, antialias: true, resolution: window.devicePixelRatio || 1, autoDensity: true });
      appRef.current = app;
      pixiContainerRef.current.appendChild(app.view as any);
    }

    const app = appRef.current;
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;

    const renderScene = () => {
      if (!app.stage || !gameState) return;
      app.stage.removeChildren();
      const { width: W, height: H } = app.screen;
      const coords = calculateCoordinates(W, H);
      const midY = H / 2;

      const bg = new PIXI.Graphics();
      bg.beginFill(COLORS.OPPONENT_BG).drawRect(0, 0, W, midY).endFill();
      bg.beginFill(COLORS.CONTROL_BG).drawRect(0, midY - 40, W, 80).endFill();
      bg.beginFill(COLORS.PLAYER_BG).drawRect(0, midY + 40, W, H - (midY + 40)).endFill();
      app.stage.addChild(bg);

      const renderSide = (p: any, isOpp: boolean) => {
        const side = new PIXI.Container();
        if (isOpp) { side.x = W; side.y = midY - 40; side.rotation = Math.PI; } 
        else { side.y = midY + 40; }
        app.stage.addChild(side);

        const z = p?.zones || {};

        (z.field || []).forEach((c: any, i: number) => {
          const card = renderCard({ ...c, location: 'field' }, coords.CW, coords.CH, isOpp);
          card.x = coords.getFieldX(i, W, coords.CW, z.field.length);
          card.y = coords.getY(1, coords.CH, coords.V_GAP);
          side.addChild(card);
        });

        const r2Y = coords.getY(2, coords.CH, coords.V_GAP);
        const r3Y = coords.getY(3, coords.CH, coords.V_GAP);

        if (p.leader) {
          const ldr = renderCard({ ...p.leader, location: 'leader' }, coords.CW, coords.CH, isOpp, true);
          ldr.x = coords.getLeaderX(W); ldr.y = r2Y;
          side.addChild(ldr);
        }

        const lifeCount = (z.life || []).length;
        const lifeCard = renderCard({ name: 'Life', location: 'life', is_face_up: false }, coords.CW, coords.CH, isOpp, false, lifeCount);
        lifeCard.x = coords.getLifeX(W); lifeCard.y = r2Y;
        side.addChild(lifeCard);

        if (z.stage && z.stage.length > 0) {
          const s = z.stage[0];
          const stageCard = renderCard({ ...s, location: 'stage' }, coords.CW, coords.CH, isOpp);
          stageCard.x = coords.getStageX(W); stageCard.y = r2Y;
          side.addChild(stageCard);
        }

        const deckCount = (z.deck || []).length;
        const deckCard = renderCard({ name: 'Deck', location: 'deck', is_face_up: false }, coords.CW, coords.CH, isOpp, false, deckCount);
        deckCard.x = coords.getDeckX(W); deckCard.y = r2Y;
        side.addChild(deckCard);

        const trashCount = (z.trash || []).length;
        const trashCard = renderCard({ name: 'Trash', location: 'trash' }, coords.CW, coords.CH, isOpp, false, trashCount);
        trashCard.x = coords.getTrashX(W); trashCard.y = r3Y;
        side.addChild(trashCard);

        const donDeckCount = (z.don_deck || []).length;
        const donDeck = renderCard({ name: 'Don!!', location: 'don_deck', is_face_up: false }, coords.CW, coords.CH, isOpp, false, donDeckCount);
        donDeck.x = coords.getDonDeckX(W); donDeck.y = r3Y;
        side.addChild(donDeck);

        const donActiveCount = (z.don_active || []).length;
        const donActive = renderCard({ name: 'Don!!', location: 'don_active' }, coords.CW, coords.CH, isOpp, false, donActiveCount);
        donActive.x = coords.getDonActiveX(W); donActive.y = r3Y;
        side.addChild(donActive);

        const donRestCount = (z.don_rest || []).length;
        const donRest = renderCard({ name: 'Don!!', location: 'don_rest' }, coords.CW, coords.CH, isOpp, false, donRestCount);
        donRest.x = coords.getDonRestX(W); donRest.y = r3Y;
        side.addChild(donRest);

        (z.hand || []).forEach((c: any, i: number) => {
          const card = renderCard({ ...c, location: 'hand' }, coords.CW, coords.CH, isOpp);
          card.x = coords.getHandX(i, W);
          card.y = coords.getY(4, coords.CH, coords.V_GAP);
          side.addChild(card);
        });
      };

      if (gameState.players) {
        renderSide(gameState.players.p2, true);
        renderSide(gameState.players.p1, false);
      }
    };

    renderScene();
  }, [gameState, renderCard, handleAction]);

  return (
    <div ref={pixiContainerRef} className="game-screen">
      {!gameState && !isPending && <button onClick={startGame} className="start-btn">Game Start</button>}
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
