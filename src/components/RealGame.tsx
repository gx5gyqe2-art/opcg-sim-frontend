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
    
    const isRest = 'is_rest' in card && card.is_rest;
    if (isRest) {
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

    const textRotation = isRest ? -Math.PI / 2 : 0;
    const yDir = isOpponent ? -1 : 1;

    if (!isBackSide) {
      const name = 'name' in card ? card.name : '';
      const power = 'power' in card ? card.power : undefined;
      const cost = 'cost' in card ? card.cost : undefined;
      const attribute = 'attribute' in card ? (card.attribute as string) : undefined;
      const counter = 'counter' in card ? card.counter : undefined;

      // 1. パワー (フォントサイズ微調整: 12 -> 11)
      if (power !== undefined) {
        const powerTxt = new PIXI.Text(`POWER ${power}`, { 
          fontSize: 11, fill: 0xFF0000, fontWeight: 'bold', align: 'center'
        });
        powerTxt.anchor.set(0.5); 
        
        if (isRest) {
          powerTxt.x = (-ch / 2 - 10) * yDir; // 余白も少し詰める
          powerTxt.y = 0;
        } else {
          powerTxt.x = 0;
          powerTxt.y = (-ch / 2 - 10) * yDir;
        }
        
        powerTxt.rotation = textRotation + (isOpponent ? Math.PI : 0);
        container.addChild(powerTxt);
      }

      // 2. 名前 (フォントサイズ微調整: 10/12 -> 9/11)
      const nameStr = name || '';
      const isResource = nameStr === 'DON!!' || nameStr === 'Trash' || nameStr === 'Deck';
      
      const nameTxt = new PIXI.Text(nameStr, { 
        fontSize: isResource ? 11 : 9,
        fill: isResource ? 0x000000 : 0x333333, 
        fontWeight: 'bold',
        align: 'center',
        wordWrap: true,
        wordWrapWidth: isRest ? ch * 0.9 : cw * 1.5
      });
      nameTxt.anchor.set(0.5, isResource ? 0.5 : 0);
      
      const nameOffset = 8; // 余白調整
      if (isRest) {
        nameTxt.x = (isResource ? 0 : ch / 2 + nameOffset) * yDir;
        nameTxt.y = 0;
      } else {
        nameTxt.x = 0;
        nameTxt.y = (isResource ? 0 : ch / 2 + nameOffset) * yDir;
      }
      
      nameTxt.rotation = textRotation + (isOpponent ? Math.PI : 0);
      container.addChild(nameTxt);

      // 3. カウンター (フォントサイズ微調整: 9 -> 8)
      if (counter !== undefined) {
        const counterTxt = new PIXI.Text(`+${counter}`, {
          fontSize: 8, fill: 0x000000, stroke: 0xFFFFFF, strokeThickness: 2, fontWeight: 'bold'
        });
        counterTxt.anchor.set(0.5);
        counterTxt.x = -cw / 2 + 8;
        counterTxt.y = 0;
        counterTxt.rotation = -Math.PI / 2;
        content.addChild(counterTxt);
      }

      // 4. 属性 (フォントサイズ微調整: 8 -> 7)
      if (attribute && power !== undefined) {
        const attrTxt = new PIXI.Text(attribute, { fontSize: 7, fill: 0x666666 });
        attrTxt.anchor.set(1, 0);
        attrTxt.x = cw / 2 - 4;
        attrTxt.y = -ch / 2 + 4;
        content.addChild(attrTxt);
      }

      // 5. コスト (フォントサイズ微調整: 9 -> 8)
      if (cost !== undefined) {
        const costBg = new PIXI.Graphics().beginFill(0x333333).drawCircle(0, 0, 7).endFill();
        costBg.x = -cw / 2 + 10;
        costBg.y = -ch / 2 + 10;
        const costTxt = new PIXI.Text(cost.toString(), { fontSize: 8, fill: 0xFFFFFF, fontWeight: 'bold' });
        costTxt.anchor.set(0.5);
        costBg.addChild(costTxt);
        content.addChild(costBg);
      }
      
    } else {
      const backTxt = new PIXI.Text("ONE\nPIECE", { fontSize: 8, fontWeight: 'bold', fill: 0xFFFFFF, align: 'center' });
      backTxt.anchor.set(0.5);
      backTxt.rotation = textRotation; 
      container.addChild(backTxt); 
    }

    // 枚数バッジ (フォントサイズ微調整: 10 -> 9)
    if (badgeCount !== undefined) {
      const badge = new PIXI.Graphics().beginFill(isCountBadge ? 0x333333 : COLORS.BADGE_BG).drawCircle(0, 0, 9).endFill();
      
      let bx = 0, by = 0;
      if (isRest) {
         bx = (ch / 2) * yDir;
         by = (isCountBadge ? -cw / 2 : cw / 2) * yDir;
      } else {
         bx = (cw / 2) * yDir;
         by = (isCountBadge ? -ch / 2 : ch / 2) * yDir;
      }
      
      badge.x = bx;
      badge.y = by;
      
      const bTxt = new PIXI.Text(badgeCount.toString(), { fontSize: 9, fill: 0xFFFFFF, fontWeight: 'bold' });
      bTxt.anchor.set(0.5);

      badge.rotation = textRotation + (isOpponent ? Math.PI : 0);
      
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

      // Row 3: ドン!! & トラッシュ
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

      const tCount = p.zones.trash?.length || 0;
      const trash = renderCard(p.zones.trash?.[tCount - 1] || { name: 'Trash' }, CW, CH, isOpp, tCount);
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
