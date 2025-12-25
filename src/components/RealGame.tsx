import { useEffect, useRef, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import type { GameState, CardInstance, LeaderCard, BoardCard } from '../types/game';
import { initialGameResponse } from '../mocks/gameState';

const MARGIN_TOP = 50;
const MARGIN_BOTTOM = 40;
const H_CTRL = 80; // iPhoneの操作域を考慮し少し広めに
const COLORS = {
  OPPONENT_BG: 0xFFEEEE,
  CONTROL_BG:  0xF0F0F0,
  PLAYER_BG:   0xE6F7FF,
  ZONE_BORDER: 0x999999,
  ZONE_FILL:   0xFFFFFF,
  CARD_BACK:   0x2C3E50, // 裏面を少し濃い色に
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
    container.eventMode = 'static'; // タッチ・マウス両対応
    container.cursor = 'pointer';
    
    // 型ガード: is_restプロパティの存在チェック
    if ('is_rest' in card && card.is_rest) {
      container.rotation = Math.PI / 2;
    }

    // 裏表判定の修正: 明示的に false の場合のみ裏向き、それ以外(true/undefined)は表
    const isBackSide = card.is_face_up === false;

    const g = new PIXI.Graphics();
    g.lineStyle(2, COLORS.ZONE_BORDER);
    g.beginFill(isBackSide ? COLORS.CARD_BACK : COLORS.ZONE_FILL);
    g.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, 6);
    g.endFill();
    container.addChild(g);

    const content = new PIXI.Container();
    // 相手側カードの場合、外側のoSideが180度回っているため、
    // 内部の文字をさらに180度回すことで自分から正位置に見えるようにする
    if (isOpponent) content.rotation = Math.PI;
    container.addChild(content);

    if (!isBackSide) {
      const cardData = card as Partial<LeaderCard & BoardCard>;
      
      // 名前表示
      const nameTxt = new PIXI.Text(cardData.name ?? 'Unknown', { fontSize: 10, fill: COLORS.TEXT_MAIN, fontWeight: 'bold' });
      nameTxt.anchor.set(0.5, 0); 
      nameTxt.y = ch / 2 - 18; // 下部に配置
      content.addChild(nameTxt);

      // パワー表示
      const powerTxt = new PIXI.Text(cardData.power?.toString() ?? '0', { fontSize: 14, fill: 0x000000, fontWeight: '900' });
      powerTxt.anchor.set(0.5); 
      powerTxt.y = -ch / 4;
      content.addChild(powerTxt);

      // リーダー特有の属性
      if ('attribute' in card && card.attribute) {
        const attrTxt = new PIXI.Text(card.attribute, { fontSize: 8, fill: 0x666666 });
        attrTxt.anchor.set(1, 0);
        attrTxt.x = cw / 2 - 5;
        attrTxt.y = -ch / 2 + 5;
        content.addChild(attrTxt);
      }

      // コスト表示 (BoardCardのみ)
      if ('cost' in card) {
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
  };

  const drawLayout = useCallback((state: GameState) => {
    const app = appRef.current;
    if (!app) return;
    app.stage.removeChildren();

    const W = app.renderer.width / app.renderer.resolution;
    const H = app.renderer.height / app.renderer.resolution;
    const AVAIL_H_HALF = (H - H_CTRL - MARGIN_TOP - MARGIN_BOTTOM) / 2;
    
    // iPhone縦画面を考慮したサイズ調整
    const CH = Math.min(AVAIL_H_HALF / 3.8, (W / 6) * 1.4);
    const CW = CH / 1.4;
    const V_GAP = CH * 0.15;
    const Y_CTRL_START = MARGIN_TOP + AVAIL_H_HALF;

    const bg = new PIXI.Graphics();
    bg.beginFill(COLORS.OPPONENT_BG).drawRect(0, 0, W, Y_CTRL_START).endFill();
    bg.beginFill(COLORS.CONTROL_BG).drawRect(0, Y_CTRL_START, W, H_CTRL).endFill();
    bg.beginFill(COLORS.PLAYER_BG).drawRect(0, Y_CTRL_START + H_CTRL, W, H).endFill();
    app.stage.addChild(bg);

    // デバッグログの出力
    const player = state.players[observerId];
    const opponent = state.players[opponentId];
    console.log(`[Render] Ldr:${player.leader.name}, Field:${player.zones.field.length} | OppLdr:${opponent.leader.name}`);

    // --- 🔴 相手側レイアウト ---
    const oSide = new PIXI.Container();
    oSide.x = W; oSide.y = Y_CTRL_START; oSide.rotation = Math.PI; 
    app.stage.addChild(oSide);

    opponent.zones.field.forEach((c, i) => {
      const card = renderCard(c, CW, CH, true);
      card.x = getX(0.2 + i * 0.2, W); card.y = getY(1, CH, V_GAP);
      oSide.addChild(card);
    });
    
    const oLeader = renderCard(opponent.leader, CW, CH, true);
    oLeader.x = getX(0.5, W); oLeader.y = getY(2, CH, V_GAP);
    oSide.addChild(oLeader);

    // --- 🔵 自分側レイアウト ---
    const pSide = new PIXI.Container();
    pSide.y = Y_CTRL_START + H_CTRL;
    app.stage.addChild(pSide);

    player.zones.field.forEach((c, i) => {
      const card = renderCard(c, CW, CH);
      card.x = getX(0.2 + i * 0.2, W); card.y = getY(1, CH, V_GAP);
      pSide.addChild(card);
    });

    const pLeader = renderCard(player.leader, CW, CH);
    pLeader.x = getX(0.5, W); pLeader.y = getY(2, CH, V_GAP);
    pSide.addChild(pLeader);

    player.zones.hand.forEach((c, i) => {
      const card = renderCard(c, CW * 0.8, CH * 0.8);
      card.x = getX(0.1 + i * 0.15, W); card.y = getY(4.2, CH, V_GAP);
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

    // iPhoneのリサイズ（回転）対応
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

  useEffect(() => { if (appRef.current) drawLayout(gameState); }, [gameState, drawLayout]);

  return (
    <div style={{ position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100vw', height: '100vh' }} />
      {/* デバッグパネル */}
      <div style={{
        position: 'absolute', top: 5, left: 5, background: 'rgba(0,0,0,0.7)',
        color: '#fff', padding: '4px 8px', fontSize: '10px', borderRadius: '4px', pointerEvents: 'none'
      }}>
        <div>LDR: {gameState.players[observerId].leader.name}</div>
        <div>FIELD: {gameState.players[observerId].zones.field.length} cards</div>
        <div>TURN: {gameState.turn_info.turn_count} ({gameState.turn_info.current_phase})</div>
      </div>
    </div>
  );
};
