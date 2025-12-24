import { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';

// --- デザイン定量パラメータ ---
const SAFE_AREA_TOP = 44;
const COLORS = {
  OPPONENT_BG: 0xFFEEEE, // ピンク
  CONTROL_BG:  0xF0F0F0, // グレー
  PLAYER_BG:   0xE6F7FF, // ブルー
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

  // --- リサイズ処理 ---
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

  // --- 初期化 ---
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

      const H_CTRL = 60;
      const REMAINING_H = H - H_CTRL;
      const H_HALF = REMAINING_H / 2;

      // エリア開始座標
      const Y_OPP_START = 0;
      const Y_CTRL_START = H_HALF;
      const Y_PLAYER_START = H_HALF + H_CTRL;
      const H_PLAYER_TOTAL = H - Y_PLAYER_START;

      // --- 1. 背景描画 ---
      const bg = new PIXI.Graphics();
      // 相手側エリア
      bg.beginFill(COLORS.OPPONENT_BG).drawRect(0, Y_OPP_START, W, H_HALF).endFill();
      // コントロールエリア
      bg.beginFill(COLORS.CONTROL_BG).drawRect(0, Y_CTRL_START, W, H_CTRL).endFill();
      // 自分側エリア (修正: 第4引数 H_PLAYER_TOTAL を追加)
      bg.beginFill(COLORS.PLAYER_BG).drawRect(0, Y_PLAYER_START, W, H_PLAYER_TOTAL).endFill();
      app.stage.addChild(bg);

      // --- 2. カードサイズと動的マージン定義 ---
      const CW = W / 7.5;
      const CH = CW * 1.4;
      const GAP_X = (W - (CW * 7)) / 8;
      
      // 行間（Padding）の計算
      const PADDING_Y = (H_HALF - (CH * 3.2)) / 5; 

      // --- 3. ゾーン生成関数 ---
      const createCardZone = (label: string, options: { 
        isBack?: boolean, 
        badge?: number, 
        isRest?: boolean, 
        power?: string, 
        name?: string,
        isOpponent?: boolean 
      } = {}) => {
        const container = new PIXI.Container();
        const w = options.isRest ? CH : CW;
        const h = options.isRest ? CW : CH;

        const g = new PIXI.Graphics();
        g.lineStyle(2, COLORS.ZONE_BORDER);
        g.beginFill(options.isBack ? COLORS.CARD_BACK : COLORS.ZONE_FILL);
        g.drawRoundedRect(-w/2, -h/2, w, h, 6);
        g.endFill();
        container.addChild(g);

        const content = new PIXI.Container();
        container.addChild(content);

        const mainText = new PIXI.Text(options.isBack ? "BACK" : label, {
          fontSize: 12, fontWeight: 'bold', fill: COLORS.TEXT_MAIN
        });
        mainText.anchor.set(0.5);
        content.addChild(mainText);

        if (options.power) {
          const pText = new PIXI.Text(options.power, { fontSize: 10, fill: 0xFF0000, fontWeight: 'bold' });
          pText.anchor.set(0.5, 1);
          pText.y = -h/2 + 12;
          content.addChild(pText);
        }

        if (options.name) {
          const nText = new PIXI.Text(options.name, { fontSize: 9, fill: COLORS.TEXT_MAIN });
          nText.anchor.set(0.5, 0);
          nText.y = h/2 + 4;
          content.addChild(nText);
        }

        if (options.badge !== undefined) {
          const b = new PIXI.Graphics().beginFill(COLORS.BADGE_BG).drawCircle(0, 0, 10).endFill();
          b.x = w/2 - 5; b.y = h/2 - 5;
          const bt = new PIXI.Text(options.badge.toString(), { fontSize: 10, fill: COLORS.BADGE_TEXT });
          bt.anchor.set(0.5);
          b.addChild(bt);
          content.addChild(b);
        }

        if (options.isOpponent) {
          content.rotation = Math.PI;
        }

        return container;
      };

      const getX = (idx: number, total: number) => {
        const startX = (W - (total * CW + (total - 1) * GAP_X)) / 2 + CW / 2;
        return startX + idx * (CW + GAP_X);
      };

      // --- 4. 自分側 (PLAYER) ---
      const pSide = new PIXI.Container();
      pSide.y = Y_PLAYER_START;
      app.stage.addChild(pSide);

      const py = (row: number) => PADDING_Y * row + CH * (row - 0.5);

      // Row 4
      for (let i = 0; i < 5; i++) pSide.addChild(Object.assign(createCardZone("Char"), { x: getX(i + 1, 7), y: py(1) }));
      // Row 3
      pSide.addChild(Object.assign(createCardZone("Leader", { power: "POWER 5000", name: "LUFFY" }), { x: getX(3, 7), y: py(2) }));
      pSide.addChild(Object.assign(createCardZone("Stage"), { x: getX(2, 7), y: py(2) }));
      // Row 2
      const pRes = [
        {l: "DonDeck", b: 10}, {l: "DonActive", b: 0}, {l: "DonRest", b: 0, r: true}, 
        {l: "Life", b: 5}, {l: "Deck", b: 40, f: true}, {l: "Trash", b: 0}
      ];
      pRes.forEach((el, i) => pSide.addChild(Object.assign(createCardZone(el.l, { isBack: el.f, isRest: el.r, badge: el.b }), { x: getX(i + 0.5, 7), y: py(3) })));
      // Row 1
      for (let i = 0; i < 7; i++) pSide.addChild(Object.assign(createCardZone("Hand", { name: "PLAYER" }), { x: getX(i, 7), y: py(4) }));

      // --- 5. 相手側 (OPPONENT) ---
      const oSide = new PIXI.Container();
      oSide.x = W; oSide.y = Y_CTRL_START;
      oSide.rotation = Math.PI;
      app.stage.addChild(oSide);

      const oy = (row: number) => SAFE_AREA_TOP + PADDING_Y * row + CH * (row - 0.5);

      // Row 4
      for (let i = 0; i < 5; i++) oSide.addChild(Object.assign(createCardZone("Char", { isOpponent: true }), { x: getX(i + 1, 7), y: oy(1) }));
      // Row 3
      oSide.addChild(Object.assign(createCardZone("Leader", { power: "POWER 7000", name: "KAIDO", isOpponent: true }), { x: getX(3, 7), y: oy(2) }));
      oSide.addChild(Object.assign(createCardZone("Stage", { isOpponent: true }), { x: getX(4, 7), y: oy(2) }));
      // Row 2
      const oRes = [
        {l: "Trash", b: 0}, {l: "Deck", b: 40, f: true}, {l: "Life", b: 5, f: true}, 
        {l: "DonRest", b: 0, r: true}, {l: "DonActive", b: 0}, {l: "DonDeck", b: 10}
      ];
      oRes.forEach((el, i) => oSide.addChild(Object.assign(createCardZone(el.l, { isBack: el.f, isRest: el.r, badge: el.b, isOpponent: true }), { x: getX(i + 0.5, 7), y: oy(3) })));
      // Row 1
      for (let i = 0; i < 7; i++) oSide.addChild(Object.assign(createCardZone("Hand", { isBack: true, name: "OPPONENT", isOpponent: true }), { x: getX(i, 7), y: oy(4) }));

      // --- 6. 中央コントロールバー ---
      const cBar = new PIXI.Container();
      cBar.y = Y_CTRL_START;
      app.stage.addChild(cBar);
      const btns = ["Close", "Settings", "Reset", "Back", "View", "NextTurn"];
      const bW = W / 7;
      btns.forEach((label, i) => {
        const b = new PIXI.Container();
        b.x = (W / 2) - (bW * 3) + (i * bW) + bW/2; b.y = H_CTRL / 2;
        const bgB = new PIXI.Graphics().beginFill(0xFFFFFF).lineStyle(1, 0xCCCCCC).drawRoundedRect(-bW/2.2, -15, bW/1.1, 30, 8).endFill();
        const t = new PIXI.Text(label, { fontSize: 10, fill: 0x333333 });
        t.anchor.set(0.5); b.addChild(bgB, t);
        cBar.addChild(b);
      });

    } catch (e) {
      console.error("Layout Error:", e);
    }
  };

  return <div ref={containerRef} style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, background: '#000' }} />;
};
