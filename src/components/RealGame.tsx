import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';

// --- 定数・カラー定義 ---
const SAFE_AREA_TOP = 44; // iPhone等のノッチ回避

const COLORS = {
  OPPONENT_BG: 0xFFEEEE, // 薄いピンク
  CONTROL_BG:  0xF0F0F0, // 薄いグレー
  PLAYER_BG:   0xE6F7FF, // 薄いブルー
  
  ZONE_BORDER: 0xAAAAAA,
  ZONE_FILL:   0xFFFFFF,
  
  TEXT_MAIN:   0x333333,
  BADGE_BG:    0xFF0000,
  BADGE_TEXT:  0xFFFFFF,
  
  PLAYER_ZONE: 0x4488FF,
  ENEMY_ZONE:  0xFF4444,
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
};

export const RealGame = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  
  // 画面リサイズ検知用のState
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  // --- 1. リサイズ監視 ---
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
      // Pixiのレンダラーもリサイズ
      if (appRef.current) {
        appRef.current.renderer.resize(window.innerWidth, window.innerHeight);
        drawLayout(appRef.current); // レイアウト再描画
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- 2. PixiJS 初期化 ---
  useEffect(() => {
    if (!containerRef.current || appRef.current) return;

    try {
      console.log('[PixiJS] Initializing Responsive Layout...');

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

      // 初回描画
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
  }, []); // 初回のみ実行 (リサイズは上のuseEffectで処理)


  // =========================================================
  // 🎨 レイアウト描画ロジック (再描画ごとに全クリアして再配置)
  // =========================================================
  const drawLayout = (app: PIXI.Application) => {
    try {
      // 画面クリア
      app.stage.removeChildren();

      const W = app.renderer.width / app.renderer.resolution;
      const H = app.renderer.height / app.renderer.resolution;
      
      const AVAILABLE_H = H - SAFE_AREA_TOP;

      // --- 3. エリア高さ計算 ---
      const H_OPP = AVAILABLE_H * 0.42;
      const H_CTRL = AVAILABLE_H * 0.16;
      const H_PLAYER = AVAILABLE_H - H_OPP - H_CTRL; // 残り全部

      const Y_OPP = SAFE_AREA_TOP;
      const Y_CTRL = SAFE_AREA_TOP + H_OPP;
      const Y_PLAYER = SAFE_AREA_TOP + H_OPP + H_CTRL;

      // --- 4. 背景描画 (3色エリア) ---
      const bg = new PIXI.Graphics();
      
      // Opponent Area (Pink)
      bg.beginFill(COLORS.OPPONENT_BG);
      bg.drawRect(0, Y_OPP, W, H_OPP);
      bg.endFill();

      // Control Area (Gray)
      bg.beginFill(COLORS.CONTROL_BG);
      bg.drawRect(0, Y_CTRL, W, H_CTRL);
      bg.endFill();

      // Player Area (Blue)
      bg.beginFill(COLORS.PLAYER_BG);
      bg.drawRect(0, Y_PLAYER, W, H_PLAYER);
      bg.endFill();

      // Safe Area (White or Black)
      bg.beginFill(0x000000);
      bg.drawRect(0, 0, W, SAFE_AREA_TOP);
      bg.endFill();

      app.stage.addChild(bg);

      // --- 5. カードサイズ計算 ---
      // 画面幅を7.5等分したものをスロット幅とする
      const SLOT_W = W / 7.5;
      const CW = SLOT_W * 0.90;   // マージン考慮
      const CH = CW * 1.4;        // アスペクト比 1:1.4
      
      // ドン!!カード用 (少し小さく)
      const DON_W = CW * 0.8;
      const DON_H = CH * 0.8;

      // グリッド配置ヘルパー
      // index: 0~6 (横7列), rowY: 配置するY座標(中心), isDon: ドンサイズかどうか
      const getSlotX = (index: number) => {
        // 全体(7スロット)を画面中央に寄せるためのオフセット
        const totalW = SLOT_W * 7;
        const startX = (W - totalW) / 2 + SLOT_W / 2;
        return startX + SLOT_W * index;
      };

      // ---------------------------------------------
      // 🛠 ゾーン生成関数
      // ---------------------------------------------
      const createZone = (
        cx: number, cy: number, 
        w: number, h: number, 
        label: string, 
        tint: number,
        badgeCount?: number
      ) => {
        const container = new PIXI.Container();
        container.position.set(cx, cy);

        // 枠線と背景
        const g = new PIXI.Graphics();
        g.lineStyle(2, tint, 0.8);
        g.beginFill(COLORS.ZONE_FILL, 0.5);
        // 中心基準で描画
        g.drawRoundedRect(-w/2, -h/2, w, h, 6);
        g.endFill();
        container.addChild(g);

        // ラベル
        const text = new PIXI.Text(label, {
          fontFamily: 'Arial',
          fontSize: Math.min(12, w * 0.3),
          fill: COLORS.TEXT_MAIN,
          fontWeight: 'bold',
        });
        text.anchor.set(0.5);
        container.addChild(text);

        // バッジ (枚数表示)
        if (badgeCount !== undefined) {
          const badge = new PIXI.Container();
          badge.position.set(w/2 - 5, h/2 - 5); // 右下

          const bg = new PIXI.Graphics();
          bg.beginFill(COLORS.BADGE_BG);
          bg.drawCircle(0, 0, 10);
          bg.endFill();
          badge.addChild(bg);

          const num = new PIXI.Text(badgeCount.toString(), {
            fontFamily: 'Arial', fontSize: 10, fill: COLORS.BADGE_TEXT, fontWeight: 'bold'
          });
          num.anchor.set(0.5);
          badge.addChild(num);
          
          container.addChild(badge);
        }

        return container;
      };

      // ============================================
      // 🔴 相手側 (OPPONENT) - 上エリア & 180度回転
      // ============================================
      const oppContainer = new PIXI.Container();
      // コンテナの基準点を「エリアの右下」に設定し、180度回転させる
      // これにより、コンテナ内座標系は [x: 左へ, y: 上へ] となる (正の値で扱える)
      oppContainer.position.set(W, Y_CTRL); 
      oppContainer.rotation = Math.PI;
      app.stage.addChild(oppContainer);

      // --- Opponent Rows (コンテナ内座標: y=0がエリア下辺(画面中央), y=Maxがエリア上辺(画面上)) ---
      
      // Row 3: Character (エリア最下部 = 画面中央寄り = yが小さい)
      const OPP_ROW3_Y = H_OPP * 0.25; 
      for (let i = 0; i < 5; i++) {
        // 中央5枠 (index 1~5)
        const z = createZone(getSlotX(i + 1), OPP_ROW3_Y, CW, CH, "Char", COLORS.ENEMY_ZONE);
        oppContainer.addChild(z);
      }

      // Row 2: Main Row (エリア中央)
      const OPP_ROW2_Y = H_OPP * 0.55; 
      // 左から(画面上では右から): Trash, Deck, Stage, Leader, Life, Don, Cost
      // ※回転しているので、配列順序に注意。
      // x=0 (画面右) -> x=W (画面左)。
      // 画面左(相手の右手)にあるべきなのは Trash/Deck。
      // コンテナ内座標では xが大きい方(Wに近い方) に配置する。
      
      // 配置マップ: slot index 0..6
      // 0: Cost, 1: Don, 2: Life, 3: Leader, 4: Stage, 5: Deck, 6: Trash
      // (回転しているので、index 0 は画面右端＝相手の左手＝Cost)
      
      oppContainer.addChild(createZone(getSlotX(6), OPP_ROW2_Y, CW, CH, LABELS.TRASH, COLORS.ENEMY_ZONE, 0));
      oppContainer.addChild(createZone(getSlotX(5), OPP_ROW2_Y, CW, CH, LABELS.DECK, COLORS.ENEMY_ZONE, 40));
      oppContainer.addChild(createZone(getSlotX(4), OPP_ROW2_Y, CW, CH, LABELS.STAGE, COLORS.ENEMY_ZONE));
      
      // Leader (中央)
      oppContainer.addChild(createZone(getSlotX(3), OPP_ROW2_Y, CW, CH, LABELS.LEADER, COLORS.ENEMY_ZONE));
      
      oppContainer.addChild(createZone(getSlotX(2), OPP_ROW2_Y, CW, CH, LABELS.LIFE, COLORS.ENEMY_ZONE, 5));
      oppContainer.addChild(createZone(getSlotX(1), OPP_ROW2_Y, DON_W, DON_H, LABELS.DON, COLORS.ZONE_BORDER, 10)); // Donは小さく
      oppContainer.addChild(createZone(getSlotX(0), OPP_ROW2_Y, DON_W, DON_H, LABELS.COST, COLORS.ZONE_BORDER));

      // Row 1: Hand (エリア最上部 = 画面上端 = yが大きい)
      const OPP_ROW1_Y = H_OPP * 0.85; // 上端近く
      for (let i = 0; i < 7; i++) {
        const z = createZone(getSlotX(i), OPP_ROW1_Y, CW, CH, "Hand", COLORS.ENEMY_ZONE);
        oppContainer.addChild(z);
      }


      // ============================================
      // 🔵 自分側 (PLAYER) - 下エリア
      // ============================================
      const playerContainer = new PIXI.Container();
      playerContainer.position.set(0, Y_PLAYER);
      app.stage.addChild(playerContainer);

      // --- Player Rows ---

      // Row 1: Character (エリア最上部 = 画面中央寄り)
      const PL_ROW1_Y = H_PLAYER * 0.25;
      for (let i = 0; i < 5; i++) {
        // 中央5枠 (index 1~5)
        const z = createZone(getSlotX(i + 1), PL_ROW1_Y, CW, CH, "Char", COLORS.PLAYER_ZONE);
        playerContainer.addChild(z);
      }

      // Row 2: Main Row (エリア中央)
      const PL_ROW2_Y = H_PLAYER * 0.55;
      // 左から: Cost, Don, Life, Leader, Stage, Deck, Trash
      // index: 0..6
      playerContainer.addChild(createZone(getSlotX(0), PL_ROW2_Y, DON_W, DON_H, LABELS.COST, COLORS.ZONE_BORDER, 0));
      playerContainer.addChild(createZone(getSlotX(1), PL_ROW2_Y, DON_W, DON_H, LABELS.DON, COLORS.ZONE_BORDER, 10));
      playerContainer.addChild(createZone(getSlotX(2), PL_ROW2_Y, CW, CH, LABELS.LIFE, COLORS.PLAYER_ZONE, 5));
      
      // Leader
      playerContainer.addChild(createZone(getSlotX(3), PL_ROW2_Y, CW, CH, LABELS.LEADER, 0x00FF00));
      
      playerContainer.addChild(createZone(getSlotX(4), PL_ROW2_Y, CW, CH, LABELS.STAGE, COLORS.PLAYER_ZONE));
      playerContainer.addChild(createZone(getSlotX(5), PL_ROW2_Y, CW, CH, LABELS.DECK, COLORS.PLAYER_ZONE, 40));
      playerContainer.addChild(createZone(getSlotX(6), PL_ROW2_Y, CW, CH, LABELS.TRASH, COLORS.PLAYER_ZONE, 0));

      // Row 3: Hand (エリア最下部)
      const PL_ROW3_Y = H_PLAYER * 0.85;
      for (let i = 0; i < 7; i++) {
        const z = createZone(getSlotX(i), PL_ROW3_Y, CW, CH, "Hand", COLORS.PLAYER_ZONE);
        playerContainer.addChild(z);
      }

      // ============================================
      // ⚪ Control Area - 中央
      // ============================================
      const ctrlContainer = new PIXI.Container();
      ctrlContainer.position.set(0, Y_CTRL);
      app.stage.addChild(ctrlContainer);

      // ボタン例
      const btnW = 80;
      const btnH = 30;
      const drawBtn = (label: string, x: number) => {
        const btn = new PIXI.Container();
        btn.position.set(x, H_CTRL / 2);
        
        const g = new PIXI.Graphics();
        g.beginFill(0xFFFFFF);
        g.lineStyle(1, 0x999999);
        g.drawRoundedRect(-btnW/2, -btnH/2, btnW, btnH, 4);
        g.endFill();
        btn.addChild(g);

        const t = new PIXI.Text(label, { fontSize: 14, fill: 0x333333 });
        t.anchor.set(0.5);
        btn.addChild(t);

        return btn;
      };

      ctrlContainer.addChild(drawBtn("Reset", W/2 - 50));
      ctrlContainer.addChild(drawBtn("Close", W/2 + 50));


    } catch (e: any) {
      console.error("LAYOUT DRAW ERROR:", e);
      // エラーを画面に表示
      const errText = new PIXI.Text(`Error: ${e.message}`, {
        fill: 0xFF0000,
        fontSize: 20,
        wordWrap: true,
        wordWrapWidth: app.renderer.width,
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
