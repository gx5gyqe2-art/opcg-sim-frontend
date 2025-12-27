import { useEffect, useRef, useCallback, useState } from 'react';
import * as PIXI from 'pixi.js';

// 各種定数・ロジックのインポート
import { COLORS } from '../layout/layout.constants';
import { LAYOUT_PARAMS } from '../layout/layout.config';
import { GAME_UI_CONFIG } from '../game/game.config';
import { calculateCoordinates } from '../layout/layoutEngine';
import { useGameAction } from '../game/actions';
import { CardDetailSheet } from '../ui/CardDetailSheet';
import CONST from '../../shared_constants.json';
import { logger } from '../utils/logger';

// 短縮参照
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
    x: number, 
    y: number, 
    cw: number, 
    ch: number, 
    _isOpponent: boolean, 
    locationType: string, 
    badgeCount = 0
  ) => {
    const container = new PIXI.Container();
    container.x = x;
    container.y = y;

    const bg = new PIXI.Graphics();
    bg.lineStyle(S.BORDER_WIDTH, COLORS.CARD_BORDER);
    // 修正: card.is_rest を参照
    bg.beginFill(card.is_rest === true ? COLORS.RESTED : COLORS.CARD_BG);
    bg.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, S.CORNER_RADIUS);
    bg.endFill();
    container.addChild(bg);

    // 修正: card.is_face_up を参照
    if (card.is_face_up) {
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

      const nTxt = new PIXI.Text(card.name || "", {
        fontSize: card.type === 'RESOURCE' ? S.FONT_SIZE.NAME_RESOURCE : S.FONT_SIZE.NAME,
        fill: COLORS.TEXT_MAIN,
        wordWrap: true,
        wordWrapWidth: cw - S.OFFSET.ATTR_MARGIN
      });
      nTxt.anchor.set(0.5);
      nTxt.y = S.OFFSET.NAME_Y;
      container.addChild(nTxt);

      if (card.cost !== undefined) {
        const cBg = new PIXI.Graphics()
          .beginFill(COLORS.COST_BG)
          .drawCircle(0, 0, S.OFFSET.COST_RADIUS)
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
      const backTxt = new PIXI.Text(T.BACK_SIDE, {
        fontSize: S.FONT_SIZE.BACK,
        fill: 0xFFFFFF,
        align: 'center',
        fontWeight: 'bold'
      });
      backTxt.anchor.set(0.5);
      container.addChild(backTxt);
    }

    if (badgeCount > 0) {
      const bG = new PIXI.Graphics()
        .beginFill(COLORS.BADGE_BG)
        .drawCircle(cw / 2 - S.BADGE.OFFSET, -ch / 2 + S.BADGE.OFFSET, S.BADGE.RADIUS)
        .endFill();
      container.addChild(bG);

      const bT = new PIXI.Text(badgeCount.toString(), {
        fontSize: S.BADGE.FONT_SIZE,
        fill: COLORS.BADGE_TEXT
      });
      bT.anchor.set(0.5);
      bT.x = cw / 2 - S.BADGE.OFFSET;
      bT.y = -ch / 2 + S.BADGE.OFFSET;
      container.addChild(bT);
    }

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

  // --- PIXI アプリケーションの構築 ---
  useEffect(() => {
    if (!pixiContainerRef.current) return;

    logger.log({ level: 'info', action: 'ui.pixi_setup', msg: 'Initializing PIXI Application' });

    const app = new PIXI.Application({
      background: COLORS.BOARD_BG,
      resizeTo: window,
      antialias: true,
    });
    appRef.current = app;
    pixiContainerRef.current.appendChild(app.view as any);

    const mainContainer = new PIXI.Container();
    app.stage.addChild(mainContainer);

    let frameCount = 0;

    app.ticker.add(() => {
      frameCount++;
      if (frameCount % 100 === 0) {
        logger.log({
          level: 'debug',
          action: 'ui.ticker_alive',
          msg: `Render loop is running. Frame: ${frameCount}`,
          payload: { has_state: !!gameState, p1_ready: !!gameState?.players?.p1 }
        });
      }

      mainContainer.removeChildren();
      if (!gameState) {
        const loading = new PIXI.Text(T.CONNECTING, { fill: COLORS.TEXT_MAIN, fontSize: 14 });
        loading.anchor.set(0.5);
        loading.x = app.screen.width / 2;
        loading.y = app.screen.height / 2;
        mainContainer.addChild(loading);
        return;
      }

      const { width: W, height: H } = app.screen;
      const coords = calculateCoordinates(W, H);
      const p1 = gameState.players.p1;
      
      // 各ゾーンを p1.zones 経由で描画
      p1.zones?.life?.forEach((card: any, i: number) => {
        const x = coords.getLifeX(W) + (i * S.OFFSET.ATTACHED_DON);
        mainContainer.addChild(renderCard(card, x, coords.getY(1, H, coords.V_GAP), coords.CW, coords.CH, false, 'life'));
      });

      if (p1.leader) {
        mainContainer.addChild(renderCard(p1.leader, coords.getLeaderX(W), coords.getY(1, H, coords.V_GAP), coords.CW, coords.CH, false, 'leader'));
      }

      p1.zones?.field?.forEach((card: any, i: number) => {
        const x = coords.getFieldX(i, W, coords.CW, p1.zones.field.length);
        mainContainer.addChild(renderCard(card, x, coords.getY(1, H, coords.V_GAP), coords.CW, coords.CH, false, 'field'));
      });

      p1.zones?.hand?.forEach((card: any, i: number) => {
        mainContainer.addChild(renderCard(card, coords.getHandX(i, W), coords.getY(2, H, coords.V_GAP), coords.CW, coords.CH, false, 'hand'));
      });

      // 枚数参照先を電文に合わせて修正
      mainContainer.addChild(renderCard({ is_face_up: false }, coords.getDeckX(W), coords.getY(2, H, coords.V_GAP), coords.CW, coords.CH, false, 'deck', p1.don_deck_count));
      
      const trashArr = p1.zones?.trash || [];
      const topTrash = trashArr.length > 0 ? trashArr[trashArr.length - 1] : { is_face_up: false };
      mainContainer.addChild(renderCard(topTrash, coords.getTrashX(W), coords.getY(2, H, coords.V_GAP), coords.CW, coords.CH, false, 'trash', trashArr.length));
    });

    return () => {
      logger.log({ level: 'info', action: 'ui.pixi_destroy', msg: 'Destroying PIXI Application' });
      app.destroy(true, true);
    };
    // 依存配列から renderCard を外して無限初期化を防止
  }, [gameState]);

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
