import { useEffect, useRef, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import type { GameState, CardInstance, LeaderCard, BoardCard } from '../types/game';
import { initialGameResponse } from '../mocks/gameState';
import { LAYOUT, COLORS } from '../constants/layout';
import { calculateCoordinates } from '../utils/layoutEngine';

// 描画対象を厳格に定義
type DrawTarget = CardInstance | LeaderCard | BoardCard | { name: string; is_face_up?: boolean; is_rest?: boolean };

export const RealGame = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const gameState: GameState = initialGameResponse.state;

  const urlParams = new URLSearchParams(window.location.search);
  const observerId = urlParams.get('observerId') || 'p1';
  const opponentId = observerId === 'p1' ? 'p2' : 'p1';

  /**
   * 厳格に型定義されたカードレンダラー
   */
  const renderCard = useCallback((
    card: DrawTarget, 
    cw: number, 
    ch: number, 
    isOpponent: boolean = false, 
    badgeCount?: number
  ): PIXI.Container => {
    const container = new PIXI.Container();
    container.eventMode = 'static';
    container.cursor = 'pointer';
    
    // 型ガードを伴うプロパティ参照
    if ('is_rest' in card && card.is_rest) {
      container.rotation = Math.PI / 2;
    }

    const isBackSide = 'is_face_up' in card ? card.is_face_up === false : false;

    const g = new PIXI.Graphics();
    g.lineStyle(2, COLORS.ZONE_BORDER);
    g.beginFill(isBackSide ? COLORS.CARD_BACK : COLORS.ZONE_FILL);
    g.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, 6);
    g.endFill();
    container.addChild(g);

    const content = new PIXI.Container();
    if (isOpponent) content.rotation = Math.PI; 
    container.addChild(content);

    if (!isBackSide) {
      // 安全にプロパティを取り出す
      const name = 'name' in card ? card.name : '';
      const power = 'power' in card ? card.power : undefined;
      const cost = 'cost' in card ? card.cost : undefined;

      const nameTxt = new PIXI.Text(name ?? '', { fontSize: 9, fill: COLORS.TEXT_MAIN, fontWeight: 'bold' });
      nameTxt.anchor.set(0.5, 0); 
      nameTxt.y = ch / 2 - 16; 
      content.addChild(nameTxt);

      if (power !== undefined) {
        const powerTxt = new PIXI.Text(power.toString(), { fontSize: 14, fill: 0x000000, fontWeight: '900' });
        powerTxt.anchor.set(0.5); 
        powerTxt.y = -ch / 4;
        content.addChild(powerTxt);
      }

      if (cost !== undefined) {
        const costTxt = new PIXI.Text(cost.toString(), { fontSize: 9, fill: 0xFFFFFF });
        const costBg = new PIXI.Graphics().beginFill(0x333333).drawCircle(0, 0, 7).endFill();
        costBg.x = -cw / 2 + 10;
        costBg.y = -ch / 2 + 10;
        costTxt.anchor.set(0.5);
        costBg.addChild(costTxt);
        content.addChild(costBg);
      }
    } else {
      const backTxt = new PIXI.Text("ONE\nPIECE", { fontSize: 10, fontWeight: 'bold', fill: 0xFFFFFF, align: 'center' });
      backTxt.anchor.set(0.5); 
      content.addChild(backTxt);
    }

    if (badgeCount !== undefined) {
      const badge = new PIXI.Graphics().beginFill(COLORS.BADGE_BG).drawCircle(0, 0, 8).endFill();
      badge.x = cw / 2 - 4;
      badge.y = ch / 2 - 4;
      const bTxt = new PIXI.Text(badgeCount.toString(), { fontSize: 9, fill: COLORS.BADGE_TEXT, fontWeight: 'bold' });
      bTxt.anchor.set(0.5);
      badge.addChild(bTxt);
      container.addChild(badge);
    }

    return container;
  }, []);

  const drawLayout = useCallback((state: GameState) => {
    const app = appRef.current;
    if (!app) return;
    app.stage.removeChildren();

    const W = app.renderer.width / app.renderer.resolution;
    const H = app.renderer.height / app.renderer.resolution;
    const coords = calculateCoordinates(W, H);
    const { CH, CW, V_GAP, Y_CTRL_START } = coords;

    const bg = new PIXI.Graphics();
    bg.beginFill(COLORS.OPPONENT_BG).drawRect(0, 0, W, Y_CTRL_START).endFill();
    bg.beginFill(COLORS.CONTROL_BG).drawRect(0, Y_CTRL_START, W, LAYOUT.H_CTRL).endFill();
    bg.beginFill(COLORS.PLAYER_BG).drawRect(0, Y_CTRL_START + LAYOUT.H_CTRL, W, H).endFill();
    app.stage.addChild(bg);

    const renderSide = (playerData: GameState['players']['p1' | 'p2'], isOpp: boolean) => {
      const side = new PIXI.Container();
      if (isOpp) {
        side.x = W; side.y = Y_CTRL_START; side.rotation = Math.PI; 
      } else {
        side.y = Y_CTRL_START + LAYOUT.H_CTRL;
      }
      app.stage.addChild(side);

      // Row 1: Field
      playerData.zones.field.forEach((c, i) => {
        const card = renderCard(c, CW, CH, isOpp);
        card.x = coords.getFieldX(i, W); card.y = coords.getY(1, CH, V_GAP);
        side.addChild(card);
      });

      // Row 2: 司令部 (Strictly access through state)
      const r2Y = coords.getY(2, CH, V_GAP);
      const lifeCard = renderCard({ is_face_up: false }, CW, CH, isOpp, playerData.zones.life.length);
      lifeCard.x = coords.getLifeX(W); lifeCard.y = r2Y;
      side.addChild(lifeCard);

      const ldr = renderCard(playerData.leader, CW, CH, isOpp);
      ldr.x = coords.getLeaderX(W); ldr.y = r2Y;
      side.addChild(ldr);

      // Stage: Type-safe access
      const stage = (playerData.zones as any).stage as CardInstance | undefined;
      const stg = renderCard(stage || { name: 'Stage' }, CW, CH, isOpp);
      stg.x = coords.getStageX(W); stg.y = r2Y;
      side.addChild(stg);

      const deckCount = (playerData.zones as any).deck?.length ?? 40;
      const deckCard = renderCard({ is_face_up: false }, CW, CH, isOpp, deckCount);
      deckCard.x = coords.getDeckX(W); deckCard.y = r2Y;
      side.addChild(deckCard);

      // Row 3: Don & Trash
      const r3Y = coords.getY(3, CH, V_GAP);
      const donDk = renderCard({ name: 'DON!!', is_face_up: false }, CW, CH, isOpp, 10);
      donDk.x = coords.getDonDeckX(W); donDk.y = r3Y;
      side.addChild(donDk);

      playerData.don_active.forEach((d, i) => {
        const don = renderCard({ name: 'DON!!', ...d }, CW * 0.8, CH * 0.8, isOpp);
        don.x = coords.getDonDeckX(W) + CW * 0.9 + (i * 12); don.y = r3Y;
        side.addChild(don);
      });

      playerData.don_rested.forEach((d, i) => {
        const don = renderCard({ name: 'DON!!', ...d, is_rest: true }, CW * 0.8, CH * 0.8, isOpp);
        don.x = coords.getDonDeckX(W) + CW * 2.5 + (i * 12); don.y = r3Y;
        side.addChild(don);
      });

      const trashTop = playerData.zones.trash[playerData.zones.trash.length - 1];
      const trash = renderCard(trashTop || { name: 'Trash' }, CW, CH, isOpp);
      trash.x = coords.getTrashX(W); trash.y = r3Y;
      side.addChild(trash);

      // Row 4: Hand
      if (!isOpp) {
        playerData.zones.hand.forEach((c, i) => {
          const card = renderCard(c, CW, CH);
          card.x = coords.getHandX(i, W); card.y = coords.getY(4, CH, V_GAP);
          side.addChild(card);
        });
      }
    };

    renderSide(state.players[opponentId], true);
    renderSide(state.players[observerId], false);

  }, [observerId, opponentId, renderCard]);

  // ... (useEffect, return は変更なし)
