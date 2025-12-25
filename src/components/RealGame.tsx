import { useEffect, useRef, useCallback } from 'react';
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

  const renderCard = useCallback((card: CardInstance | Partial<CardInstance>, cw: number, ch: number, isOpponent: boolean = false, badgeCount?: number) => {
    const container = new PIXI.Container();
    container.eventMode = 'static';
    container.cursor = 'pointer';
    
    // レスト状態の回転 (ドン!!等にも適用)
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
    if (isOpponent) content.rotation = Math.PI; // 相手側文字反転
    container.addChild(content);

    if (!isBackSide) {
      const cardData = card as Partial<LeaderCard & BoardCard>;
      const nameTxt = new PIXI.Text(cardData.name ?? '', { fontSize: 10, fill: COLORS.TEXT_MAIN, fontWeight: 'bold' });
      nameTxt.anchor.set(0.5, 0); 
      nameTxt.y = ch / 2 - 18; 
      content.addChild(nameTxt);

      if (cardData.power) {
        const powerTxt = new PIXI.Text(cardData.power.toString(), { fontSize: 14, fill: 0x000000, fontWeight: '900' });
        powerTxt.anchor.set(0.5); 
        powerTxt.y = -ch / 4;
        content.addChild(powerTxt);
      }
    } else {
      const backTxt = new PIXI.Text("ONE\nPIECE", { fontSize: 10, fontWeight: 'bold', fill: 0xFFFFFF, align: 'center' });
      backTxt.anchor.set(0.5); 
      content.addChild(backTxt);
    }

    // 枚数バッジ (ライフ・デッキ等)
    if (badgeCount !== undefined) {
      const badge = new PIXI.Graphics().beginFill(COLORS.BADGE_BG).drawCircle(0, 0, 8).endFill();
      badge.x = cw / 2 - 5;
      badge.y = ch / 2 - 5;
      const bTxt = new PIXI.Text(badgeCount.toString(), { fontSize: 9, fill: COLORS.BADGE_TEXT, fontWeight: 'bold' });
      bTxt.anchor.set(0.5);
      badge.addChild(bTxt);
      container.addChild(badge);
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

    const renderSide = (sidePlayer: any, isOpp: boolean) => {
      const side = new PIXI.Container();
      if (isOpp) {
        side.x = W; side.y = Y_CTRL_START; side.rotation = Math.PI; 
      } else {
        side.y = Y_CTRL_START + LAYOUT.H_CTRL;
      }
      app.stage.addChild(side);

      // --- Row 1: 戦場 (Field) ---
      sidePlayer.zones.field.forEach((c: any, i: number) => {
        const card = renderCard(c, CW, CH, isOpp);
        card.x = coords.getFieldX(i, W); card.y = coords.getY(1, CH, V_GAP);
        side.addChild(card);
      });

      // --- Row 2: 司令部 (Life, Leader, Stage, Deck) ---
      const row2Y = coords.getY(2, CH, V_GAP);
      // Life
      const lifeCard = renderCard({ is_face_up: false } as any, CW, CH, isOpp, sidePlayer.zones.life.length);
      lifeCard.x = coords.getLifeX(W); lifeCard.y = row2Y;
      side.addChild(lifeCard);
      // Leader
      const ldr = renderCard(sidePlayer.leader, CW, CH, isOpp);
      ldr.x = coords.getLeaderX(W); ldr.y = row2Y;
      side.addChild(ldr);
      // Stage
      const stgData = sidePlayer.zones.stage || { name: 'Stage' };
      const stg = renderCard(stgData, CW, CH, isOpp);
      stg.x = coords.getStageX(W); stg.y = row2Y;
      side.addChild(stg);
      // Deck
      const deckCard = renderCard({ is_face_up: false } as any, CW, CH, isOpp, sidePlayer.zones.deck?.length || 0);
      deckCard.x = coords.getDeckX(W); deckCard.y = row2Y;
      side.addChild(deckCard);

      // --- Row 3: コスト・墓地 (Don!!, Trash) ---
      const row3Y = coords.getY(3, CH, V_GAP);
      // Don!! Deck
      const donDeck = renderCard({ name: 'Don!!', is_face_up: false } as any, CW, CH, isOpp, sidePlayer.zones.don_deck?.length || 0);
      donDeck.x = coords.getDonDeckX(W); donDeck.y = row3Y;
      side.addChild(donDeck);
      // Active Don!!
      sidePlayer.zones.don_active.forEach((_: any, i: number) => {
        const don = renderCard({ name: 'DON!!' }, CW * 0.7, CH * 0.7, isOpp);
        don.x = coords.getDonDeckX(W) + CW * 0.8 + (i * 10); don.y = row3Y;
        side.addChild(don);
      });
      // Trash
      const trashCard = renderCard(sidePlayer.zones.trash?.[0] || { name: 'Trash' }, CW, CH, isOpp);
      trashCard.x = coords.getTrashX(W); trashCard.y = row3Y;
      side.addChild(trashCard);

      // --- Row 4: 手札 (自分のみ) ---
      if (!isOpp) {
        sidePlayer.zones.hand.forEach((c: any, i: number) => {
          const card = renderCard(c, CW, CH);
          card.x = coords.getHandX(i, W); card.y = coords.getY(4, CH, V_GAP);
          side.addChild(card);
        });
      }
    };

    renderSide(state.players[opponentId], true);
    renderSide(state.players[observerId], false);

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
        <div>TURN: {gameState.turn_info.turn_count} ({gameState.turn_info.current_phase})</div>
      </div>
    </div>
  );
};
