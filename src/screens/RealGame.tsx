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
import { logger } from '../utils/logger';

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
    
    // 休息状態の回転
    if (card.is_rest) {
      container.rotation = Math.PI / 2;
    }

    const bg = new PIXI.Graphics();
    bg.lineStyle(S.BORDER_WIDTH, COLORS.CARD_BORDER);
    
    // 裏面判定
    const isVisible = card.is_face_up === true || (locationType === 'hand' && !isOpponent);
    
    bg.beginFill(isVisible ? (card.is_rest ? COLORS.RESTED : COLORS.CARD_BG) : COLORS.CARD_BACK);
    bg.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, S.CORNER_RADIUS);
    bg.endFill();
    container.addChild(bg);

    if (isVisible) {
      // パワー
      if (card.power !== undefined) {
        const pTxt = new PIXI.Text(card.power.toString(), {
          fontSize: S.FONT_SIZE.POWER, fill: COLORS.TEXT_MAIN, fontWeight: 'bold'
        });
        pTxt.anchor.set(0.5);
        pTxt.y = -ch / 2 + S.OFFSET.POWER_Y;
        container.addChild(pTxt);
      }

      // 名前
      const nTxt = new PIXI.Text(card.name || "", {
        fontSize: (card.type === 'STAGE' || card.type === 'RESOURCE') ? S.FONT_SIZE.NAME_RESOURCE : S.FONT_SIZE.NAME,
        fill: COLORS.TEXT_MAIN, wordWrap: true, wordWrapWidth: cw - 4
      });
      nTxt.anchor.set(0.5);
      nTxt.y = S.OFFSET.NAME_Y;
      container.addChild(nTxt);

      // コスト
      if (card.cost !== undefined) {
        const cBg = new PIXI.Graphics().beginFill(COLORS.COST_BG).drawCircle(-cw/2+10, -ch/2+10, 7).endFill();
        const cTxt = new PIXI.Text(card.cost.toString(), { fontSize: 8, fill: 0xFFFFFF });
        cTxt.anchor.set(0.5);
        cTxt.position.set(-cw/2+10, -ch/2+10);
        container.addChild(cBg, cTxt);
      }
    } else {
      const backTxt = new PIXI.Text(T.BACK_SIDE, { fontSize: 8, fill: 0xFFFFFF, align: 'center' });
      backTxt.anchor.set(0.5);
      container.addChild(backTxt);
    }

    // バッジ
    if (badgeCount > 0) {
      const bG = new PIXI.Graphics().beginFill(COLORS.BADGE_BG).drawCircle(cw/2-9, ch/2-9, 9).endFill();
      const bT = new PIXI.Text(badgeCount.toString(), { fontSize: 9, fill: COLORS.BADGE_TEXT });
      bT.anchor.set(0.5);
      bT.position.set(cw/2-9, ch/2-9);
      container.addChild(bG, bT);
    }

    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.on('pointerdown', () => {
      setSelectedCard({ card, location: locationType });
      setIsDetailMode(true);
    });

    return container;
  }, []);

  // --- PIXI 描画ループ ---
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

      // 背景の塗り分け (画像2の再現)
      const bgG = new PIXI.Graphics();
      bgG.beginFill(COLORS.OPPONENT_BG).drawRect(0, 0, W, midY).endFill();
      bgG.beginFill(COLORS.PLAYER_BG).drawRect(0, midY, W, H - midY).endFill();
      app.stage.addChild(bgG);

      const renderSide = (p: any, isOpp: boolean) => {
        const side = new PIXI.Container();
        // 相手側なら180度回転させて中央から上に配置
        if (isOpp) {
          side.x = W;
          side.y = midY;
          side.rotation = Math.PI;
        } else {
          side.y = midY;
        }
        app.stage.addChild(side);

        // Row 1: Field
        const fieldList = p.zones?.field || [];
        fieldList.forEach((c: any, i: number) => {
          const card = renderCard(c, coords.CW, coords.CH, isOpp, 'field');
          card.x = coords.getFieldX(i, W, coords.CW, fieldList.length);
          card.y = coords.getY(1, coords.CH, coords.V_GAP);
          side.addChild(card);
        });

        // Row 2: Commander (Life, Leader, Stage, Deck)
        const r2Y = coords.getY(2, coords.CH, coords.V_GAP);
        const life = renderCard({ name: 'Life', is_face_up: false }, coords.CW, coords.CH, isOpp, 'life', p.zones?.life?.length);
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

        // Row 3: Resources (Don!!, Trash)
        const r3Y = coords.getY(3, coords.CH, coords.V_GAP);
        const donAct = renderCard({ name: 'DON!!' }, coords.CW, coords.CH, isOpp, 'don', p.don_active?.length);
        donAct.x = coords.getDonActiveX(W); donAct.y = r3Y;
        side.addChild(donAct);

        const trashArr = p.zones?.trash || [];
        const trash = renderCard({ name: 'Trash' }, coords.CW, coords.CH, isOpp, 'trash', trashArr.length);
        trash.x = coords.getTrashX(W); trash.y = r3Y;
        side.addChild(trash);

        // Row 4: Hand
        const handList = p.zones?.hand || [];
        handList.forEach((c: any, i: number) => {
          const card = renderCard(c, coords.CW, coords.CH, isOpp, 'hand');
          card.x = coords.getHandX(i, W);
          card.y = coords.getY(4, coords.CH, coords.V_GAP);
          side.addChild(card);
        });
      };

      renderSide(gameState.players.p2, true);
      renderSide(gameState.players.p1, false);
    });

    return () => app.destroy(true, true);
  }, [gameState, renderCard]);

  return (
    <div ref={pixiContainerRef} className="game-screen">
      {!gameState && !isPending && (
        <button className="start-btn" onClick={startGame}>Start Game</button>
      )}
      {isDetailMode && selectedCard && (
        <CardDetailSheet card={selectedCard.card} onClose={() => setIsDetailMode(false)} />
      )}
    </div>
  );
};
