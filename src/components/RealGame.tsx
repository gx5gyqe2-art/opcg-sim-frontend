import { useEffect, useRef, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import type { GameState, CardInstance, LeaderCard, BoardCard } from '../types/game';
import { initialGameResponse } from '../mocks/gameState';

// --- 1. レイアウト定数の定義 ---
const MARGIN_TOP = 50;
const MARGIN_BOTTOM = 40;
const H_CTRL = 60;
const COLORS = {
  OPPONENT_BG: 0xFFEEEE,
  CONTROL_BG:  0xF0F0F0,
  PLAYER_BG:   0xE6F7FF,
  ZONE_BORDER: 0x999999,
  ZONE_FILL:   0xFFFFFF,
  CARD_BACK:   0x2C3E50,
  TEXT_MAIN:   0x333333,
};

export const RealGame = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const gameState: GameState = initialGameResponse.state;

  const urlParams = new URLSearchParams(window.location.search);
  const observerId = urlParams.get('observerId') || 'p1';
  const opponentId = observerId === 'p1' ? 'p2' : 'p1';

  // --- 4. 描画ロジック (renderCard) ---
  const renderCard = useCallback((card: CardInstance, cw: number, ch: number, isOpponent: boolean = false) => {
    const container = new PIXI.Container();
    container.eventMode = 'static';
    
    if ('is_rest' in card && card.is_rest) {
      container.rotation = Math.PI / 2;
    }

    // is_face_up の型ガード判定
    const isBackSide = ('is_face_up' in card) ? card.is_face_up === false : false;

    const g = new PIXI.Graphics();
    g.lineStyle(1.5, COLORS.ZONE_BORDER);
    g.beginFill(isBackSide ? COLORS.CARD_BACK : COLORS.ZONE_FILL);
    g.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, 6);
    g.endFill();
    container.addChild(g);

    const content = new PIXI.Container();
    // 相手側のカード内の文字を自分から見て正位置にする
    if (isOpponent) content.rotation = Math.PI;
    container.addChild(content);

    const fontSize = Math.max(8, ch * 0.12);

    if (!isBackSide) {
      const cardData = card as Partial<LeaderCard & BoardCard>;
      
      // 名前
      const nameTxt = new PIXI.Text(cardData.name ?? '', { 
        fontSize: fontSize * 0.85, fill: COLORS.TEXT_MAIN, fontWeight: 'bold', wordWrap: true, wordWrapWidth: cw - 4 
      });
      nameTxt.anchor.set(0.5, 0); 
      nameTxt.y = ch / 2 - (fontSize + 4); 
      content.addChild(nameTxt);

      // パワー
      const powerTxt = new PIXI.Text(cardData.power?.toString() ?? '0', { 
        fontSize: fontSize * 1.3, fill: 0x000000, fontWeight: '900' 
      });
      powerTxt.anchor.set(0.5); 
      powerTxt.y = -ch * 0.1;
      content.addChild(powerTxt);

      // cost の型ガード描画
      if ('cost' in card && typeof card.cost === 'number') {
        const costSize = fontSize * 1.1;
        const costBg = new PIXI.Graphics().beginFill(0x333333).drawCircle(0, 0, costSize * 0.75).endFill();
        costBg.x = -cw / 2 + costSize * 0.7;
        costBg.y = -ch / 2 + costSize * 0.7;
        
        const costTxt = new PIXI.Text(card.cost.toString(), { fontSize: costSize, fill: 0xFFFFFF });
        costTxt.anchor.set(0.5);
        costBg.addChild(costTxt);
        content.addChild(costBg);
      }
    } else {
      const backTxt = new PIXI.Text("ONE\nPIECE", { 
        fontSize: fontSize * 0.9, fontWeight: 'bold', fill: 0xFFFFFF, align: 'center' 
      });
      backTxt.anchor.set(0.5); 
      content.addChild(backTxt);
    }

    return container;
  }, []);

  const drawLayout = useCallback((state: GameState) => {
    const app = appRef.current;
    if (!app) return;
    app.stage.removeChildren();

    // --- レイアウト定数の計算 ---
    const W = app.renderer.width / app.renderer.resolution;
    const H = app.renderer.height / app.renderer.resolution;
    const AVAILABLE_H_HALF = (H - MARGIN_TOP - MARGIN_BOTTOM - H_CTRL) / 2;
    const CH_LIMIT = AVAILABLE_H_HALF / 4.5;
    const CH = Math.min(CH_LIMIT, (W / 8) * 1.4);
    const CW = CH / 1.4;
    const V_GAP = CH * 0.22;
    const Y_CTRL_START = MARGIN_TOP + AVAILABLE_H_HALF;
    const Y_PLAYER_START = Y_CTRL_START + H_CTRL;

    // --- 2. 座標計算関数 ---
    const getRowYOffset = (rowIdx: number) => (rowIdx - 0.5) * (CH + V_GAP);

    // 背景描画
    const bg = new PIXI.Graphics();
    bg.beginFill(COLORS.OPPONENT_BG).drawRect(0, 0, W, Y_CTRL_START).endFill();
    bg.beginFill(COLORS.CONTROL_BG).drawRect(0, Y_CTRL_START, W, H_CTRL).endFill();
    bg.beginFill(COLORS.PLAYER_BG).drawRect(0, Y_PLAYER_START, W, H - Y_PLAYER_START).endFill();
    app.stage.addChild(bg);

    const player = state.players[observerId];
    const opponent = state.players[opponentId];

    // --- 3. 具体的な配置位置 (相手側 oSide) ---
    const oSide = new PIXI.Container();
    oSide.x = W; oSide.y = Y_CTRL_START; oSide.rotation = Math.PI; 
    app.stage.addChild(oSide);

    // 相手フィールド
    opponent.zones.field.forEach((c, i) => {
      const card = renderCard(c, CW, CH, true);
      card.x = W * 0.15 + (i * CW * 1.2); card.y = getRowYOffset(1);
      oSide.addChild(card);
    });
    // 相手ライフ・リーダー・山札
    const oLife = renderCard(opponent.zones.life[0] || { id: 'dummy' }, CW, CH, true); // 背面表示
    oLife.x = W * 0.15; oLife.y = getRowYOffset(2); oSide.addChild(oLife);

    const oLeader = renderCard(opponent.leader, CW, CH, true);
    oLeader.x = W * 0.43; oLeader.y = getRowYOffset(2); oSide.addChild(oLeader);

    const oDeck = renderCard({ id: 'deck_o' } as CardInstance, CW, CH, true);
    oDeck.x = W * 0.85; oDeck.y = getRowYOffset(2); oSide.addChild(oDeck);

    // --- 3. 具体的な配置位置 (自分側 pSide) ---
    const pSide = new PIXI.Container();
    pSide.y = Y_PLAYER_START;
    app.stage.addChild(pSide);

    // フィールド
    player.zones.field.forEach((c, i) => {
      const card = renderCard(c, CW, CH);
      card.x = W * 0.15 + (i * CW * 1.2); card.y = getRowYOffset(1);
      pSide.addChild(card);
    });

    // ライフ・リーダー・デッキ
    const pLife = renderCard(player.zones.life[0] || { id: 'dummy' }, CW, CH);
    pLife.x = W * 0.15; pLife.y = getRowYOffset(2); pSide.addChild(pLife);

    const pLeader = renderCard(player.leader, CW, CH);
    pLeader.x = W * 0.43; pLeader.y = getRowYOffset(2); pSide.addChild(pLeader);

    const pDeck = renderCard({ id: 'deck_p' } as CardInstance, CW, CH);
    pDeck.x = W * 0.85; pDeck.y = getRowYOffset(2); pSide.addChild(pDeck);

    // 手札 (重ね配置)
    player.zones.hand.forEach((c, i) => {
      const card = renderCard(c, CW, CH);
      card.x = (W * 0.08) + (i * CW * 0.7); 
      card.y = getRowYOffset(4);
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
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100vw', height: '100vh' }} />
    </div>
  );
};
