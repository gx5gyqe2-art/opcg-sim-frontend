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
    // バックエンドのプロパティ名 is_rest に対応
    bg.beginFill(card.is_rest === true ? COLORS.RESTED : COLORS.CARD_BG);
    bg.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, S.CORNER_RADIUS);
    bg.endFill();
    container.addChild(bg);

    // card.faceUp (FE) または card.is_face_up (BE) に対応
    if (card.faceUp || card.is_face_up) {
      // パワー
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

      // 名前
      const nTxt = new PIXI.Text(card.name || "", {
        fontSize: card.type === 'RESOURCE' ? S.FONT_SIZE.NAME_RESOURCE : S.FONT_SIZE.NAME,
        fill: COLORS.TEXT_MAIN,
        wordWrap: true,
        wordWrapWidth: cw - S.OFFSET.ATTR_MARGIN
      });
      nTxt.anchor.set(0.5);
      nTxt.y = S.OFFSET.NAME_Y;
      container.addChild(nTxt);

      // コスト
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
      // 裏面
      const backTxt = new PIXI.Text(T.BACK_SIDE, {
        fontSize: S.FONT_SIZE.BACK,
        fill: 0xFFFFFF,
        align: 'center',
        fontWeight: 'bold'
      });
      backTxt.anchor.set(0.5);
      container.addChild(backTxt);
    }

    // 枚数バッジ
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
      // players 階層の存在をチェック
      if (!gameState || !gameState.players) {
        const loading = new PIXI.Text(T.CONNECTING, { fill: COLORS.TEXT_MAIN, fontSize: 14 });
        loading.anchor.set(0.5);
        loading.x = app.screen.width / 2;
        loading.y = app.screen.height / 2;
        mainContainer.addChild(loading);
        return;
      }

      const { width: W, height: H } = app.screen;
      const coords = calculateCoordinates(W, H);

      // --- P1 (自分) の描画 ---
      // 階層を gameState.players.p1 に修正
      const p1 = gameState.players.p1;
      if (p1) {
        // Life: row を 1.2 に下げて画面下半分へ
        p1.zones.life?.forEach((card: any, i: number) => {
          const x = coords.getLifeX(W) + (i * S.OFFSET.ATTACHED_DON);
          mainContainer.addChild(renderCard(card, x, coords.getY(1.2, H, coords.V_GAP), coords.CW, coords.CH, false, 'life'));
        });

        // Leader
        if (p1.leader) {
          mainContainer.addChild(renderCard(p1.leader, coords.getLeaderX(W), coords.getY(1.2, H, coords.V_GAP), coords.CW, coords.CH, false, 'leader'));
        }

        // Field
        p1.field?.forEach((card: any, i: number) => {
          const x = coords.getFieldX(i, W, coords.CW, p1.field.length);
          mainContainer.addChild(renderCard(card, x, coords.getY(1.2, H, coords.V_GAP), coords.CW, coords.CH, false, 'field'));
        });

        // Hand: row を 1.5 に下げて配置
        p1.hand?.forEach((card: any, i: number) => {
          // 自分には見えるので強制表示用フラグを付与
          const mappedCard = { ...card, faceUp: true };
          mainContainer.addChild(renderCard(mappedCard, coords.getHandX(i, W), coords.getY(1.5, H, coords.V_GAP), coords.CW, coords.CH, false, 'hand'));
        });

        // Deck & Trash: バックエンドの don_deck_count を参照
        mainContainer.addChild(renderCard({ faceUp: false }, coords.getDeckX(W), coords.getY(1.5, H, coords.V_GAP), coords.CW, coords.CH, false, 'deck', p1.don_deck_count));
        const trashCards = p1.zones.trash || [];
        const topTrash = trashCards[trashCards.length - 1] || { faceUp: false };
        mainContainer.addChild(renderCard(topTrash, coords.getTrashX(W), coords.getY(1.5, H, coords.V_GAP), coords.CW, coords.CH, false, 'trash', trashCards.length));
      }

      // --- P2 (相手) の描画 ---
      // 階層を gameState.players.p2 に修正
      const p2 = gameState.players.p2;
      if (p2) {
        // Life: row 0.8 で画面上側に配置
        p2.zones.life?.forEach((card: any, i: number) => {
          const x = coords.getLifeX(W) + (i * S.OFFSET.ATTACHED_DON);
          mainContainer.addChild(renderCard(card, x, coords.getY(0.8, H, coords.V_GAP), coords.CW, coords.CH, true, 'life'));
        });

        if (p2.leader) {
          mainContainer.addChild(renderCard(p2.leader, coords.getLeaderX(W), coords.getY(0.8, H, coords.V_GAP), coords.CW, coords.CH, true, 'leader'));
        }

        p2.field?.forEach((card: any, i: number) => {
          const x = coords.getFieldX(i, W, coords.CW, p2.field.length);
          mainContainer.addChild(renderCard(card, x, coords.getY(0.8, H, coords.V_GAP), coords.CW, coords.CH, true, 'field'));
        });

        // Hand: row 0.5 で最上部へ配置
        for (let i = 0; i < (p2.hand_count ?? 0); i++) {
          const x = coords.getHandX(i, W);
          mainContainer.addChild(renderCard({ faceUp: false }, x, coords.getY(0.5, H, coords.V_GAP), coords.CW, coords.CH, true, 'hand'));
        }
      }
    });

    return () => app.destroy(true, true);
  }, [gameState, renderCard, startGame, isPending]);

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
