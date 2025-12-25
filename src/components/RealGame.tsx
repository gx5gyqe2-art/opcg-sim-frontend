import { useEffect, useRef, useCallback, useState } from 'react';
import * as PIXI from 'pixi.js';
import type { GameState, CardInstance, LeaderCard, BoardCard } from '../types/game';
import { initialGameResponse } from '../mocks/gameState';
import { LAYOUT, COLORS } from '../constants/layout';
import { calculateCoordinates } from '../utils/layoutEngine';
import { useGameAction } from '../hooks/useGameAction';

type DrawTarget = CardInstance | LeaderCard | BoardCard | { 
  name: string; 
  is_face_up?: boolean; 
  is_rest?: boolean; 
  power?: number; 
  cost?: number; 
  attribute?: string; 
  counter?: number; 
  attached_don?: number; 
  uuid?: string;         
};

export const RealGame = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);

  const [gameState, setGameState] = useState<GameState>(initialGameResponse.state as unknown as GameState);

  const urlParams = new URLSearchParams(window.location.search);
  const observerId = urlParams.get('observerId') || 'p1';
  const opponentId = observerId === 'p1' ? 'p2' : 'p1';

  const { sendAction } = useGameAction('test-game-id', observerId, gameState, setGameState);

  const truncateText = (text: string, style: PIXI.TextStyle, maxWidth: number): string => {
    const metrics = PIXI.TextMetrics.measureText(text, style);
    if (metrics.width <= maxWidth) return text;

    let truncated = text;
    while (truncated.length > 0) {
      truncated = truncated.slice(0, -1);
      const check = truncated + '...';
      if (PIXI.TextMetrics.measureText(check, style).width <= maxWidth) {
        return check;
      }
    }
    return '...';
  };

  const renderCard = useCallback((
    card: DrawTarget, 
    cw: number, 
    ch: number, 
    isOpponent: boolean = false, 
    badgeCount?: number,
    isCountBadge: boolean = false,
    isWideName: boolean = false,
    locationType: 'hand' | 'field' | 'other' = 'other' 
  ): PIXI.Container => {
    const container = new PIXI.Container();
    
    container.eventMode = 'static';
    container.cursor = 'pointer';

    container.on('pointertap', () => {
      if (isOpponent) return;

      const cardId = (card as any).uuid; 
      if (!cardId) return;

      if (locationType === 'hand') {
        if (window.confirm("このカードを登場させますか？")) {
          sendAction('PLAY_CARD', { card_id: cardId });
        }
      } else if (locationType === 'field') {
        const action = window.prompt("アクションを選択:\n1: 攻撃\n2: ドン付与\n3: 効果発動");
        if (action === '1') {
          sendAction('ATTACK', { card_id: cardId, target_ids: ['dummy'] });
        } else if (action === '2') {
          sendAction('ATTACH_DON', { target_ids: [cardId], extra: { count: 1 } });
        } else if (action === '3') {
          sendAction('ACTIVATE', { card_id: cardId });
        }
      }
    });
    
    const isRest = 'is_rest' in card && card.is_rest;
    if (isRest) {
      container.rotation = Math.PI / 2;
    }

    if (!isOpponent && 'attached_don' in card && (card.attached_don || 0) > 0) {
      const donBg = new PIXI.Graphics();
      donBg.lineStyle(1, 0x666666);
      donBg.beginFill(COLORS.CARD_BACK); 
      donBg.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, 6);
      donBg.endFill();
      donBg.x = 6;
      donBg.y = 6;
      container.addChild(donBg);
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

      if (power !== undefined) {
        const powerTxt = new PIXI.Text(`POWER ${power}`, { 
          fontSize: 11, fill: 0xFF0000, fontWeight: 'bold', align: 'center'
        });
        powerTxt.anchor.set(0.5); 
        
        if (isRest) {
          powerTxt.x = (-ch / 2 - 10) * yDir; 
          powerTxt.y = 0;
        } else {
          powerTxt.x = 0;
          powerTxt.y = (-ch / 2 - 10) * yDir;
        }
        powerTxt.rotation = textRotation + (isOpponent ? Math.PI : 0);
        container.addChild(powerTxt);
      }

      const nameStr = name || '';
      const isResource = nameStr === 'DON!!' || nameStr === 'Trash' || nameStr === 'Deck';
      
      const nameStyle = new PIXI.TextStyle({ 
        fontSize: isResource ? 11 : 9,
        fill: isResource ? 0x000000 : 0x333333, 
        fontWeight: 'bold',
        align: 'center',
      });

      const maxNameWidth = isWideName ? cw * 2.2 : cw * 1.8;
      const displayName = truncateText(nameStr, nameStyle, maxNameWidth);

      const nameTxt = new PIXI.Text(displayName, nameStyle);
      nameTxt.anchor.set(0.5, isResource ? 0.5 : 0);
      
      const nameOffset = 2; 

      if (isRest) {
        nameTxt.x = (isResource ? 0 : ch / 2 + nameOffset) * yDir;
        nameTxt.y = 0;
      } else {
        nameTxt.x = 0;
        nameTxt.y = (isResource ? 0 : ch / 2 + nameOffset) * yDir;
      }
      
      nameTxt.rotation = textRotation + (isOpponent ? Math.PI : 0);
      container.addChild(nameTxt);

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

      if (attribute && power !== undefined) {
        const attrTxt = new PIXI.Text(attribute, { fontSize: 7, fill: 0x666666 });
        attrTxt.anchor.set(1, 0);
        attrTxt.x = cw / 2 - 4;
        attrTxt.y = -ch / 2 + 4;
        content.addChild(attrTxt);
      }

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

    if (badgeCount !== undefined) {
      const badgeR = 9;
      const margin = 2; 
      const offset = badgeR + margin;

      const badge = new PIXI.Graphics().beginFill(isCountBadge ? 0x333333 : COLORS.BADGE_BG).drawCircle(0, 0, badgeR).endFill();
      
      const localW = cw / 2 - offset;
      const localH = ch / 2 - offset;

      let bx = 0, by = 0;

      if (isRest) {
         const restX = isCountBadge ? -localW : localW;
         const restY = -localH; 
         bx = restX * yDir;
         by = restY * yDir;
      } else {
         const normX = localW;
         const normY = isCountBadge ? -localH : localH;
         bx = normX * yDir;
         by = normY * yDir;
      }
      
      badge.x = bx;
      badge.y = by;
      
      const bTxt = new PIXI.Text(badgeCount.toString(), { fontSize: 9, fill: 0xFFFFFF, fontWeight: 'bold' });
      bTxt.anchor.set(0.5);

      badge.rotation = -container.rotation + (isOpponent ? Math.PI : 0);
      
      badge.addChild(bTxt);
      container.addChild(badge);
    }

    return container;
  }, [sendAction]);

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

      const fields = p.zones.field || [];
      fields.forEach((c: any, i: number) => {
        const card = renderCard(c, CW, CH, isOpp, undefined, false, false, 'field');
        card.x = coords.getFieldX(i, W, CW, fields.length); 
        card.y = coords.getY(1, CH, V_GAP);
        side.addChild(card);
      });

      const r2Y = coords.getY(2, CH, V_GAP);
      const life = renderCard({ is_face_up: false, name: 'Life' }, CW, CH, isOpp, p.zones.life?.length || 0, false, false, 'other');
      life.x = coords.getLifeX(W); life.y = r2Y;
      side.addChild(life);

      const ldr = renderCard(p.leader, CW, CH, isOpp, undefined, false, true, 'field');
      ldr.x = coords.getLeaderX(W); ldr.y = r2Y;
      side.addChild(ldr);

      if (p.zones.stage) {
        const stg = renderCard(p.zones.stage, CW, CH, isOpp, undefined, false, true, 'field');
        stg.x = coords.getStageX(W); stg.y = r2Y;
        side.addChild(stg);
      }

      const deck = renderCard({ is_face_up: false, name: 'Deck' }, CW, CH, isOpp, 40, false, false, 'other');
      deck.x = coords.getDeckX(W); deck.y = r2Y;
      side.addChild(deck);

      const r3Y = coords.getY(3, CH, V_GAP);
      const donDk = renderCard({ name: 'Don!!', is_face_up: false }, CW, CH, isOpp, 10, false, false, 'other');
      donDk.x = coords.getDonDeckX(W); donDk.y = r3Y;
      side.addChild(donDk);

      const donAct = renderCard({ name: 'DON!!' }, CW, CH, isOpp, p.don_active?.length || 0, true, false, 'other');
      donAct.x = coords.getDonActiveX(W); donAct.y = r3Y;
      side.addChild(donAct);

      const donRst = renderCard({ name: 'DON!!', is_rest: true }, CW, CH, isOpp, p.don_rested?.length || 0, true, false, 'other');
      donRst.x = coords.getDonRestX(W); donRst.y = r3Y;
      side.addChild(donRst);

      const tCount = p.zones.trash?.length || 0;
      const trash = renderCard(p.zones.trash?.[tCount - 1] || { name: 'Trash' }, CW, CH, isOpp, tCount, false, false, 'other');
      trash.x = coords.getTrashX(W); trash.y = r3Y;
      side.addChild(trash);

      if (!isOpp) {
        (p.zones.hand || []).forEach((c: any, i: number) => {
          const card = renderCard(c, CW, CH, isOpp, undefined, false, false, 'hand');
          card.x = coords.getHandX(i, W); card.y = coords.getY(4, CH, V_GAP);
          side.addChild(card);
        });
      }
    };

    renderSide(state.players[opponentId], true);
    renderSide(state.players[observerId], false);
  }, [observerId, opponentId, renderCard]);

  // 1. Pixi App Initialization (Once)
  useEffect(() => {
    if (!containerRef.current || appRef.current) return;

    const app = new PIXI.Application({
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: 0xFFFFFF,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: true,
    });

    containerRef.current.appendChild(app.view as HTMLCanvasElement);
    appRef.current = app;

    const handleResize = () => {
      app.renderer.resize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      app.destroy(true);
      appRef.current = null;
    };
  }, []);

  // 2. Draw Loop (On State Change)
  useEffect(() => {
    if (!appRef.current) return;
    drawLayout(gameState);
  }, [gameState, drawLayout]);

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
