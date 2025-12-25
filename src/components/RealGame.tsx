import { useEffect, useRef, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import type { GameState, CardInstance, LeaderCard, BoardCard } from '../types/game';
import { initialGameResponse } from '../mocks/gameState';
import { LAYOUT, COLORS } from '../constants/layout';
import { calculateCoordinates } from '../utils/layoutEngine';

type DrawTarget = CardInstance | LeaderCard | BoardCard | { name: string; is_face_up?: boolean; is_rest?: boolean; power?: number; cost?: number };

export const RealGame = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const gameState: GameState = initialGameResponse.state;

  const urlParams = new URLSearchParams(window.location.search);
  const observerId = urlParams.get('observerId') || 'p1';
  const opponentId = observerId === 'p1' ? 'p2' : 'p1';

  /**
   * 改良版レンダラー: 右上の枚数カウント用バッジに対応
   */
  const renderCard = useCallback((
    card: DrawTarget, 
    cw: number, 
    ch: number, 
    isOpponent: boolean = false, 
    badgeCount?: number,
    isCountBadge: boolean = false
  ): PIXI.Container => {
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

    const name = 'name' in card ? card.name : '';
    const nameTxt = new PIXI.Text(name ?? '', { fontSize: 9, fill: isBackSide ? 0xFFFFFF : COLORS.TEXT_MAIN, fontWeight: 'bold' });
    nameTxt.anchor.set(0.5); 
    content.addChild(nameTxt);

    if (badgeCount !== undefined) {
      // isCountBadge が true なら右上・黒バッジ、false なら右下・赤バッジ
      const badge = new PIXI.Graphics().beginFill(isCountBadge ? 0x333333 : COLORS.BADGE_BG).drawCircle(0, 0, 10).endFill();
      badge.x = cw / 2 - (isCountBadge ? 0 : 5);
      badge.y = isCountBadge ? -ch / 2 : ch / 2 - 5;
      
      const bTxt = new PIXI.Text(badgeCount.toString(), { fontSize: 10, fill: 0xFFFFFF, fontWeight: 'bold' });
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

    const renderSide = (p: any, isOpp: boolean) => {
      const side = new PIXI.Container();
      isOpp ? (side.x = W, side.y = Y_CTRL_START, side.rotation = Math.PI) : side.y = Y_CTRL_START + LAYOUT.H_CTRL;
      app.stage.addChild(side);

      // Row 1: Field
      (p.zones.field || []).forEach((c: any, i: number) => {
        const card = renderCard(c, CW, CH, isOpp);
        card.x = coords.getFieldX(i, W); card.y = coords.getY(1, CH, V_GAP);
        side.addChild(card);
      });

      // Row 2: 司令部
      const r2Y = coords.getY(2, CH, V_GAP);
      const life = renderCard({ is_face_up: false, name: 'Life' }, CW, CH, isOpp, p.zones.life?.length || 0);
      life.x = coords.getLifeX(W); life.y = r2Y;
      side.addChild(life);

      const ldr = renderCard(p.leader, CW, CH, isOpp);
      ldr.x = coords.getLeaderX(W); ldr.y = r2Y;
      side.addChild(ldr);

      const stg = renderCard(p.zones.stage || { name: 'Stage' }, CW, CH, isOpp);
      stg.x = coords.getStageX(W); stg.y = r2Y;
      side.addChild(stg);

      const deck = renderCard({ is_face_up: false, name: 'Deck' }, CW, CH, isOpp, 40);
      deck.x = coords.getDeckX(W); deck.y = r2Y;
      side.addChild(deck);

      // Row 3: ドン!!バッジ表示
      const r3Y = coords.getY(3, CH, V_GAP);
      const donDk = renderCard({ name: 'Don!!', is_face_up: false }, CW, CH, isOpp, 10);
      donDk.x = coords.getDonDeckX(W); donDk.y = r3Y;
      side.addChild(donDk);

      const donAct = renderCard({ name: 'DON!!' }, CW, CH, isOpp, p.don_active?.length || 0, true);
      donAct.x = coords.getDonActiveX(W); donAct.y = r3Y;
      side.addChild(donAct);

      const donRst = renderCard({ name: 'DON!!', is_rest: true }, CW, CH, isOpp, p.don_rested?.length || 0, true);
      donRst.x = coords.getDonRestX(W); donRst.y = r3Y;
      side.addChild(donRst);

      const trash = renderCard(p.zones.trash?.[0] || { name: 'Trash' }, CW, CH, isOpp);
      trash.x = coords.getTrashX(W); trash.y = r3Y;
      side.addChild(trash);

      // Row 4: Hand
      if (!isOpp) {
        (p.zones.hand || []).forEach((c: any, i: number) => {
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
