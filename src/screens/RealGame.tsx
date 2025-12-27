import { useEffect, useRef, useCallback, useState } from 'react';
import * as PIXI from 'pixi.js';
import { COLORS } from '../layout/layout.constants';
import { calculateCoordinates } from '../layout/layoutEngine';
import { useGameAction } from '../game/actions';
import { CardDetailSheet } from '../ui/CardDetailSheet';
import CONST from '../../shared_constants.json';

export const RealGame = () => {
  const pixiContainerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const [gameState, setGameState] = useState<any>(null);
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [isDetailMode, setIsDetailMode] = useState(false);

  const { startGame, isPending } = useGameAction(CONST.PLAYER_KEYS.P1, setGameState);

  const truncateText = (text: string, style: PIXI.TextStyle, maxWidth: number): string => {
    const metrics = PIXI.TextMetrics.measureText(text, style);
    if (metrics.width <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 0) {
      truncated = truncated.slice(0, -1);
      if (PIXI.TextMetrics.measureText(truncated + '...', style).width <= maxWidth) return truncated + '...';
    }
    return '...';
  };

  const renderCard = useCallback((
    card: any, 
    cw: number, 
    ch: number, 
    isOpp: boolean, 
    badgeCount?: number,
    isWide = false
  ) => {
    const container = new PIXI.Container();
    
    const isRest = card.is_rest === true;
    if (isRest) container.rotation = Math.PI / 2;

    const isBack = card.is_face_up === false && !(!isOpp && card.location === 'hand');
    
    const g = new PIXI.Graphics();
    g.lineStyle(2, COLORS.ZONE_BORDER);
    g.beginFill(isBack ? COLORS.CARD_BACK : COLORS.ZONE_FILL);
    g.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, 6);
    g.endFill();
    container.addChild(g);

    const textRotation = isRest ? -Math.PI / 2 : 0;

    if (!isBack) {
      if (card.power !== undefined) {
        const pTxt = new PIXI.Text(card.power, { fontSize: 11, fill: 0xFF0000, fontWeight: 'bold' });
        pTxt.anchor.set(0.5);
        pTxt.y = -ch / 2 + 10;
        pTxt.rotation = textRotation;
        container.addChild(pTxt);
      }

      const nameStyle = new PIXI.TextStyle({ fontSize: 9, fontWeight: 'bold', fill: 0x333333 });
      const displayName = truncateText(card.name || "", nameStyle, isWide ? cw * 2.0 : cw * 1.5);
      const nTxt = new PIXI.Text(displayName, nameStyle);
      nTxt.anchor.set(0.5);
      nTxt.rotation = textRotation;
      container.addChild(nTxt);

      if (card.cost !== undefined) {
        const cBg = new PIXI.Graphics().beginFill(0x333333).drawCircle(-cw / 2 + 10, -ch / 2 + 10, 7).endFill();
        const cTxt = new PIXI.Text(card.cost, { fontSize: 8, fill: 0xFFFFFF, fontWeight: 'bold' });
        cTxt.anchor.set(0.5);
        cTxt.position.set(-cw / 2 + 10, -ch / 2 + 10);
        cTxt.rotation = textRotation;
        container.addChild(cBg, cTxt);
      }
    } else {
      const backTxt = new PIXI.Text("ONE\nPIECE", { fontSize: 8, fontWeight: 'bold', fill: 0xFFFFFF, align: 'center' });
      backTxt.anchor.set(0.5);
      backTxt.rotation = textRotation;
      container.addChild(backTxt);
    }

    if (badgeCount !== undefined) {
      const bG = new PIXI.Graphics().beginFill(0xFF0000).drawCircle(cw / 2 - 9, ch / 2 - 9, 9).endFill();
      const bT = new PIXI.Text(badgeCount.toString(), { fontSize: 9, fill: 0xFFFFFF });
      bT.anchor.set(0.5);
      bT.position.set(cw / 2 - 9, ch / 2 - 9);
      bT.rotation = textRotation;
      container.addChild(bG, bT);
    }

    container.eventMode = 'static';
    container.on('pointerdown', () => {
      setSelectedCard({ card });
      setIsDetailMode(true);
    });

    return container;
  }, []);

  useEffect(() => {
    if (!pixiContainerRef.current) return;
    
    // 【修正箇所】高精細ディスプレイ(Retina等)対応の設定を追加
    const app = new PIXI.Application({ 
      background: 0xFFFFFF, 
      resizeTo: window, 
      antialias: true,
      resolution: window.devicePixelRatio || 1, // 過去ソースの解像度設定を復元
      autoDensity: true,                         // 描画サイズを物理ピクセルに最適化
    });

    appRef.current = app;
    pixiContainerRef.current.appendChild(app.view as any);

    app.ticker.add(() => {
      app.stage.removeChildren();
      if (!gameState) return;

      const { width: W, height: H } = app.screen;
      const coords = calculateCoordinates(W, H);
      const midY = H / 2;

      const bg = new PIXI.Graphics();
      bg.beginFill(COLORS.OPPONENT_BG).drawRect(0, 0, W, midY).endFill();
      bg.beginFill(COLORS.CONTROL_BG).drawRect(0, midY - 40, W, 80).endFill();
      bg.beginFill(COLORS.PLAYER_BG).drawRect(0, midY + 40, W, H - (midY + 40)).endFill();
      app.stage.addChild(bg);

      const renderSide = (p: any, isOpp: boolean) => {
        const side = new PIXI.Container();
        if (isOpp) {
          side.x = W; side.y = midY - 40; side.rotation = Math.PI;
        } else {
          side.y = midY + 40;
        }
        app.stage.addChild(side);

        (p.zones?.field || []).forEach((c: any, i: number) => {
          const card = renderCard(c, coords.CW, coords.CH, isOpp);
          card.x = coords.getFieldX(i, W, coords.CW, p.zones.field.length);
          card.y = coords.getY(1, coords.CH, coords.V_GAP);
          side.addChild(card);
        });

        const r2Y = coords.getY(2, coords.CH, coords.V_GAP);
        const ldr = renderCard(p.leader, coords.CW, coords.CH, isOpp, undefined, true);
        ldr.x = coords.getLeaderX(W); ldr.y = r2Y;
        side.addChild(ldr);

        const life = renderCard({ name: 'Life', is_face_up: false }, coords.CW, coords.CH, isOpp, p.zones?.life?.length);
        life.x = coords.getLifeX(W); life.y = r2Y;
        side.addChild(life);

        const deck = renderCard({ name: 'Deck', is_face_up: false }, coords.CW, coords.CH, isOpp, 40);
        deck.x = coords.getDeckX(W); deck.y = r2Y;
        side.addChild(deck);

        const r3Y = coords.getY(3, coords.CH, coords.V_GAP);
        const donAct = renderCard({ name: 'DON!!' }, coords.CW, coords.CH, isOpp, p.don_active?.length);
        donAct.x = coords.getDonActiveX(W); donAct.y = r3Y;
        side.addChild(donAct);

        const donRst = renderCard({ name: 'DON!!', is_rest: true }, coords.CW, coords.CH, isOpp, p.don_rested?.length);
        donRst.x = coords.getDonRestX(W); donRst.y = r3Y;
        side.addChild(donRst);

        const trashArr = p.zones?.trash || [];
        const trash = renderCard({ name: 'Trash' }, coords.CW, coords.CH, isOpp, trashArr.length);
        trash.x = coords.getTrashX(W); trash.y = r3Y;
        side.addChild(trash);

        (p.zones?.hand || []).forEach((c: any, i: number) => {
          const card = renderCard({ ...c, location: 'hand' }, coords.CW, coords.CH, isOpp);
          card.x = coords.getHandX(i, W);
          card.y = coords.getY(4, coords.CH, coords.V_GAP);
          side.addChild(card);
        });
      };

      if (gameState.players) {
        renderSide(gameState.players.p2, true);
        renderSide(gameState.players.p1, false);
      }
    });

    return () => app.destroy(true, true);
  }, [gameState, renderCard]);

  return (
    <div ref={pixiContainerRef} className="game-screen">
      {!gameState && !isPending && <button onClick={startGame} className="start-btn">Game Start</button>}
      {isDetailMode && selectedCard && <CardDetailSheet card={selectedCard.card} onClose={() => setIsDetailMode(false)} />}
    </div>
  );
};
