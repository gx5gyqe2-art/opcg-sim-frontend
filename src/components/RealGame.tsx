import { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';

// --- 定数・カラー定義 ---
const SAFE_AREA_TOP = 44; // レイアウト計算上のノッチ回避用
const LOG_AREA_WIDTH = 220; // 右上のデバッグログ回避用マージン

const COLORS = {
  OPPONENT_BG: 0xFFEEEE, // 薄いピンク
  CONTROL_BG:  0xF0F0F0, // 薄いグレー
  PLAYER_BG:   0xE6F7FF, // 薄いブルー
  
  ZONE_BORDER: 0x999999,
  ZONE_FILL:   0xFFFFFF,
  CARD_BACK:   0xDDDDDD, // 裏面色
  
  TEXT_MAIN:   0x333333,
  TEXT_BACK:   0x666666,
  
  BADGE_BG:    0xFF0000,
  BADGE_TEXT:  0xFFFFFF,
  
  PLAYER_TINT: 0x4488FF,
  ENEMY_TINT:  0xFF4444,
  DON_TINT:    0xCCCCCC,
};

// ゾーン識別ラベル
const LABELS = {
  LEADER: "Leader",
  STAGE: "Stage",
  DECK: "Deck",
  TRASH: "Trash",
  LIFE: "Life",
  DON: "Don",
  COST: "Cost",
  BACK: "BACK",
};

export const RealGame = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);

  // --- 1. リサイズ監視 ---
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

  // --- 2. PixiJS 初期化 ---
  useEffect(() => {
    if (!containerRef.current || appRef.current) return;

    try {
      console.log('[PixiJS] Initializing Renewed Layout...');

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

    } catch (e: any) {
      console.error("PIXI INIT ERROR:", e);
      if (containerRef.current) {
        containerRef.current.innerHTML = `<div style="color:red; padding:20px;">Init Error: ${e.message}</div>`;
      }
    }

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: true, baseTexture: true });
        appRef.current = null;
      }
    };
  }, []);


  // =========================================================
  // 🎨 レイアウト描画ロジック
  // =========================================================
  const drawLayout = (app: PIXI.Application) => {
    try {
      app.stage.removeChildren();

      const W = app.renderer.width / app.renderer.resolution;
      const H = app.renderer.height / app.renderer.resolution;
      
      // コントロールエリアの高さ（固定）
      const H_CTRL = 60;
      
      // 残りのエリアを分割
      const REMAINING_H = H - H_CTRL;
      // 相手エリア比率 (少し広めに)
      const H_OPP_TOTAL = REMAINING_H * 0.45;
      const H_PLAYER_TOTAL = REMAINING_H - H_OPP_TOTAL;

      const Y_OPP_START = 0;
      const Y_CTRL_START = H_OPP_TOTAL;
      const Y_PLAYER_START = H_OPP_TOTAL + H_CTRL;

      // --- 3. 背景描画 (全画面塗る) ---
      const bg = new PIXI.Graphics();
      
      // Opponent Area (Top to Ctrl)
      bg.beginFill(COLORS.OPPONENT_BG);
      bg.drawRect(0, Y_OPP_START, W, H_OPP_TOTAL); // 修正: 0 -> Y_OPP_START
      bg.endFill();

      // Control Area (Middle)
      bg.beginFill(COLORS.CONTROL_BG);
      bg.drawRect(0, Y_CTRL_START, W, H_CTRL);
      bg.endFill();

      // Player Area (Bottom)
      bg.beginFill(COLORS.PLAYER_BG);
      bg.drawRect(0, Y_PLAYER_START, W, H_PLAYER_TOTAL);
      bg.endFill();

      app.stage.addChild(bg);


      // --- 4. サイズ計算 ---
      // 画面幅を基準にカードサイズを決定 (Gap込みで8枚分程度と仮定)
      const GAP_BASE = W * 0.015; // 1.5% Gap
      const SLOT_W = (W - (GAP_BASE * 8)) / 7.2; 
      
      const CW = SLOT_W;
      const CH = CW * 1.4; // アスペクト比 1:1.4 固定
      
      // ドン!!カードサイズ (80%)
      const DON_W = CW * 0.8;
      const DON_H = CH * 0.8;


      // --- 5. ゾーン生成ヘルパー ---
      const createZone = (
        cx: number, cy: number, 
        w: number, h: number, 
        label: string, 
        tint: number,
        options: { isFaceDown?: boolean, badge?: number } = {}
      ) => {
        const container = new PIXI.Container();
        container.position.set(cx, cy);

        const isBack = options.isFaceDown;
        const fillColor = isBack ? COLORS.CARD_BACK : COLORS.ZONE_FILL;
        const strokeColor = isBack ? 0x666666 : (tint || COLORS.ZONE_BORDER);
        const textStr = isBack ? LABELS.BACK : label;
        const textColor = isBack ? COLORS.TEXT_BACK : COLORS.TEXT_MAIN;

        // 背景
        const g = new PIXI.Graphics();
        g.lineStyle(isBack ? 2 : 2, strokeColor, 0.8);
        g.beginFill(fillColor, isBack ? 1.0 : 0.5);
        g.drawRoundedRect(-w/2, -h/2, w, h, 6);
        
        // 裏面の場合は模様などを描画
        if (isBack) {
           g.lineStyle(1, 0x999999, 0.3);
           g.moveTo(-w/2 + 5, -h/2 + 5);
           g.lineTo(w/2 - 5, h/2 - 5);
           g.moveTo(w/2 - 5, -h/2 + 5);
           g.lineTo(-w/2 + 5, h/2 - 5);
        }
        g.endFill();
        container.addChild(g);

        // ラベル
        const fontSize = Math.min(12, w * 0.25);
        const text = new PIXI.Text(textStr, {
          fontFamily: 'Arial',
          fontSize: fontSize,
          fill: textColor,
          fontWeight: 'bold',
        });
        text.anchor.set(0.5);
        container.addChild(text);

        // バッジ (右下)
        if (options.badge !== undefined) {
          const badge = new PIXI.Container();
          badge.position.set(w/2 - 6, h/2 - 6);

          const badgeBg = new PIXI.Graphics();
          badgeBg.beginFill(COLORS.BADGE_BG);
          badgeBg.drawCircle(0, 0, 10);
          badgeBg.endFill();
          badge.addChild(badgeBg);

          const num = new PIXI.Text(options.badge.toString(), {
            fontFamily: 'Arial', fontSize: 10, fill: COLORS.BADGE_TEXT, fontWeight: 'bold'
          });
          num.anchor.set(0.5);
          badge.addChild(num);
          
          container.addChild(badge);
        }

        return container;
      };


      // ============================================
      // 🔴 相手側 (OPPONENT) - 180度回転
      // ============================================
      const oppContainer = new PIXI.Container();
      // コンテナ原点を画面右側・コントロールエリアの上辺に設定し、回転
      oppContainer.position.set(W, Y_CTRL_START); 
      oppContainer.rotation = Math.PI;
      app.stage.addChild(oppContainer);

      // 配置可能エリアの高さ
      const OPP_AVAIL_H = H_OPP_TOTAL - SAFE_AREA_TOP;
      
      // 行のY座標 (コンテナ内)
      const O_ROW3_Y = OPP_AVAIL_H * 0.2 + SAFE_AREA_TOP * 0.2; // Char
      const O_ROW2_Y = OPP_AVAIL_H * 0.55 + SAFE_AREA_TOP * 0.5; // Main
      const O_ROW1_Y = OPP_AVAIL_H * 0.90 + SAFE_AREA_TOP; // Hand

      // X座標計算ヘルパー
      // 修正: 未使用の isRightAligned 引数を削除
      const getSlotX = (index: number, count: number, extraMargin = 0) => {
        const totalW = count * CW + (count - 1) * GAP_BASE;
        const startX = (W - totalW) / 2;
        
        let x = startX + index * (CW + GAP_BASE) + CW/2;
        if (extraMargin > 0) {
           x += extraMargin; 
        }
        return x;
      };

      // --- Row 3: Characters (5枚) ---
      for (let i = 0; i < 5; i++) {
        oppContainer.addChild(createZone(
          getSlotX(i, 5), O_ROW3_Y, CW, CH, "Char", COLORS.ENEMY_TINT
        ));
      }

      // --- Row 2: Main (Trash, Deck, Stage, Leader, Life, Don, Cost) ---
      const O_MAIN_ELEMENTS = [
        { label: LABELS.COST, w: DON_W, h: DON_H, tint: COLORS.DON_TINT },
        { label: LABELS.DON,  w: DON_W, h: DON_H, tint: COLORS.DON_TINT, badge: 10 },
        { label: LABELS.LIFE, w: CW, h: CH, tint: COLORS.ENEMY_TINT, badge: 5, isBack: true },
        { label: LABELS.LEADER, w: CW, h: CH, tint: COLORS.ENEMY_TINT },
        { label: LABELS.STAGE, w: CW, h: CH, tint: COLORS.ENEMY_TINT },
        { label: LABELS.DECK,  w: CW, h: CH, tint: COLORS.ENEMY_TINT, badge: 40, isBack: true },
        { label: LABELS.TRASH, w: CW, h: CH, tint: COLORS.ENEMY_TINT, badge: 0 },
      ];

      // 中央揃えのために総幅を計算
      let oMainW = 0;
      O_MAIN_ELEMENTS.forEach(e => oMainW += e.w + GAP_BASE);
      oMainW -= GAP_BASE;
      
      let currentOX = (W - oMainW) / 2 + O_MAIN_ELEMENTS[0].w / 2;

      O_MAIN_ELEMENTS.forEach((el) => {
        oppContainer.addChild(createZone(
          currentOX, O_ROW2_Y, el.w, el.h, el.label, el.tint, 
          { isFaceDown: el.isBack, badge: el.badge }
        ));
        currentOX += (el.w / 2) + GAP_BASE + (el.w / 2); // 次の要素へ
      });


      // --- Row 1: Hand (7枚, 裏面) ---
      // 画面最上部。デバッグログエリアを避ける
      const handCount = 7;
      const handStartX = LOG_AREA_WIDTH + GAP_BASE + CW/2; 
      
      for (let i = 0; i < handCount; i++) {
        oppContainer.addChild(createZone(
          handStartX + i * (CW + GAP_BASE), 
          O_ROW1_Y, 
          CW, CH, 
          "Hand", COLORS.ENEMY_TINT,
          { isFaceDown: true }
        ));
      }


      // ============================================
      // 🔵 自分側 (PLAYER)
      // ============================================
      const playerContainer = new PIXI.Container();
      playerContainer.position.set(0, Y_PLAYER_START);
      app.stage.addChild(playerContainer);

      const P_AVAIL_H = H_PLAYER_TOTAL;
      const P_ROW1_Y = P_AVAIL_H * 0.2; // Top (Char)
      const P_ROW2_Y = P_AVAIL_H * 0.55; // Middle (Main)
      const P_ROW3_Y = P_AVAIL_H * 0.9; // Bottom (Hand)

      // --- Row 1: Characters ---
      for (let i = 0; i < 5; i++) {
        playerContainer.addChild(createZone(
          getSlotX(i, 5), P_ROW1_Y, CW, CH, "Char", COLORS.PLAYER_TINT
        ));
      }

      // --- Row 2: Main ---
      // 左から: Cost, Don, Life, Leader, Stage, Deck, Trash
      const P_MAIN_ELEMENTS = [
        { label: LABELS.COST, w: DON_W, h: DON_H, tint: COLORS.DON_TINT },
        { label: LABELS.DON,  w: DON_W, h: DON_H, tint: COLORS.DON_TINT, badge: 10 },
        { label: LABELS.LIFE, w: CW, h: CH, tint: COLORS.PLAYER_TINT, badge: 5 },
        { label: LABELS.LEADER, w: CW, h: CH, tint: 0x00FF00 },
        { label: LABELS.STAGE, w: CW, h: CH, tint: COLORS.PLAYER_TINT },
        { label: LABELS.DECK,  w: CW, h: CH, tint: COLORS.PLAYER_TINT, badge: 40, isBack: true },
        { label: LABELS.TRASH, w: CW, h: CH, tint: COLORS.PLAYER_TINT, badge: 0 },
      ];

      // 幅計算
      let pMainW = 0;
      P_MAIN_ELEMENTS.forEach(e => pMainW += e.w + GAP_BASE);
      pMainW -= GAP_BASE;
      let currentPX = (W - pMainW) / 2 + P_MAIN_ELEMENTS[0].w / 2;

      P_MAIN_ELEMENTS.forEach((el) => {
        playerContainer.addChild(createZone(
          currentPX, P_ROW2_Y, el.w, el.h, el.label, el.tint, 
          { isFaceDown: el.isBack, badge: el.badge }
        ));
        
        const myIndex = P_MAIN_ELEMENTS.indexOf(el);
        if (myIndex < P_MAIN_ELEMENTS.length - 1) {
          const nextEl = P_MAIN_ELEMENTS[myIndex + 1];
          currentPX += (el.w / 2) + GAP_BASE + (nextEl.w / 2);
        }
      });

      // --- Row 3: Hand ---
      for (let i = 0; i < 7; i++) {
        playerContainer.addChild(createZone(
          getSlotX(i, 7), P_ROW3_Y, CW, CH, "Hand", COLORS.PLAYER_TINT
        ));
      }


      // ============================================
      // ⚪ Control Area (Buttons)
      // ============================================
      const ctrlContainer = new PIXI.Container();
      ctrlContainer.position.set(0, Y_CTRL_START);
      app.stage.addChild(ctrlContainer);

      const buttons = ["Close", "Settings", "Reset", "Back", "View", "NextTurn"];
      const btnCount = buttons.length;
      const btnGap = 10;
      const btnW = (W - (btnGap * (btnCount + 1))) / btnCount;
      const btnH = H_CTRL * 0.6;
      const btnY = H_CTRL / 2;

      buttons.forEach((label, i) => {
        const btn = new PIXI.Container();
        const bx = btnGap + i * (btnW + btnGap) + btnW/2;
        btn.position.set(bx, btnY);

        const btnBg = new PIXI.Graphics();
        btnBg.beginFill(0xFFFFFF);
        btnBg.lineStyle(1, 0xCCCCCC);
        btnBg.drawRoundedRect(-btnW/2, -btnH/2, btnW, btnH, 8);
        btnBg.endFill();
        btn.addChild(btnBg);

        const t = new PIXI.Text(label, {
          fontFamily: 'Arial',
          fontSize: Math.min(14, btnW * 0.25),
          fill: 0x333333,
        });
        t.anchor.set(0.5);
        btn.addChild(t);
        
        btn.eventMode = 'static';
        btn.cursor = 'pointer';
        
        ctrlContainer.addChild(btn);
      });


    } catch (e: any) {
      console.error("LAYOUT DRAW ERROR:", e);
      const errText = new PIXI.Text(`Error: ${e.message}`, {
        fill: 0xFF0000, fontSize: 20, wordWrap: true, wordWrapWidth: app.renderer.width,
      });
      errText.position.set(20, app.renderer.height / 2);
      app.stage.addChild(errText);
    }
  };

  return (
    <div 
      ref={containerRef}
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0,
        background: '#000'
      }}
    />
  );
};
