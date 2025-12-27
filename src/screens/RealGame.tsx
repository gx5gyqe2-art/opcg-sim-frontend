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
    // 過去ソースの座標方向フラグ
    const yDir = isOpp ? -1 : 1;

    if (!isBack) {
      // 1. パワー (枠外・上部)
      if (card.power !== undefined) {
        const pTxt = new PIXI.Text(`POWER ${card.power}`, { 
          fontSize: 11, fill: 0xFF0000, fontWeight: 'bold', align: 'center'
        });
        pTxt.anchor.set(0.5); 
        if (isRest) {
          pTxt.x = (-ch / 2 - 10) * yDir; pTxt.y = 0;
        } else {
          pTxt.x = 0; pTxt.y = (-ch / 2 - 10) * yDir;
        }
        pTxt.rotation = textRotation;
        container.addChild(pTxt);
      }

      // 2. 名前 (枠外・下部)
      const isResource = card.name === 'DON!!' || card.name === 'Trash' || card.name === 'Deck';
      const nameStyle = new PIXI.TextStyle({ 
        fontSize: isResource ? 11 : 9, 
        fontWeight: 'bold', 
        fill: isResource ? 0x000000 : 0x333333,
        align: 'center'
      });
      const maxNW = isWide ? cw * 2.2 : cw * 1.8;
      const displayName = truncateText(card.name || "", nameStyle, maxNW);
      const nTxt = new PIXI.Text(displayName, nameStyle);
      
      nTxt.anchor.set(0.5, isResource ? 0.5 : 0);
      if (isRest) {
        nTxt.x = (isResource ? 0 : ch / 2 + 2) * yDir; nTxt.y = 0;
      } else {
        nTxt.x = 0; nTxt.y = (isResource ? 0 : ch / 2 + 2) * yDir;
      }
      nTxt.rotation = textRotation;
      container.addChild(nTxt);

      // 3. カウンター (左端・回転表示)
      if (card.counter !== undefined && card.counter > 0) {
        const cTxt = new PIXI.Text(`+${card.counter}`, {
          fontSize: 8, fill: 0x000000, stroke: 0xFFFFFF, strokeThickness: 2, fontWeight: 'bold'
        });
        cTxt.anchor.set(0.5);
        cTxt.x = -cw / 2 + 8;
        cTxt.y = 0;
        cTxt.rotation = -Math.PI / 2;
        container.addChild(cTxt);
      }

      // 4. コスト (左上・円背景)
      if (card.cost !== undefined) {
        const cBg = new PIXI.Graphics().beginFill(0x333333).drawCircle(0, 0, 7).endFill();
        cBg.x = -cw / 2 + 10;
        cBg.y = -ch / 2 + 10;
        const cTxt = new PIXI.Text(card.cost.toString(), { fontSize: 8, fill: 0xFFFFFF, fontWeight: 'bold' });
        cTxt.anchor.set(0.5);
        cBg.addChild(cTxt);
        container.addChild(cBg);
      }
      
      // 5. 属性 (右上)
      if (card.attribute && card.power !== undefined) {
        const aTxt = new PIXI.Text(card.attribute, { fontSize: 7, fill: 0x666666 });
        aTxt.anchor.set(1, 0);
        aTxt.x = cw / 2 - 4;
        aTxt.y = -ch / 2 + 4;
        container.addChild(aTxt);
      }
    } else {
      const backTxt = new PIXI.Text("ONE\nPIECE", { fontSize: 8, fontWeight: 'bold', fill: 0xFFFFFF, align: 'center' });
      backTxt.anchor.set(0.5);
      backTxt.rotation = textRotation;
      container.addChild(backTxt);
    }

    // 枚数バッジ
    if (badgeCount !== undefined && (badgeCount > 0 || isResource)) {
      const bG = new PIXI.Graphics().beginFill(0xFF0000).drawCircle(0, 0, 9).endFill();
      const bT = new PIXI.Text(badgeCount.toString(), { fontSize: 9, fill: 0xFFFFFF, fontWeight: 'bold' });
      bT.anchor.set(0.5);
      
      // レスト状態に合わせてバッジ位置を調整
      if (isRest) {
        bG.x = (cw / 2 - 9) * yDir; bG.y = (ch / 2 - 9) * yDir;
      } else {
        bG.x = cw / 2 - 9; bG.y = ch / 2 - 9;
      }
      
      bG.addChild(bT);
      container.addChild(bG);
    }

    container.eventMode = 'static';
    container.on('pointerdown', () => {
      setSelectedCard({ card });
      setIsDetailMode(true);
    });

    return container;
  }, [truncateText]);

  useEffect(() => {
    if (!pixiContainerRef.current) return;
    const app = new PIXI.Application({ 
      background: 0xFFFFFF, resizeTo: window, antialias: true,
      resolution: window.devicePixelRatio || 1, autoDensity: true
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
