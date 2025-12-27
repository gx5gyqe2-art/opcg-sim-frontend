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
    bg.beginFill(card.isUpright === false ? COLORS.RESTED : COLORS.CARD_BG);
    bg.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, S.CORNER_RADIUS);
    bg.endFill();
    container.addChild(bg);

    if (card.faceUp) {
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

      // --- P1 (自分) の描画 ---
      const p1 = gameState.players.p1;
      
      // Life
      p1.zones.life?.forEach((card: any, i: number) => {
        const x = coords.getLifeX(W) + (i * S.OFFSET.ATTACHED_DON);
        mainContainer.addChild(renderCard(card, x, coords.getY(1, H, coords.V_GAP), coords.CW, coords.CH, false, 'life'));
      });

      // Leader
      if (p1.leader) {
        mainContainer.addChild(renderCard(p1.leader, coords.getLeaderX(W), coords.getY(1, H, coords.V_GAP), coords.CW, coords.CH, false, 'leader'));
      }

      // Field
      p1.field?.forEach((card: any, i: number) => {
        const x = coords.getFieldX(i, W, coords.CW, p1.field.length);
        mainContainer.addChild(renderCard(card, x, coords.getY(1, H, coords.V_GAP), coords.CW, coords.CH, false, 'field'));
      });

      // Hand
      p1.hand?.forEach((card: any, i: number) => {
        mainContainer.addChild(renderCard(card, coords.getHandX(i, W), coords.getY(2, H, coords.V_GAP), coords.CW, coords.CH, false, 'hand'));
      });

      // Deck & Trash
      mainContainer.addChild(renderCard({ faceUp: false }, coords.getDeckX(W), coords.getY(2, H, coords.V_GAP), coords.CW, coords.CH, false, 'deck', p1.deck_count));
      const topTrash = p1.zones.trash?.[p1.zones.trash.length - 1] || { faceUp: false };
      mainContainer.addChild(renderCard(topTrash, coords.getTrashX(W), coords.getY(2, H, coords.V_GAP), coords.CW, coords.CH, false, 'trash', p1.zones.trash?.length));

      // --- P2 (相手) の描画 (Y座標反転等はEngineで吸収している前提) ---
      // ※ 簡易化のため同様のロジックでP2も描画（座標計算側で調整が必要な場合は Engine を修正）
    });
      // --- P2 (相手) の描画 ---
      const p2 = gameState.players.p2;
      if (!p2) return;

      // Life (相手)
      p2.zones.life?.forEach((card: any, i: number) => {
        const x = coords.getLifeX(W) + (i * S.OFFSET.ATTACHED_DON);
        // 1行目に描画（ Engine が P2 用の Y 座標を計算する前提、または P1 と対称に配置）
        mainContainer.addChild(renderCard(card, x, coords.getY(0.2, H, coords.V_GAP), coords.CW, coords.CH, true, 'life'));
      });

      // Leader (相手)
      if (p2.leader) {
        mainContainer.addChild(renderCard(p2.leader, coords.getLeaderX(W), coords.getY(0.2, H, coords.V_GAP), coords.CW, coords.CH, true, 'leader'));
      }

      // Field (相手)
      p2.field?.forEach((card: any, i: number) => {
        const x = coords.getFieldX(i, W, coords.CW, p2.field.length);
        mainContainer.addChild(renderCard(card, x, coords.getY(0.2, H, coords.V_GAP), coords.CW, coords.CH, true, 'field'));
      });

      // Hand (相手 - 枚数のみ表示される想定)
      for (let i = 0; i < (p2.hand_count ?? 0); i++) {
        const x = coords.getHandX(i, W);
        mainContainer.addChild(renderCard({ faceUp: false }, x, coords.getY(-0.5, H, coords.V_GAP), coords.CW, coords.CH, true, 'hand'));
      }

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
