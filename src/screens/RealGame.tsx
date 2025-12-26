import { useEffect, useRef, useCallback, useState } from 'react';
import * as PIXI from 'pixi.js';

// 自作モジュール
import { LAYOUT, COLORS } from '../layout/layout.constants';
import { LAYOUT_PARAMS } from '../layout/layout.config';
import { GAME_UI_CONFIG } from '../game/game.config';
import { calculateCoordinates } from '../layout/layoutEngine';
import { useGameAction } from '../game/actions';

// UI部品
import { ActionMenu } from '../ui/ActionMenu';
import { CardDetailSheet } from '../ui/CardDetailSheet';

// 共通マスター
import CONST from '../../shared_constants.json';

// 短縮参照の定義
const S = LAYOUT_PARAMS.CARD_STYLE;
const T = GAME_UI_CONFIG.TEXT;
const P = LAYOUT_PARAMS;

export const RealGame = () => {
  const pixiContainerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const [gameState, setGameState] = useState<any>(null);
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [isDetailMode, setIsDetailMode] = useState(false);

  const { sendAction, startGame, isPending, errorToast } = useGameAction(
    CONST.PLAYER_KEYS.P1,
    setGameState
  );

  // --- カード描画ロジック (定数参照版) ---
  const renderCard = useCallback((
    card: any, 
    x: number, 
    y: number, 
    cw: number, 
    ch: number, 
    isOpponent: boolean, 
    locationType: string, 
    badgeCount = 0
  ) => {
    const container = new PIXI.Container();
    container.x = x;
    container.y = y;

    const bg = new PIXI.Graphics();
    bg.lineStyle(S.BORDER_WIDTH, COLORS.CARD_BORDER);
    bg.beginFill(card.isUpright === false ? COLORS.RESTED : COLORS.CARD_BG);
    bg.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, S.CORNER_RADIUS);
    bg.endFill();
    container.addChild(bg);

    if (card.faceUp) {
      // パワー表示
      if (card.power !== undefined) {
        const pTxt = new PIXI.Text(card.power.toString(), {
          fontSize: S.FONT_SIZE.POWER,
          fill: COLORS.TEXT_MAIN,
          fontWeight: 'bold'
        });
        pTxt.anchor.set(0.5);
        pTxt.y = -ch / 2 + S.OFFSET.POWER_Y;
        container.addChild(pTxt);
      }

      // 名前表示
      const nTxt = new PIXI.Text(card.name, {
        fontSize: card.type === 'RESOURCE' ? S.FONT_SIZE.NAME_RESOURCE : S.FONT_SIZE.NAME,
        fill: COLORS.TEXT_MAIN,
        wordWrap: true,
        wordWrapWidth: cw - S.OFFSET.ATTR_MARGIN
      });
      nTxt.anchor.set(0.5);
      nTxt.y = S.OFFSET.NAME_Y;
      container.addChild(nTxt);

      // コスト表示
      if (card.cost !== undefined) {
        const cBg = new PIXI.Graphics()
          .beginFill(COLORS.COST_BG)
          .drawCircle(0, 0, S.COST_RADIUS)
          .endFill();
        cBg.x = -cw / 2 + S.OFFSET.COST_POS;
        cBg.y = -ch / 2 + S.OFFSET.COST_POS;
        container.addChild(cBg);

        const cTxt = new PIXI.Text(card.cost.toString(), {
          fontSize: S.FONT_SIZE.COST,
          fill: 0xFFFFFF
        });
        cTxt.anchor.set(0.5);
        cTxt.x = cBg.x;
        cTxt.y = cBg.y;
        container.addChild(cTxt);
      }
    } else {
      // 裏面表示
      const backTxt = new PIXI.Text(T.BACK_SIDE, {
        fontSize: S.FONT_SIZE.BACK,
        fill: 0xFFFFFF,
        align: 'center',
        fontWeight: 'bold'
      });
      backTxt.anchor.set(0.5);
      container.addChild(backTxt);
    }

    // 枚数バッジ (デッキやドン!!デッキ用)
    if (badgeCount > 0) {
      const bG = new PIXI.Graphics()
        .beginFill(COLORS.BADGE_BG)
        .drawCircle(cw / 2 - S.BADGE.OFFSET, -ch / 2 + S.BADGE.OFFSET, S.BADGE.RADIUS)
        .endFill();
      container.addChild(bG);

      const bT = new PIXI.Text(badgeCount.toString(), {
        fontSize: S.BADGE.FONT_SIZE,
        fill: 0xFFFFFF
      });
      bT.anchor.set(0.5);
      bT.x = cw / 2 - S.BADGE.OFFSET;
      bT.y = -ch / 2 + S.BADGE.OFFSET;
      container.addChild(bT);
    }

    // インタラクション判定
    container.eventMode = 'static';
    container.cursor = 'pointer';
    
    let pressTimer: any;
    container.on('pointerdown', () => {
      pressTimer = setTimeout(() => {
        setSelectedCard({ card, location: locationType });
        setIsDetailMode(true);
      }, GAME_UI_CONFIG.INTERACTION.LONG_PRESS_DURATION);
    });
    container.on('pointerup', () => clearTimeout(pressTimer));
    container.on('pointerupoutside', () => clearTimeout(pressTimer));

    return container;
  }, []);

  // --- PIXI初期化・メインループ ---
  useEffect(() => {
    if (!pixiContainerRef.current) return;

    const app = new PIXI.Application({
      background: COLORS.BOARD_BG,
      resizeTo: window,
      antialias: true,
    });
    appRef.current = app;
    pixiContainerRef.current.appendChild(app.view as any);

    const mainContainer = new PIXI.Container();
    app.stage.addChild(mainContainer);

    app.ticker.add(() => {
      mainContainer.removeChildren();
      if (!gameState) {
        // 接続待ち表示
        const loading = new PIXI.Text(T.CONNECTING, { fill: 0x666666, fontSize: 14 });
        loading.anchor.set(0.5);
        loading.x = app.screen.width / 2;
        loading.y = app.screen.height / 2;
        mainContainer.addChild(loading);
        return;
      }

      const { width: W, height: H } = app.screen;
      const coords = calculateCoordinates(W, H);

      // --- 描画実行 (coords と renderCard を使用) ---
      // 例: ライフの描画
      gameState.p1.life.forEach((card: any, i: number) => {
        const x = coords.getLifeX(W) + (i * S.OFFSET.ATTACHED_DON);
        const y = coords.getY(1, H, coords.V_GAP);
        mainContainer.addChild(renderCard(card, x, y, coords.CW, coords.CH, false, 'life'));
      });

      // ... その他（Leader, Field, Hand等）の描画ロジック ...
      
    });

    return () => app.destroy(true, true);
  }, [gameState, renderCard]);

  return (
    <div ref={pixiContainerRef} className="game-screen">
      {/* UIオーバーレイ */}
      {!gameState && !isPending && (
        <button className="start-btn" onClick={startGame}>Start Game</button>
      )}
      
      {errorToast && <div className="error-toast">{errorToast}</div>}
      
      {isDetailMode && selectedCard && (
        <CardDetailSheet 
          card={selectedCard.card} 
          onClose={() => setIsDetailMode(false)} 
        />
      )}
    </div>
  );
};
