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
    // [修正] 以前のコード同様 is_rest (BEの構造) を正しく参照
    bg.beginFill(card.is_rest === true ? COLORS.RESTED : COLORS.CARD_BG);
    bg.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, S.CORNER_RADIUS);
    bg.endFill();
    container.addChild(bg);

    // [修正] 以前のコード同様 is_face_up (BE) または強制表示に対応
    if (card.faceUp || card.is_face_up) {
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
      // [修正] データ階層 players を以前の構成同様正しくチェック
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
      const p1 = gameState.players.p1;
      if (p1) {
        // [修正] rowを0.85に。現在のEngineで「自分側の盤面」として見える位置。
        const yRow1 = coords.getY(0.85, H, coords.V_GAP);

        // Life/Leader/Field を一括描画する考え方を移植
        p1.zones.life?.forEach((card: any, i: number) => {
          const x = coords.getLifeX(W) + (i * S.OFFSET.ATTACHED_DON);
          mainContainer.addChild(renderCard(card, x, yRow1, coords.CW, coords.CH, false, 'life'));
        });

        if (p1.leader) {
          mainContainer.addChild(renderCard(p1.leader, coords.getLeaderX(W), yRow1, coords.CW, coords.CH, false, 'leader'));
        }

        p1.field?.forEach((card: any, i: number) => {
          const x = coords.getFieldX(i, W, coords.CW, p1.field.length);
          mainContainer.addChild(renderCard(card, x, yRow1, coords.CW, coords.CH, false, 'field'));
        });

        // Hand: 以前の row: 4 に相当する「最下部」を、現在のEngineでは 1.05 で実現
        const yRow2 = coords.getY(1.05, H, coords.V_GAP);
        p1.hand?.forEach((card: any, i: number) => {
          const mappedCard = { ...card, faceUp: true }; // 自分には見える
          mainContainer.addChild(renderCard(mappedCard, coords.getHandX(i, W), yRow2, coords.CW, coords.CH, false, 'hand'));
        });

        // Deck/Trash: don_deck_count をバッジとして表示
        mainContainer.addChild(renderCard({ faceUp: false }, coords.getDeckX(W), yRow2, coords.CW, coords.CH, false, 'deck', p1.don_deck_count));
        const trashCards = p1.zones.trash || [];
        const topTrash = trashCards[trashCards.length - 1] || { faceUp: false };
        mainContainer.addChild(renderCard(topTrash, coords.getTrashX(W), yRow2, coords.CW, coords.CH, false, 'trash', trashCards.length));
      }

      // --- P2 (相手) の描画 ---
      const p2 = gameState.players.p2;
      if (p2) {
        // [修正] rowを1.0に。現在のEngineで「相手側の盤面」として見える位置。
        const yOpponentRow1 = coords.getY(1, H, coords.V_GAP);

        p2.zones.life?.forEach((card: any, i: number) => {
          const x = coords.getLifeX(W) + (i * S.OFFSET.ATTACHED_DON);
          mainContainer.addChild(renderCard(card, x, yOpponentRow1, coords.CW, coords.CH, true, 'life'));
        });

        if (p2.leader) {
          mainContainer.addChild(renderCard(p2.leader, coords.getLeaderX(W), yOpponentRow1, coords.CW, coords.CH, true, 'leader'));
        }

        p2.field?.forEach((card: any, i: number) => {
          const x = coords.getFieldX(i, W, coords.CW, p2.field.length);
          mainContainer.addChild(renderCard(card, x, yOpponentRow1, coords.CW, coords.CH, true, 'field'));
        });

        // Hand: 相手の手札は画面最上部 (row: 0.75)
        const yOpponentHand = coords.getY(0.75, H, coords.V_GAP);
        for (let i = 0; i < (p2.hand_count ?? 0); i++) {
          const x = coords.getHandX(i, W);
          mainContainer.addChild(renderCard({ faceUp: false }, x, yOpponentHand, coords.CW, coords.CH, true, 'hand'));
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
