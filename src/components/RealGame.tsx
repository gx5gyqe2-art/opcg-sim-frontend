import { useEffect, useRef, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { GameState, CardInstance } from '../types/game';
import { initialGameResponse } from '../mocks/gameState';

// --- デザイン定量パラメータ (v1.2 準拠) ---
const MARGIN_TOP = 50;
const MARGIN_BOTTOM = 40;
const H_CTRL = 60;
const COLORS = {
  OPPONENT_BG: 0xFFEEEE, // ピンク
  CONTROL_BG:  0xF0F0F0, // グレー
  PLAYER_BG:   0xE6F7FF, // ブルー
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
  
  // 1. State管理
  const [gameState, setGameState] = useState<GameState>(initialGameResponse.state);

  const urlParams = new URLSearchParams(window.location.search);
  const observerId = urlParams.get('observerId') || 'p1';
  const opponentId = observerId === 'p1' ? 'p2' : 'p1';

  // --- 座標・描画計算ヘルパー ---
  const getX = useCallback((ratio: number, width: number) => width * ratio, []);
  const getY = useCallback((rowIdx: number, cardHeight: number, gap: number) => {
    return (rowIdx - 0.5) * (cardHeight + gap);
  }, []);

  const renderCard = (card: Partial<CardInstance>, cw: number, ch: number, isOpponent: boolean = false) => {
    const container = new PIXI.Container();
    // 状態追従確認：is_rest による回転
    if (card.is_rest) container.rotation = Math.PI / 2;

    const g = new PIXI.Graphics();
    g.lineStyle(2, COLORS.ZONE_BORDER);
    g.beginFill(card.is_face_up === false ? COLORS.CARD_BACK : COLORS.ZONE_FILL);
    g.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, 6);
    g.endFill();
    container.addChild(g);

    const content = new PIXI.Container();
    if (isOpponent) content.rotation = Math.PI;
    container.addChild(content);

    if (card.is_face_up !== false && card.name) {
      const nameTxt = new PIXI.Text(card.name, { fontSize: 9, fill: COLORS.TEXT_MAIN });
      nameTxt.anchor.set(0.5, 0); nameTxt.y = ch / 2 + 2;
      content.addChild(nameTxt);

      const pwrTxt = new PIXI.Text(`P: ${card.power ?? 0}`, { fontSize: 10, fill: 0xFF0000, fontWeight: 'bold' });
      pwrTxt.anchor.set(0.5, 1); pwrTxt.y = -ch / 2 + 12;
      content.addChild(pwrTxt);

      const attrTxt = new PIXI.Text(`${card.attribute ?? '-'} | C: ${card.counter ?? 0}`, { fontSize: 7, fill: 0x666666 });
      attrTxt.anchor.set(0.5); attrTxt.y = ch / 5;
      content.addChild(attrTxt);

      if (card.attached_don && card.attached_don > 0) {
        const donTxt = new PIXI.Text(`+${card.attached_don} DON!!`, { fontSize: 8, fill: 0x0000FF, fontWeight: 'bold' });
        donTxt.anchor.set(0.5, 0); donTxt.y = -ch / 2 + 15;
        content.addChild(donTxt);
      }
    } else {
      const backTxt = new PIXI.Text("BACK", { fontSize: 14, fontWeight: 'bold', fill: 0x666666 });
      backTxt.anchor.set(0.5); content.addChild(backTxt);
    }

    // 状態追従確認：badge による枚数表示
    if (card.attached_don !== undefined && card.attached_don > 0) {
        // ドン付与等の表示（必要に応じて）
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

    // --- 🔴 相手側 (oSide) ---
    const opp = state.players[opponentId];
    const oSide = new PIXI.Container();
    oSide.x = W; oSide.y = Y_CTRL_START; oSide.rotation = Math.PI;
    app.stage.addChild(oSide);

    // Row 4: Field
    opp.zones.field.forEach((c, i) => {
      const card = renderCard(c, CW, CH, true);
      card.x = getX(0.15 + i * 0.175, W); card.y = getY(1, CH, V_GAP);
      oSide.addChild(card);
    });

    // Row 3: Leader, Life, Deck
    const oLeader = renderCard(opp.leader, CW, CH, true);
    oLeader.x = getX(0.43, W); oLeader.y = getY(2, CH, V_GAP);
    oSide.addChild(oLeader);

    const oLife = renderCard({ is_face_up: false }, CW, CH, true);
    oLife.x = getX(0.15, W); oLife.y = getY(2, CH, V_GAP);
    const oLifeBadge = createBadgeContainer(opp.life_count);
    oLifeBadge.x = CW/2 - 4; oLifeBadge.y = CH/2 - 4; oLife.addChild(oLifeBadge);
    oSide.addChild(oLife);

    // Row 2: Don
    const oDonA = renderCard({ name: "Don" }, CW, CH, true);
    oDonA.x = getX(0.35, W); oDonA.y = getY(3, CH, V_GAP);
    const oDonABadge = createBadgeContainer(opp.don_active.length);
    oDonABadge.x = CW/2 - 4; oDonABadge.y = CH/2 - 4; oDonA.addChild(oDonABadge);
    oSide.addChild(oDonA);

    // --- 🔵 自分側 (pSide) ---
    const pla = state.players[observerId];
    const pSide = new PIXI.Container();
    pSide.y = Y_CTRL_START + H_CTRL;
    app.stage.addChild(pSide);

    // Row 4: Field
    pla.zones.field.forEach((c, i) => {
      const card = renderCard(c, CW, CH);
      card.x = getX(0.15 + i * 0.175, W); card.y = getY(1, CH, V_GAP);
      pSide.addChild(card);
    });

    // Row 3: Leader, Life
    const pLeader = renderCard(pla.leader, CW, CH);
    pLeader.x = getX(0.43, W); pLeader.y = getY(2, CH, V_GAP);
    pSide.addChild(pLeader);

    const pLife = renderCard({ is_face_up: false }, CW, CH);
    pLife.x = getX(0.15, W); pLife.y = getY(2, CH, V_GAP);
    const pLifeBadge = createBadgeContainer(pla.life_count);
    pLifeBadge.x = CW/2 - 4; pLifeBadge.y = CH/2 - 4; pLife.addChild(pLifeBadge);
    pSide.addChild(pLife);

    // Row 2: Don
    const pDonA = renderCard({ name: "Don" }, CW, CH);
    pDonA.x = getX(0.35, W); pDonA.y = getY(3, CH, V_GAP);
    const pDonABadge = createBadgeContainer(pla.don_active.length);
    pDonABadge.x = CW/2 - 4; pDonABadge.y = CH/2 - 4; pDonA.addChild(pDonABadge);
    pSide.addChild(pDonA);

    // Row 1: Hand
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

    // ---  chaos debug loop (同期性能検証用) ---
    const interval = setInterval(() => {
      setGameState(prev => {
        const next = JSON.parse(JSON.stringify(prev)) as GameState;
        const targetPlayer = next.players[observerId];
        const randomAction = Math.floor(Math.random() * 3);

        switch (randomAction) {
          case 0: // ライフの増減
            targetPlayer.life_count -= 1;
            if (targetPlayer.life_count < 0) targetPlayer.life_count = 5;
            break;
          case 1: // フィールドの Rest 反転
            if (targetPlayer.zones.field.length > 0) {
              targetPlayer.zones.field[0].is_rest = !targetPlayer.zones.field[0].is_rest;
            }
            break;
          case 2: // ドンの枚数増減
            if (targetPlayer.don_active.length > 5) {
              targetPlayer.don_active.pop();
            } else {
              targetPlayer.don_active.push({});
            }
            break;
        }
        return next;
      });
    }, 500);

    return () => {
      clearInterval(interval);
      if (appRef.current) appRef.current.destroy(true, { children: true });
    };
  }, [drawLayout, observerId]);

  // gameState 変更時に Pixi 描画をトリガー
  useEffect(() => {
    if (appRef.current) drawLayout(gameState);
  }, [gameState, drawLayout]);

  return <div ref={containerRef} style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0 }} />;
};
