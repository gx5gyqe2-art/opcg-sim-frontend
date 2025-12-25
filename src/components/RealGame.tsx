import { useEffect, useRef, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import type { GameState, CardInstance, LeaderCard, BoardCard, HiddenCard } from '../types/game';
import { initialGameResponse } from '../mocks/gameState';

const MARGIN_TOP = 50;
const MARGIN_BOTTOM = 40;
const H_CTRL = 60;
const COLORS = {
  OPPONENT_BG: 0xFFEEEE,
  CONTROL_BG:  0xF0F0F0,
  PLAYER_BG:   0xE6F7FF,
  ZONE_BORDER: 0x999999,
  ZONE_FILL:   0xFFFFFF,
  CARD_BACK:   0xDDDDDD,
  TEXT_MAIN:   0x333333,
  BADGE_BG:    0xFF0000,
  BADGE_TEXT:  0xFFFFFF,
};

export const RealGame = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const [gameState, setGameState] = useState<GameState>(initialGameResponse.state);

  const urlParams = new URLSearchParams(window.location.search);
  const observerId = urlParams.get('observerId') || 'p1';
  const opponentId = observerId === 'p1' ? 'p2' : 'p1';

  const getX = useCallback((ratio: number, width: number) => width * ratio, []);
  const getY = useCallback((rowIdx: number, cardHeight: number, gap: number) => (rowIdx - 0.5) * (cardHeight + gap), []);

  const renderCard = (card: CardInstance, cw: number, ch: number, isOpponent: boolean = false) => {
    const container = new PIXI.Container();
    
    // 型ガード: is_restプロパティの存在チェック
    if ('is_rest' in card && card.is_rest) {
      container.rotation = Math.PI / 2;
    }

    const g = new PIXI.Graphics();
    g.lineStyle(2, COLORS.ZONE_BORDER);
    g.beginFill(card.is_face_up === false ? COLORS.CARD_BACK : COLORS.ZONE_FILL);
    g.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, 6);
    g.endFill();
    container.addChild(g);

    const content = new PIXI.Container();
    if (isOpponent) content.rotation = Math.PI;
    container.addChild(content);

    // 公開状態の描画ロジック
    if (card.is_face_up) {
      // name, powerは LeaderCard | BoardCard では必須、HiddenCardでは任意
      const cardData = card as Partial<LeaderCard & BoardCard>;
      const nameTxt = new PIXI.Text(cardData.name ?? 'Unknown', { fontSize: 9, fill: COLORS.TEXT_MAIN });
      nameTxt.anchor.set(0.5, 0); nameTxt.y = ch / 2 + 2;
      content.addChild(nameTxt);

      const powerTxt = new PIXI.Text(`P: ${cardData.power ?? 0}`, { fontSize: 10, fill: 0xFF0000, fontWeight: 'bold' });
      powerTxt.anchor.set(0.5, 1); powerTxt.y = -ch / 2 + 12;
      content.addChild(powerTxt);

      // LeaderCard 特有の情報描画（attribute）
      if ('attribute' in card && card.attribute) {
        const attrTxt = new PIXI.Text(card.attribute, { fontSize: 8, fill: 0x333333, fontWeight: 'bold' });
        attrTxt.anchor.set(0.5);
        attrTxt.y = 0;
        content.addChild(attrTxt);
      }

      // BoardCard 特有の情報描画（counter）
      if ('counter' in card && typeof card.counter === 'number') {
        const counterTxt = new PIXI.Text(`C: ${card.counter}`, { fontSize: 7, fill: 0x666666 });
        counterTxt.anchor.set(0.5);
        counterTxt.y = ch / 5;
        content.addChild(counterTxt);
      }

      // ドン付着情報の描画 (LeaderCard | BoardCard)
      if ('attached_don' in card && card.attached_don > 0) {
        const donTxt = new PIXI.Text(`+${card.attached_don} DON!!`, { fontSize: 8, fill: 0x0000FF, fontWeight: 'bold' });
        donTxt.anchor.set(0.5, 0); donTxt.y = -ch / 2 + 15;
        content.addChild(donTxt);
      }
    } else {
      const backTxt = new PIXI.Text("BACK", { fontSize: 14, fontWeight: 'bold', fill: 0x666666 });
      backTxt.anchor.set(0.5); content.addChild(backTxt);
    }

    return container;
  };

  const createBadgeContainer = (count: number) => {
    const b = new PIXI.Graphics().beginFill(COLORS.BADGE_BG).drawCircle(0, 0, 9).endFill();
    const bt = new PIXI.Text(count.toString(), { fontSize: 9, fill: COLORS.BADGE_TEXT });
    bt.anchor.set(0.5); b.addChild(bt);
    return b;
  };

  const drawLayout = useCallback((state: GameState) => {
    const app = appRef.current;
    if (!app) return;
    app.stage.removeChildren();

    const W = app.renderer.width / app.renderer.resolution;
    const H = app.renderer.height / app.renderer.resolution;
    const AVAIL_H_HALF = (H - H_CTRL - MARGIN_TOP - MARGIN_BOTTOM) / 2;
    const CH = Math.min(AVAIL_H_HALF / 4.5, (W / 8) * 1.4);
    const CW = CH / 1.4;
    const V_GAP = CH * 0.22;
    const Y_CTRL_START = MARGIN_TOP + AVAIL_H_HALF;

    const bg = new PIXI.Graphics();
    bg.beginFill(COLORS.OPPONENT_BG).drawRect(0, 0, W, Y_CTRL_START).endFill();
    bg.beginFill(COLORS.CONTROL_BG).drawRect(0, Y_CTRL_START, W, H_CTRL).endFill();
    bg.beginFill(COLORS.PLAYER_BG).drawRect(0, Y_CTRL_START + H_CTRL, W, H).endFill();
    app.stage.addChild(bg);

    // 🔴 相手
    const opp = state.players[opponentId];
    const oSide = new PIXI.Container();
    oSide.x = W; oSide.y = Y_CTRL_START; oSide.rotation = Math.PI;
    app.stage.addChild(oSide);

    opp.zones.field.forEach((c, i) => {
      const card = renderCard(c, CW, CH, true);
      card.x = getX(0.15 + i * 0.175, W); card.y = getY(1, CH, V_GAP);
      oSide.addChild(card);
    });
    oSide.addChild(Object.assign(renderCard(opp.leader, CW, CH, true), { x: getX(0.43, W), y: getY(2, CH, V_GAP) }));
    
    const oLifeData: HiddenCard = { uuid: 'ol', owner_id: opponentId, is_face_up: false };
    const oLife = renderCard(oLifeData, CW, CH, true);
    oLife.x = getX(0.15, W); oLife.y = getY(2, CH, V_GAP);
    oLife.addChild(Object.assign(createBadgeContainer(opp.life_count), { x: CW/2-4, y: CH/2-4 }));
    oSide.addChild(oLife);

    // 🔵 自分
    const pla = state.players[observerId];
    const pSide = new PIXI.Container();
    pSide.y = Y_CTRL_START + H_CTRL;
    app.stage.addChild(pSide);

    pla.zones.field.forEach((c, i) => {
      const card = renderCard(c, CW, CH);
      card.x = getX(0.15 + i * 0.175, W); card.y = getY(1, CH, V_GAP);
      pSide.addChild(card);
    });
    pSide.addChild(Object.assign(renderCard(pla.leader, CW, CH), { x: getX(0.43, W), y: getY(2, CH, V_GAP) }));

    const pLifeData: HiddenCard = { uuid: 'pl', owner_id: observerId, is_face_up: false };
    const pLife = renderCard(pLifeData, CW, CH);
    pLife.x = getX(0.15, W); pLife.y = getY(2, CH, V_GAP);
    pLife.addChild(Object.assign(createBadgeContainer(pla.life_count), { x: CW/2-4, y: CH/2-4 }));
    pSide.addChild(pLife);

    pla.zones.hand.forEach((c, i) => {
      const card = renderCard(c, CW, CH);
      card.x = getX(0.08 + i * 0.14, W); card.y = getY(4, CH, V_GAP);
      pSide.addChild(card);
    });

  }, [observerId, opponentId, getX, getY]);

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

    const interval = setInterval(() => {
      setGameState(prev => {
        const next = JSON.parse(JSON.stringify(prev)) as GameState;
        const target = next.players[observerId];
        const action = Math.floor(Math.random() * 2);
        if (action === 0) target.life_count = target.life_count <= 0 ? 5 : target.life_count - 1;
        else if (action === 1 && target.zones.field.length > 0) target.zones.field[0].is_rest = !target.zones.field[0].is_rest;
        return next;
      });
    }, 500);

    return () => { clearInterval(interval); app.destroy(true); };
  }, [drawLayout, observerId]);

  useEffect(() => { if (appRef.current) drawLayout(gameState); }, [gameState, drawLayout]);

  return <div ref={containerRef} style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0 }} />;
};
