import { useEffect, useRef, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import type { GameState, CardInstance, LeaderCard, BoardCard } from '../types/game';
import { initialGameResponse } from '../mocks/gameState';

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

  // --- 3. ビルドエラー回避（厳格な型ガード） ---
  const renderCard = useCallback((card: CardInstance, cw: number, ch: number, isOpponent: boolean = false) => {
    const container = new PIXI.Container();
    container.eventMode = 'static';
    
    if ('is_rest' in card && card.is_rest) {
      container.rotation = Math.PI / 2;
    }

    // is_face_up の判定
    const isBackSide = ('is_face_up' in card) ? card.is_face_up === false : false;

    const g = new PIXI.Graphics();
    g.lineStyle(1, COLORS.ZONE_BORDER);
    g.beginFill(isBackSide ? COLORS.CARD_BACK : COLORS.ZONE_FILL);
    g.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, 4);
    g.endFill();
    container.addChild(g);

    const content = new PIXI.Container();
    // 相手側カードの文字を自分から見て正位置にするための反転
    if (isOpponent) content.rotation = Math.PI;
    container.addChild(content);

    const fontSize = Math.max(8, ch * 0.12);

    if (!isBackSide) {
      const cardData = card as Partial<LeaderCard & BoardCard>;
      
      // 名前表示
      const nameTxt = new PIXI.Text(cardData.name ?? '', { fontSize: fontSize * 0.8, fill: COLORS.TEXT_MAIN, fontWeight: 'bold' });
      nameTxt.anchor.set(0.5, 0); 
      nameTxt.y = ch / 2 - (fontSize + 2); 
      content.addChild(nameTxt);

      // パワー表示
      const powerTxt = new PIXI.Text(cardData.power?.toString() ?? '0', { fontSize: fontSize * 1.2, fill: 0x000000, fontWeight: '900' });
      powerTxt.anchor.set(0.5); 
      powerTxt.y = -ch * 0.1;
      content.addChild(powerTxt);

      // cost の表示（型ガード必須）
      if ('cost' in card && typeof card.cost === 'number') {
        const costSize = fontSize * 1.1;
        const costBg = new PIXI.Graphics().beginFill(0x333333).drawCircle(0, 0, costSize * 0.8).endFill();
        costBg.x = -cw / 2 + costSize * 0.7;
        costBg.y = -ch / 2 + costSize * 0.7;
        
        const costTxt = new PIXI.Text(card.cost.toString(), { fontSize: costSize, fill: 0xFFFFFF });
        costTxt.anchor.set(0.5);
        costBg.addChild(costTxt);
        content.addChild(costBg);
      }
    } else {
      const backTxt = new PIXI.Text("ONE\nPIECE", { fontSize: fontSize, fontWeight: 'bold', fill: 0xFFFFFF, align: 'center' });
      backTxt.anchor.set(0.5); 
      content.addChild(backTxt);
    }

    return container;
  }, []);

  const drawLayout = useCallback((state: GameState) => {
    const app = appRef.current;
    if (!app) return;
    app.stage.removeChildren();

    // --- 1. レイアウト定数の再定義 ---
    const W = app.renderer.width / app.renderer.resolution;
    const H = app.renderer.height / app.renderer.resolution;
    const CH = Math.min(H / 10, (W / 7) * 1.4);
    const CW = CH / 1.4;
    const V_GAP = CH * 0.15;

    const getRowYOffset = (row: number) => row * (CH + V_GAP);

    const bg = new PIXI.Graphics();
    bg.beginFill(COLORS.OPPONENT_BG).drawRect(0, 0, W, H / 2).endFill();
    bg.beginFill(COLORS.PLAYER_BG).drawRect(0, H / 2, W, H / 2).endFill();
    app.stage.addChild(bg);

    const player = state.players[observerId];
    const opponent = state.players[opponentId];

    // --- 相手側 (oSide) ---
    const oSide = new PIXI.Container();
    oSide.x = W; oSide.y = H / 2; oSide.rotation = Math.PI; 
    app.stage.addChild(oSide);

    // リーダー & ライフ
    const oLeader = renderCard(opponent.leader, CW, CH, true);
    oLeader.x = W * 0.5; oLeader.y = getRowYOffset(2);
    oSide.addChild(oLeader);

    // キャラ
    opponent.zones.field.forEach((c, i) => {
      const card = renderCard(c, CW, CH, true);
      card.x = W * 0.3 + (i * CW * 1.1); 
      card.y = getRowYOffset(1);
      oSide.addChild(card);
    });

    // --- 自分側 (pSide) ---
    const pSide = new PIXI.Container();
    pSide.y = H / 2;
    app.stage.addChild(pSide);

    // リーダー (x = W * 0.5)
    const pLeader = renderCard(player.leader, CW, CH);
    pLeader.x = W * 0.5; pLeader.y = getRowYOffset(1);
    pSide.addChild(pLeader);

    // フィールドキャラ (x = W * 0.3 + ...)
    player.zones.field.forEach((c, i) => {
      const card = renderCard(c, CW, CH);
      card.x = W * 0.3 + (i * CW * 1.1);
      card.y = getRowYOffset(2);
      pSide.addChild(card);
    });

    // --- 2. 座標計算ロジックの修正 (手札の重なり調整) ---
    const handScale = 0.8;
    const handCW = CW * handScale;
    const handCH = CH * handScale;
    const handCount = player.zones.hand.length;
    // 画面幅に収まるよう間隔を計算 (最大でもカード幅の60%)
    const handOverlap = Math.min(handCW * 0.6, (W - 40) / Math.max(1, handCount));
    const handStartX = (W / 2) - ((handCount - 1) * handOverlap / 2);

    player.zones.hand.forEach((c, i) => {
      const card = renderCard(c, handCW, handCH);
      card.x = handStartX + (i * handOverlap);
      card.y = getRowYOffset(3.8);
      pSide.addChild(card);
    });

  }, [observerId, opponentId, renderCard]);

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
