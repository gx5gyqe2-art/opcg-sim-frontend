import { useEffect, useRef, useCallback, useState } from 'react';
import * as PIXI from 'pixi.js';

// 各種定数・ロジックのインポート
import { COLORS, LAYOUT } from '../layout/layout.constants';
import { LAYOUT_PARAMS } from '../layout/layout.config';
import { GAME_UI_CONFIG } from '../game/game.config';
import { calculateCoordinates } from '../layout/layoutEngine';
import { useGameAction } from '../game/actions';
import { CardDetailSheet } from '../ui/CardDetailSheet';
import CONST from '../../shared_constants.json';

const S = LAYOUT_PARAMS.CARD_STYLE;
const T = GAME_UI_CONFIG.TEXT;

export const RealGame = () => {
  const pixiContainerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const [gameState, setGameState] = useState<any>(null);
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [isDetailMode, setIsDetailMode] = useState(false);

  const { startGame, isPending, errorToast } = useGameAction(
    CONST.PLAYER_KEYS.P1,
    setGameState
  );

  // --- カード描画関数 ---
  const renderCard = useCallback((
    card: any, 
    cw: number, 
    ch: number, 
    isOpponent: boolean, 
    locationType: string, 
    badgeCount = 0
  ) => {
    const container = new PIXI.Container();
    
    if (card.is_rest) {
      container.rotation = Math.PI / 2;
    }

    const bg = new PIXI.Graphics();
    bg.lineStyle(S.BORDER_WIDTH, COLORS.CARD_BORDER);
    
    const isVisible = card.is_face_up === true || (locationType === 'hand' && !isOpponent);
    bg.beginFill(isVisible ? (card.is_rest ? COLORS.RESTED : COLORS.CARD_BG) : COLORS.CARD_BACK);
    bg.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, S.CORNER_RADIUS);
    bg.endFill();
    container.addChild(bg);

    // テキスト要素をまとめるコンテナ（相手側ならここを180度回す）
    const textLayer = new PIXI.Container();
    if (isOpponent) textLayer.rotation = Math.PI; 
    container.addChild(textLayer);

    if (isVisible) {
      // パワー
      if (card.power !== undefined) {
        const pTxt = new PIXI.Text(card.power.toString(), {
          fontSize: S.FONT_SIZE.POWER, fill: 0xFF0000, fontWeight: 'bold'
        });
        pTxt.anchor.set(0.5);
        pTxt.y = -ch / 2 + 10;
        textLayer.addChild(pTxt);
      }

      // 名前 (折り返し設定を強化)
      const nTxt = new PIXI.Text(card.name || "", {
        fontSize: (card.type === 'STAGE' || card.type === 'RESOURCE') ? 11 : 9,
        fill: COLORS.TEXT_MAIN,
        fontWeight: 'bold',
        wordWrap: true,
        wordWrapWidth: cw - 6,
        align: 'center'
      });
      nTxt.anchor.set(0.5);
      nTxt.y = 2;
      textLayer.addChild(nTxt);

      // コスト
      if (card.cost !== undefined) {
        const cBg = new PIXI.Graphics().beginFill(COLORS.COST_BG).drawCircle(-cw/2+10, -ch/2+10, 7).endFill();
        const cTxt = new PIXI.Text(card.cost.toString(), { fontSize: 8, fill: 0xFFFFFF, fontWeight: 'bold' });
        cTxt.anchor.set(0.5);
        cTxt.position.set(-cw/2+10, -ch/2+10);
        textLayer.addChild(cBg, cTxt);
      }
    } else {
      const backTxt = new PIXI.Text(T.BACK_SIDE, { 
        fontSize: 8, fill: 0xFFFFFF, align: 'center', fontWeight: 'bold' 
      });
      backTxt.anchor.set(0.5);
      textLayer.addChild(backTxt);
    }

    // バッジ
    if (badgeCount !== undefined && badgeCount > 0) {
      const bG = new PIXI.Graphics().beginFill(COLORS.BADGE_BG).drawCircle(cw/2-9, ch/2-9, 9).endFill();
      const bT = new PIXI.Text(badgeCount.toString(), { fontSize: 9, fill: 0xFFFFFF, fontWeight: 'bold' });
      bT.anchor.set(0.5);
      bT.position.set(cw/2-9, ch/2-9);
      textLayer.addChild(bG, bT);
    }

    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.on('pointerdown', () => {
      setSelectedCard({ card, location: locationType });
      setIsDetailMode(true);
    });

    return container;
  }, []);

  useEffect(() => {
    if (!pixiContainerRef.current) return;

    const app = new PIXI.Application({
      background: COLORS.BOARD_BG,
      resizeTo: window,
      antialias: true,
    });
    appRef.current = app;
    pixiContainerRef.current.appendChild(app.view as any);

    app.ticker.add(() => {
      app.stage.removeChildren();
      if (!gameState) return;

      const { width: W, height: H } = app.screen;
      const coords = calculateCoordinates(W, H);
      const midY = H / 2;
      
      const bgG = new PIXI.Graphics();
      bgG.beginFill(COLORS.OPPONENT_BG).drawRect(0, 0, W, midY).endFill();
      bgG.beginFill(COLORS.PLAYER_BG).drawRect(0, midY, W, H - midY).endFill();
      app.stage.addChild(bgG);

      const renderSide = (p: any, isOpp: boolean) => {
        const side = new PIXI.Container();
        // 相手側は中央線から上に、自分側は中央線から下に配置
        side.y = isOpp ? midY - (LAYOUT.H_CTRL / 2) : midY + (LAYOUT.H_CTRL / 2);
        if (isOpp) {
          side.x = W;
          side.rotation = Math.PI;
        }
        app.stage.addChild(side);

        // Row 1: Field
        const fields = p.zones?.field || [];
        fields.forEach((c: any, i: number) => {
          const card = renderCard(c, coords.CW, coords.CH, isOpp, 'field');
          card.x = coords.getFieldX(i, W, coords.CW, fields.length);
          card.y = coords.getY(1, coords.CH, coords.V_GAP);
          side.addChild(card);
        });

        // Row 2: Commander
        const r2Y = coords.getY(2, coords.CH, coords.V_GAP);
        const lifeCount = p.zones?.life?.length || 0;
        const life = renderCard({ name: 'Life', is_face_up: false }, coords.CW, coords.CH, isOpp, 'life', lifeCount);
        life.x = coords.getLifeX(W); life.y = r2Y;
        side.addChild(life);

        if (p.leader) {
          const ldr = renderCard(p.leader, coords.CW, coords.CH, isOpp, 'leader');
          ldr.x = coords.getLeaderX(W); ldr.y = r2Y;
          side.addChild(ldr);
        }

        const deck = renderCard({ name: 'Deck', is_face_up: false }, coords.CW, coords.CH, isOpp, 'deck', 40);
        deck.x = coords.getDeckX(W); deck.y = r2Y;
        side.addChild(deck);

        // Row 3: Resources
        const r3Y = coords.getY(3, coords.CH, coords.V_GAP);
        const trashArr = p.zones?.trash || [];
        const trash = renderCard({ name: 'Trash' }, coords.CW, coords.CH, isOpp, 'trash', trashArr.length);
        trash.x = coords.getTrashX(W); trash.y = r3Y;
        side.addChild(trash);

        const donCount = (p.don_active?.length || 0) + (p.don_rested?.length || 0);
        const donAct = renderCard({ name: 'DON!!' }, coords.CW, coords.CH, isOpp, 'don', donCount);
        donAct.x = coords.getDonActiveX(W); donAct.y = r3Y;
        side.addChild(donAct);

        // Row 4: Hand
        const hands = p.zones?.hand || [];
        hands.forEach((c: any, i: number) => {
          const card = renderCard(c, coords.CW, coords.CH, isOpp, 'hand');
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
      {!gameState && !isPending && (
        <button className="start-btn" onClick={startGame}>Start Game</button>
      )}
      {errorToast && <div className="error-toast">{errorToast}</div>}
      {isDetailMode && selectedCard && (
        <CardDetailSheet card={selectedCard.card} onClose={() => setIsDetailMode(false)} />
      )}
    </div>
  );
};
