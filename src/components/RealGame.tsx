import { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';

// --- デザイン定量パラメータ ---
const MARGIN_TOP = 50;
const MARGIN_BOTTOM = 40;
const H_CTRL = 60;

const COLORS = {
  OPPONENT_BG: 0xFFEEEE,
  CONTROL_BG:  0xF0F0F0,
  PLAYER_BG:   0xE6F7FF,
  ZONE_BORDER: 0x999999,
  ZONE_FILL:   0xFFFFFF,
  CARD_BACK:   0xDDDDDD,
  TEXT_MAIN:   0x333333,
  BADGE_BG:    0xFF0000,
  BADGE_TEXT:  0xFFFFFF,
};

export const RealGame = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);

  useEffect(() => {
    const handleResize = () => {
      if (appRef.current) {
        appRef.current.renderer.resize(window.innerWidth, window.innerHeight);
        drawLayout(appRef.current);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!containerRef.current || appRef.current) return;
    try {
      const app = new PIXI.Application({
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: 0xFFFFFF,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        antialias: true,
      });
      containerRef.current.appendChild(app.view as HTMLCanvasElement);
      appRef.current = app;
      drawLayout(app);
    } catch (e) {
      console.error("PIXI Init Error:", e);
    }
    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: true, baseTexture: true });
        appRef.current = null;
      }
    };
  }, []);

  const drawLayout = (app: PIXI.Application) => {
    try {
      app.stage.removeChildren();
      const W = app.renderer.width / app.renderer.resolution;
      const H = app.renderer.height / app.renderer.resolution;

      // 2. 垂直方向のサイズ制限
      const AVAILABLE_H_HALF = (H - MARGIN_TOP - MARGIN_BOTTOM - H_CTRL) / 2;
      const CH_LIMIT = AVAILABLE_H_HALF / 4.5;
      const CH = Math.min(CH_LIMIT, (W / 8) * 1.4);
      const CW = CH / 1.4;
      const V_GAP = CH * 0.22; // 行間をカード高さの20%以上確保

      const Y_CTRL_START = MARGIN_TOP + AVAILABLE_H_HALF;
      const Y_PLAYER_START = Y_CTRL_START + H_CTRL;

      // 背景描画
      const bg = new PIXI.Graphics();
      bg.beginFill(COLORS.OPPONENT_BG).drawRect(0, 0, W, Y_CTRL_START).endFill();
      bg.beginFill(COLORS.CONTROL_BG).drawRect(0, Y_CTRL_START, W, H_CTRL).endFill();
      bg.beginFill(COLORS.PLAYER_BG).drawRect(0, Y_PLAYER_START, W, H - Y_PLAYER_START).endFill();
      app.stage.addChild(bg);

      // --- ゾーン生成ヘルパー ---
      const createCardZone = (label: string, options: { 
        isBack?: boolean, badge?: number, isRest?: boolean, power?: string, name?: string, isOpponent?: boolean 
      } = {}) => {
        const container = new PIXI.Container();
        
        // レスト状態の回転 (1.3節)
        if (options.isRest) {
          container.rotation = Math.PI / 2;
        }

        const g = new PIXI.Graphics();
        g.lineStyle(2, COLORS.ZONE_BORDER);
        g.beginFill(options.isBack ? COLORS.CARD_BACK : COLORS.ZONE_FILL);
        g.drawRoundedRect(-CW/2, -CH/2, CW, CH, 6);
        g.endFill();
        container.addChild(g);

        // 内部エレメント用コンテナ
        const content = new PIXI.Container();
        // 相手側の場合はエレメント自体を180度回転 (1.3節, 3.1節)
        if (options.isOpponent) content.rotation = Math.PI;
        container.addChild(content);

        const mainText = new PIXI.Text(options.isBack ? "BACK" : label, {
          fontSize: Math.max(10, CH * 0.14), fontWeight: 'bold', fill: COLORS.TEXT_MAIN
        });
        mainText.anchor.set(0.5);
        content.addChild(mainText);

        if (options.power) {
          const pText = new PIXI.Text(options.power, { fontSize: 9, fill: 0xFF0000, fontWeight: 'bold' });
          pText.anchor.set(0.5, 1);
          pText.y = -CH/2 - 2;
          content.addChild(pText);
        }

        if (options.name) {
          const nText = new PIXI.Text(options.name, { fontSize: 9, fill: COLORS.TEXT_MAIN });
          nText.anchor.set(0.5, 0);
          nText.y = CH/2 + 2;
          content.addChild(nText);
        }

        if (options.badge !== undefined) {
          const b = new PIXI.Graphics().beginFill(COLORS.BADGE_BG).drawCircle(0, 0, 9).endFill();
          b.x = CW/2 - 4; b.y = CH/2 - 4;
          const bt = new PIXI.Text(options.badge.toString(), { fontSize: 9, fill: COLORS.BADGE_TEXT });
          bt.anchor.set(0.5);
          b.addChild(bt);
          content.addChild(b);
        }

        return container;
      };

      // --- 配置ロジック ---
      const getRowY = (rowIdx: number, isPlayer: boolean) => {
        // rowIdx: 1(中央寄り) ~ 4(端寄り)
        const base = isPlayer ? 0 : AVAILABLE_H_HALF;
        const dir = isPlayer ? 1 : -1;
        return (rowIdx - 0.5) * (CH + V_GAP) * dir;
      };

      // 🔵 自分側
      const pSide = new PIXI.Container();
      pSide.y = Y_PLAYER_START;
      app.stage.addChild(pSide);

      // Row 1 (手札): 比率 [0.08, 0.22, 0.36, 0.50, 0.64, 0.78, 0.92]
      [0.08, 0.22, 0.36, 0.5, 0.64, 0.78, 0.92].forEach(ratio => 
        pSide.addChild(Object.assign(createCardZone("Hand", { name: "PLAYER" }), { x: W * ratio, y: (CH + V_GAP) * 3.5 }))
      );
      // Row 2 (リソース): [0.15:DonDeck, 0.35:DonActive, 0.55:DonRest(横), 0.85:Trash]
      pSide.addChild(Object.assign(createCardZone("DonDeck", { badge: 10 }), { x: W * 0.15, y: (CH + V_GAP) * 2.5 }));
      pSide.addChild(Object.assign(createCardZone("DonActive"), { x: W * 0.35, y: (CH + V_GAP) * 2.5 }));
      pSide.addChild(Object.assign(createCardZone("DonRest", { isRest: true }), { x: W * 0.55, y: (CH + V_GAP) * 2.5 }));
      pSide.addChild(Object.assign(createCardZone("Trash", { badge: 0 }), { x: W * 0.85, y: (CH + V_GAP) * 2.5 }));
      // Row 3 (司令部): [0.15:Life, 0.43:Leader, 0.57:Stage, 0.85:Deck]
      pSide.addChild(Object.assign(createCardZone("Life", { badge: 5 }), { x: W * 0.15, y: (CH + V_GAP) * 1.5 }));
      pSide.addChild(Object.assign(createCardZone("Leader", { power: "POWER 5000", name: "LUFFY" }), { x: W * 0.43, y: (CH + V_GAP) * 1.5 }));
      pSide.addChild(Object.assign(createCardZone("Stage"), { x: W * 0.57, y: (CH + V_GAP) * 1.5 }));
      pSide.addChild(Object.assign(createCardZone("Deck", { isBack: true, badge: 40 }), { x: W * 0.85, y: (CH + V_GAP) * 1.5 }));
      // Row 4 (キャラ): [0.15, 0.50]
      [0.15, 0.50].forEach(ratio => 
        pSide.addChild(Object.assign(createCardZone("Char"), { x: W * ratio, y: (CH + V_GAP) * 0.5 }))
      );

      // 🔴 相手側 (180度回転・点対称)
      const oSide = new PIXI.Container();
      oSide.x = W; oSide.y = Y_CTRL_START; oSide.rotation = Math.PI;
      app.stage.addChild(oSide);

      const oRowY = (idx: number) => (idx - 0.5) * (CH + V_GAP);

      // Row 1 (手札): 自分(1-ratio)
      [0.08, 0.22, 0.36, 0.5, 0.64, 0.78, 0.92].forEach(ratio => 
        oSide.addChild(Object.assign(createCardZone("Hand", { isBack: true, isOpponent: true, name: "ENEMY" }), { x: W * ratio, y: oRowY(4) }))
      );
      // Row 2 (リソース): 点対称 [0.15:DonDeck, 0.35:DonActive, 0.55:DonRest(横), 0.85:Trash]
      oSide.addChild(Object.assign(createCardZone("DonDeck", { badge: 10, isOpponent: true }), { x: W * 0.15, y: oRowY(3) }));
      oSide.addChild(Object.assign(createCardZone("DonActive", { isOpponent: true }), { x: W * 0.35, y: oRowY(3) }));
      oSide.addChild(Object.assign(createCardZone("DonRest", { isRest: true, isOpponent: true }), { x: W * 0.55, y: oRowY(3) }));
      oSide.addChild(Object.assign(createCardZone("Trash", { badge: 0, isOpponent: true }), { x: W * 0.85, y: oRowY(3) }));
      // Row 3 (司令部): [0.15:Deck, 0.43:Stage, 0.57:Leader, 0.85:Life]
      oSide.addChild(Object.assign(createCardZone("Deck", { isBack: true, badge: 40, isOpponent: true }), { x: W * 0.15, y: oRowY(2) }));
      oSide.addChild(Object.assign(createCardZone("Stage", { isOpponent: true }), { x: W * 0.43, y: oRowY(2) }));
      oSide.addChild(Object.assign(createCardZone("Leader", { power: "POWER 7000", name: "KAIDO", isOpponent: true }), { x: W * 0.57, y: oRowY(2) }));
      oSide.addChild(Object.assign(createCardZone("Life", { isBack: true, badge: 5, isOpponent: true }), { x: W * 0.85, y: oRowY(2) }));
      // Row 4 (キャラ)
      [0.15, 0.50].forEach(ratio => 
        oSide.addChild(Object.assign(createCardZone("Char", { isOpponent: true }), { x: W * ratio, y: oRowY(1) }))
      );

      // 中央バーのボタン
      const cBar = new PIXI.Container();
      cBar.y = Y_CTRL_START;
      app.stage.addChild(cBar);
      const btns = ["Close", "Settings", "Reset", "Back", "View", "Next"];
      const bW = W / 7;
      btns.forEach((label, i) => {
        const b = new PIXI.Container();
        b.x = (W / 2) - (bW * 2.5) + (i * bW); b.y = H_CTRL / 2;
        const bgB = new PIXI.Graphics().beginFill(0xFFFFFF).lineStyle(1, 0xCCCCCC).drawRoundedRect(-bW/2.4, -15, bW/1.2, 30, 8).endFill();
        const t = new PIXI.Text(label, { fontSize: 10, fill: 0x333333 });
        t.anchor.set(0.5); b.addChild(bgB, t);
        cBar.addChild(b);
      });

    } catch (e) { console.error(e); }
  };

  return <div ref={containerRef} style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, background: '#000' }} />;
};
