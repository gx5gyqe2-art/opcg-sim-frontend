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

      const AVAILABLE_H_HALF = (H - H_CTRL - MARGIN_TOP - MARGIN_BOTTOM) / 2;
      
      // レスポンシブサイズ計算: 4行分+ラベル+隙間が収まる高さを算出
      const CW_MAX = W / 8;
      const CH_MAX = AVAILABLE_H_HALF / 4.8; // ラベルとパディング分を考慮
      const CH = Math.min(CH_MAX, CW_MAX * 1.4);
      const CW = CH / 1.4;
      const GAP_X = (W - (CW * 7.5)) / 8;
      const PADDING_Y = (AVAILABLE_H_HALF - (CH * 4)) / 5;

      const Y_OPP_AREA_END = MARGIN_TOP + AVAILABLE_H_HALF;
      const Y_CTRL_START = Y_OPP_AREA_END;
      const Y_PLAYER_AREA_START = Y_CTRL_START + H_CTRL;

      // 背景描画
      const bg = new PIXI.Graphics();
      bg.beginFill(COLORS.OPPONENT_BG).drawRect(0, 0, W, Y_CTRL_START).endFill();
      bg.beginFill(COLORS.CONTROL_BG).drawRect(0, Y_CTRL_START, W, H_CTRL).endFill();
      bg.beginFill(COLORS.PLAYER_BG).drawRect(0, Y_PLAYER_START, W, H - Y_PLAYER_START).endFill();
      app.stage.addChild(bg);

      const createCardZone = (label: string, options: { 
        isBack?: boolean, badge?: number, isRest?: boolean, power?: string, name?: string, isOpponent?: boolean 
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
          fontSize: Math.max(10, CH * 0.15), fontWeight: 'bold', fill: COLORS.TEXT_MAIN
        });
        mainText.anchor.set(0.5);
        content.addChild(mainText);

        if (options.power) {
          const pText = new PIXI.Text(options.power, { fontSize: 9, fill: 0xFF0000, fontWeight: 'bold' });
          pText.anchor.set(0.5, 1);
          pText.y = -h / 2 - 2;
          content.addChild(pText);
        }

        if (options.name) {
          const nText = new PIXI.Text(options.name, { fontSize: 9, fill: COLORS.TEXT_MAIN });
          nText.anchor.set(0.5, 0);
          nText.y = h / 2 + 2;
          content.addChild(nText);
        }

        if (options.badge !== undefined) {
          const b = new PIXI.Graphics().beginFill(COLORS.BADGE_BG).drawCircle(0, 0, 8).endFill();
          b.x = w / 2 - 4; b.y = h / 2 - 4;
          const bt = new PIXI.Text(options.badge.toString(), { fontSize: 8, fill: COLORS.BADGE_TEXT });
          bt.anchor.set(0.5);
          b.addChild(bt);
          content.addChild(b);
        }

        if (options.isOpponent) content.rotation = Math.PI;
        return container;
      };

      const getX = (idx: number, total: number) => {
        const startX = (W - (total * CW + (total - 1) * GAP_X)) / 2 + CW / 2;
        return startX + idx * (CW + GAP_X);
      };

      // --- 相手側 (180度回転) ---
      const oSide = new PIXI.Container();
      oSide.x = W; oSide.y = Y_CTRL_START; oSide.rotation = Math.PI;
      app.stage.addChild(oSide);
      const oy = (row: number) => PADDING_Y * row + CH * (row - 0.5);

      // Row 4: Char (中央寄り)
      for (let i = 0; i < 5; i++) oSide.addChild(Object.assign(createCardZone("Char", { isOpponent: true }), { x: getX(i + 1, 7), y: oy(1) }));
      // Row 3: Resource 2
      const oRes3 = [{l:"Deck", f:true, b:40}, {l:"Stage"}, {l:"Leader", p:"POWER 7000", n:"KAIDO"}, {l:"Life", f:true, b:5}];
      oRes3.forEach((el, i) => oSide.addChild(Object.assign(createCardZone(el.l, { isBack: el.f, badge: el.b, power: el.p, name: el.n, isOpponent: true }), { x: getX(i + 1.5, 7), y: oy(2) })));
      // Row 2: Resource 1
      const oRes2 = [{l:"Trash", b:0}, {l:"DonRest", r:true}, {l:"DonActive", b:0}, {l:"DonDeck", b:10}];
      oRes2.forEach((el, i) => oSide.addChild(Object.assign(createCardZone(el.l, { isRest: el.r, badge: el.b, isOpponent: true }), { x: getX(i + 1.5, 7), y: oy(3) })));
      // Row 1: Hand (最上段)
      for (let i = 0; i < 7; i++) oSide.addChild(Object.assign(createCardZone("Hand", { isBack: true, isOpponent: true, name: "OPPONENT" }), { x: getX(i, 7), y: oy(4) }));

      // --- 自分側 ---
      const pSide = new PIXI.Container();
      pSide.y = Y_PLAYER_START;
      app.stage.addChild(pSide);
      const py = (row: number) => PADDING_Y * row + CH * (row - 0.5);

      // Row 4: Char (中央寄り)
      for (let i = 0; i < 5; i++) pSide.addChild(Object.assign(createCardZone("Char"), { x: getX(i + 1, 7), y: py(1) }));
      // Row 3: Resource 2
      const pRes3 = [{l:"Life", b:5}, {l:"Leader", p:"POWER 5000", n:"LUFFY"}, {l:"Stage"}, {l:"Deck", f:true, b:40}];
      pRes3.forEach((el, i) => pSide.addChild(Object.assign(createCardZone(el.l, { isBack: el.f, badge: el.b, power: el.p, name: el.n }), { x: getX(i + 1.5, 7), y: py(2) })));
      // Row 2: Resource 1
      const pRes2 = [{l:"DonDeck", b:10}, {l:"DonActive", b:0}, {l:"DonRest", r:true}, {l:"Trash", b:0}];
      pRes2.forEach((el, i) => pSide.addChild(Object.assign(createCardZone(el.l, { isRest: el.r, badge: el.b }), { x: getX(i + 1.5, 7), y: py(3) })));
      // Row 1: Hand (最下段)
      for (let i = 0; i < 7; i++) pSide.addChild(Object.assign(createCardZone("Hand", { name: "PLAYER" }), { x: getX(i, 7), y: py(4) }));

      // 操作バー
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
