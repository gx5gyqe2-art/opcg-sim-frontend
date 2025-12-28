import { useEffect, useRef, useCallback, useState } from 'react';
import * as PIXI from 'pixi.js';
import { COLORS } from '../layout/layout.constants';
import { calculateCoordinates } from '../layout/layoutEngine';
import { useGameAction } from '../game/actions';
import { CardDetailSheet } from '../ui/CardDetailSheet';
import CONST from '../../shared_constants.json';
import { apiClient } from '../api/client';

export const RealGame = () => {
  const pixiContainerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const [gameState, setGameState] = useState<any>(null);
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [isDetailMode, setIsDetailMode] = useState(false);

  const { startGame, isPending } = useGameAction(CONST.PLAYER_KEYS.P1, setGameState);

  const sendDebugLog = async (action: string, msg: string, payload: any = {}) => {
    try {
      await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: "FE_DEBUG",
          player: CONST.c_to_s_interface.PLAYER_KEYS.P1,
          action: action,
          level: "debug",
          sessionId: gameState?.game_id || "no_session",
          msg: msg,
          payload: payload,
          timestamp: new Date().toISOString()
        })
      });
    } catch (e) {
      console.warn("Debug logger failed", e);
    }
  };

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
        await sendDebugLog("api.receive_update_success", `Action ${type} processed`);
      }
    } catch (err: any) {
      console.error("Action failed:", err);
      await sendDebugLog("api.action_error", err.message || "Unknown error");
    }
  };


  const renderCard = useCallback((
    card: any, 
    cw: number, 
    ch: number, 
    isOpp: boolean, 
    badgeCount?: number,
    isWide = false
  ) => {
    const container = new PIXI.Container();
    const isRest = card?.is_rest === true;
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
    const isResource = cardName === 'DON!!' || cardName === 'Trash' || cardName === 'Deck' || cardName === 'Don!!';

    if (!isBack) {
      if (card?.power !== undefined) {
        const pTxt = new PIXI.Text(`POWER ${card.power}`, { fontSize: 11, fill: 0xFF0000, fontWeight: 'bold' });
        pTxt.anchor.set(0.5); 
        pTxt.x = 0; pTxt.y = isRest ? 0 : (-ch / 2 - 10) * yDir;
        if (isRest) pTxt.x = (-ch / 2 - 10) * yDir;
        pTxt.rotation = textRotation;
        container.addChild(pTxt);
      }

      const nameStyle = new PIXI.TextStyle({ fontSize: isResource ? 11 : 9, fontWeight: 'bold', fill: isResource ? 0x000000 : 0x333333 });
      const displayName = truncateText(cardName, nameStyle, isWide ? cw * 2.2 : cw * 1.8);
      const nTxt = new PIXI.Text(displayName, nameStyle);
      nTxt.anchor.set(0.5, isResource ? 0.5 : 0);
      nTxt.x = 0; nTxt.y = isRest ? 0 : (ch / 2 + 2) * yDir;
      if (isRest) nTxt.x = (isResource ? 0 : ch / 2 + 2) * yDir;
      nTxt.rotation = textRotation;
      container.addChild(nTxt);

      if (card?.counter !== undefined && card.counter > 0) {
        const cTxt = new PIXI.Text(`+${card.counter}`, { fontSize: 8, fill: 0x000000, stroke: 0xFFFFFF, strokeThickness: 2, fontWeight: 'bold' });
        cTxt.anchor.set(0.5); cTxt.x = -cw / 2 + 8; cTxt.y = 0; cTxt.rotation = -Math.PI / 2;
        container.addChild(cTxt);
      }

      if (card?.cost !== undefined) {
        const cBg = new PIXI.Graphics().beginFill(0x333333).drawCircle(-cw / 2 + 10, -ch / 2 + 10, 7).endFill();
        const cTxt = new PIXI.Text(card.cost.toString(), { fontSize: 8, fill: 0xFFFFFF, fontWeight: 'bold' });
        cTxt.anchor.set(0.5); cTxt.position.set(-cw / 2 + 10, -ch / 2 + 10);
        container.addChild(cBg, cTxt);
      }
      
      if (card?.attribute && card?.power !== undefined) {
        let attrColor = 0x666666;
        if (card.attribute === '斬') attrColor = 0xc0392b;
        if (card.attribute === '打') attrColor = 0x2980b9;
        const aTxt = new PIXI.Text(card.attribute, { fontSize: 7, fill: attrColor, fontWeight: 'bold' });
        aTxt.anchor.set(1, 0); aTxt.x = cw / 2 - 4; aTxt.y = -ch / 2 + 4;
        container.addChild(aTxt);
      }
    } else {
      const backTxt = new PIXI.Text("ONE\nPIECE", { fontSize: 8, fontWeight: 'bold', fill: 0xFFFFFF, align: 'center' });
      backTxt.anchor.set(0.5); backTxt.rotation = textRotation;
      container.addChild(backTxt);
    }

    if (badgeCount !== undefined && (badgeCount > 0 || isResource)) {
      const bG = new PIXI.Graphics().beginFill(0xFF0000).drawCircle(0, 0, 9).endFill();
      const bT = new PIXI.Text(badgeCount.toString(), { fontSize: 9, fill: 0xFFFFFF, fontWeight: 'bold' });
      bT.anchor.set(0.5);
      if (isRest) { bG.x = (cw / 2 - 9) * yDir; bG.y = (ch / 2 - 9) * yDir; } 
      else { bG.x = cw / 2 - 9; bG.y = ch / 2 - 9; }
      bG.addChild(bT); container.addChild(bG);
    }

    container.eventMode = 'static';
    container.cursor = 'pointer';

    container.on('pointerdown', (e) => {
      e.stopPropagation();
      sendDebugLog("debug.pixi_click", `Clicked: ${card?.name}`, { uuid: card?.uuid, location: card?.location || 'not_set' });
      setSelectedCard({ card, location: card?.location || (isOpp ? 'opponent' : 'player') });
      setIsDetailMode(true);
    });

    return container;
  }, [truncateText, sendDebugLog]);

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
      if (!app.stage) return;
      app.stage.removeChildren();
      if (!gameState) return;
      const { width: W, height: H } = app.screen;
      const coords = calculateCoordinates(W, H);
      const midY = H / 2;

      const bg = new PIXI.Graphics();
      bg.beginFill(COLORS.OPPONENT_BG).drawRect(0, 0, W, midY).endFill();
      bg.beginFill(COLORS.CONTROL_BG).drawRect(0, midY - 40, W, 80).endFill();
      bg.beginFill(COLORS.PLAYER_BG).drawRect(0, midY + 40, W, H - (midY + 40)).endFill();
      app.stage.addChild(bg);

      const turnEndBtn = new PIXI.Graphics().beginFill(0x333333).drawRoundedRect(W - 110, midY - 20, 100, 40, 8).endFill();
      turnEndBtn.eventMode = 'static';
      turnEndBtn.cursor = 'pointer';
      turnEndBtn.on('pointerdown', () => handleAction(CONST.c_to_s_interface.GAME_ACTIONS.TYPES.TURN_END));
      const btnTxt = new PIXI.Text("TURN END", { fontSize: 14, fill: 0xFFFFFF, fontWeight: 'bold' });
      btnTxt.anchor.set(0.5); btnTxt.position.set(W - 60, midY);
      turnEndBtn.addChild(btnTxt);
      app.stage.addChild(turnEndBtn);

      const renderSide = (p: any, isOpp: boolean) => {
        const side = new PIXI.Container();
        if (isOpp) { side.x = W; side.y = midY - 40; side.rotation = Math.PI; } 
        else { side.y = midY + 40; }
        app.stage.addChild(side);

        (p?.zones?.field || []).forEach((c: any, i: number) => {
          const card = renderCard({ ...c, location: 'field' }, coords.CW, coords.CH, isOpp);
          card.x = coords.getFieldX(i, W, coords.CW, p.zones.field.length);
          card.y = coords.getY(1, coords.CH, coords.V_GAP);
          side.addChild(card);
        });

        const r2Y = coords.getY(2, coords.CH, coords.V_GAP);
        if (p?.leader) {
          const ldr = renderCard({ ...p.leader, location: 'leader' }, coords.CW, coords.CH, isOpp, undefined, true);
          ldr.x = coords.getLeaderX(W); ldr.y = r2Y;
          side.addChild(ldr);
        }

        const life = renderCard({ name: 'Life', is_face_up: false, location: 'life' }, coords.CW, coords.CH, isOpp, p?.zones?.life?.length);
        life.x = coords.getLifeX(W); life.y = r2Y;
        side.addChild(life);

        const deck = renderCard({ name: 'Deck', is_face_up: false, location: 'deck' }, coords.CW, coords.CH, isOpp, 40);
        deck.x = coords.getDeckX(W); deck.y = r2Y;
        side.addChild(deck);

        const r3Y = coords.getY(3, coords.CH, coords.V_GAP);
        const donDk = renderCard({ name: 'Don!!', is_face_up: false, location: 'don_deck' }, coords.CW, coords.CH, isOpp, 10);
        donDk.x = coords.getDonDeckX(W); donDk.y = r3Y;
        side.addChild(donDk);

        const donAct = renderCard({ name: 'DON!!', location: 'don_active' }, coords.CW, coords.CH, isOpp, p?.don_active?.length);
        donAct.x = coords.getDonActiveX(W); donAct.y = r3Y;
        side.addChild(donAct);

        const donRst = renderCard({ name: 'DON!!', is_rest: true, location: 'don_rest' }, coords.CW, coords.CH, isOpp, p?.don_rested?.length);
        donRst.x = coords.getDonRestX(W); donRst.y = r3Y;
        side.addChild(donRst);

        const trash = renderCard({ name: 'Trash', location: 'trash' }, coords.CW, coords.CH, isOpp, (p?.zones?.trash || []).length);
        trash.x = coords.getTrashX(W); trash.y = r3Y;
        side.addChild(trash);

        (p?.zones?.hand || []).forEach((c: any, i: number) => {
          const card = renderCard({ ...c, location: 'hand' }, coords.CW, coords.CH, isOpp);
          card.x = coords.getHandX(i, W);
          card.y = coords.getY(4, coords.CH, coords.V_GAP);
          side.addChild(card);
        });
      };

      if (gameState?.players) {
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

