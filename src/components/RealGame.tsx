import React, { useEffect, useRef, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import type { GameState, CardInstance, LeaderCard, BoardCard } from '../types/game';
import { initialGameResponse } from '../mocks/gameState';
import { LAYOUT, COLORS } from '../constants/layout';
import { calculateCoordinates } from '../utils/layoutEngine';

export const RealGame = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const gameState: GameState = initialGameResponse.state;

  const urlParams = new URLSearchParams(window.location.search);
  const observerId = urlParams.get('observerId') || 'p1';
  const opponentId = observerId === 'p1' ? 'p2' : 'p1';

  const renderCard = useCallback((card: CardInstance, cw: number, ch: number, isOpponent: boolean = false) => {
    const container = new PIXI.Container();
    container.eventMode = 'static';
    container.cursor = 'pointer';
    
    if ('is_rest' in card && card.is_rest) {
      container.rotation = Math.PI / 2;
    }

    const isBackSide = 'is_face_up' in card ? card.is_face_up === false : false;

    const g = new PIXI.Graphics();
    g.lineStyle(2, COLORS.ZONE_BORDER);
    g.beginFill(isBackSide ? COLORS.CARD_BACK : COLORS.ZONE_FILL);
    g.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, 6);
    g.endFill();
    container.addChild(g);

    const content = new PIXI.Container();
    if (isOpponent) content.rotation = Math.PI;
    container.addChild(content);

    if (!isBackSide) {
      const cardData = card as Partial<LeaderCard & BoardCard>;
      const nameTxt = new PIXI.Text(cardData.name ?? 'Unknown', { fontSize: 10, fill: COLORS.TEXT_MAIN, fontWeight: 'bold' });
      nameTxt.anchor.set(0.5, 0); 
      nameTxt.y = ch / 2 - 18; 
      content.addChild(nameTxt);

      const powerTxt = new PIXI.Text(cardData.power?.toString() ?? '0', { fontSize: 14, fill: 0x000000, fontWeight: '900' });
      powerTxt.anchor.set(0.5); 
      powerTxt.y = -ch / 4;
      content.addChild(powerTxt);

      if ('attribute' in card && card.attribute) {
        const attrTxt = new PIXI.Text(card.attribute, { fontSize: 8, fill: 0x666666 });
        attrTxt.anchor.set(1, 0);
        attrTxt.x = cw / 2 - 5;
        attrTxt.y = -ch / 2 + 5;
        content.addChild(attrTxt);
      }

      if ('cost' in card && card.cost !== undefined) {
        const costTxt = new PIXI.Text(card.cost.toString(), { fontSize: 12, fill: 0xFFFFFF });
        const costBg = new PIXI.Graphics().beginFill(0x333333).drawCircle(0, 0, 9).endFill();
        costBg.x = -cw / 2 + 10;
        costBg.y = -ch / 2 + 10;
        costTxt.anchor.set(0.5);
        costBg.addChild(costTxt);
        content.addChild(costBg);
      }
    } else {
      const backTxt = new PIXI.Text("ONE\nPIECE", { fontSize: 12, fontWeight: 'bold', fill: 0xFFFFFF, align: 'center' });
      backTxt.anchor.set(0.5); 
      content.addChild(backTxt);
    }
    return container;
  }, []);

  const drawLayout = useCallback((state: GameState) => {
    const app = appRef.current;
    if (!app) return;
    app.stage.removeChildren();

    const W = app.renderer.width / app.renderer.resolution;
    const H = app.renderer.height / app.renderer.resolution;
    const coords = calculateCoordinates(W, H);
    const { CH, CW, V_GAP, Y_CTRL_START } = coords;

    const bg = new PIXI.Graphics();
    bg.beginFill(COLORS.OPPONENT_BG).drawRect(0, 0, W, Y_CTRL_START).endFill();
    bg.beginFill(COLORS.CONTROL_BG).drawRect(0, Y_CTRL_START, W, LAYOUT.H_CTRL).endFill();
    bg.beginFill(COLORS.PLAYER_BG).drawRect(0, Y_CTRL_START + LAYOUT.H_CTRL, W, H).endFill();
    app.stage.addChild(bg);

    const player = state.players[observerId];
    const opponent = state.players[opponentId];

    // --- 🔴 相手側 (oSide) ---
    const oSide = new PIXI.Container();
    oSide.x = W; oSide.y = Y_CTRL_START; oSide.rotation = Math.PI; 
    app.stage.addChild(oSide);

    opponent.zones.field.forEach((c, i) => {
      const card = renderCard(c, CW, CH, true);
      // 修正: 第3引数に CW を追加
      card.x = coords.getFieldX(i, W, CW); 
      card.y = coords.getY(1.0, CH, V_GAP);
      oSide.addChild(card);
    });
    
    const oLeader = renderCard(opponent.leader, CW, CH, true);
    oLeader.x = coords.getLeaderX(W); 
    oLeader.y = coords.getY(2.0, CH, V_GAP);
    oSide.addChild(oLeader);

    // --- 🔵 自分側 (pSide) ---
    const pSide = new PIXI.Container();
    pSide.y = Y_CTRL_START + LAYOUT.H_CTRL;
    app.stage.addChild(pSide);

    player.zones.field.forEach((c, i) => {
      const card = renderCard(c, CW, CH);
      // 修正: 第3引数に CW を追加
      card.x = coords.getFieldX(i, W, CW); 
      card.y = coords.getY(2.0, CH, V_GAP);
      pSide.addChild(card);
    });

    const pLeader = renderCard(player.leader, CW, CH);
    pLeader.x = coords.getLeaderX(W); 
    pLeader.y = coords.getY(1.0, CH, V_GAP);
    pSide.addChild(pLeader);

    player.zones.hand.forEach((c, i) => {
      const handCW = CW * 0.8;
      const handCH = CH * 0.8;
      const card = renderCard(c, handCW, handCH);
      // 修正: 第3引数に handCW を追加
      card.x = coords.getHandX(i, W, handCW); 
      card.y = coords.getY(3.8, CH, V_GAP);
      pSide.addChild(card);
    });

  }, [observerId, opponentId, renderCard]);

  useEffect(() => {
    if (!containerRef.current || appRef.current) return;
    const app = new PIXI.Application({
      width: window.innerWidth, height: window.innerHeight,
      backgroundColor: 0xFFFFFF, resolution: window.devicePixelRatio || 1,
      autoDensity: true, antialias: true,
    });
    containerRef.current.appendChild(app.view as HTMLCanvasElement);
    appRef.current = app;
    drawLayout(gameState);

    const handleResize = () => {
      app.renderer.resize(window.innerWidth, window.innerHeight);
      drawLayout(gameState);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      app.destroy(true);
    };
  }, [drawLayout, gameState]);

  return (
    <div style={{ position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100vw', height: '100vh' }} />
      <div style={{
        position: 'absolute', top: 40, left: 5, background: 'rgba(0,0,0,0.7)',
        color: '#fff', padding: '4px 8px', fontSize: '10px', borderRadius: '4px', pointerEvents: 'none'
      }}>
        <div>LDR: {gameState.players[observerId].leader.name}</div>
        <div>FIELD: {gameState.players[observerId].zones.field.length} cards</div>
        <div>TURN: {gameState.turn_info.turn_count} ({gameState.turn_info.current_phase})</div>
      </div>
    </div>
  );
};
