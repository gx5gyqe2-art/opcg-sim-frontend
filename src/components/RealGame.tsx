import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { COLORS } from '../constants';

// --- 1. 定数定義 (仕様書 v1.2 準拠) ---
const LOGICAL_WIDTH = 390;
const LOGICAL_HEIGHT = 844;
const CENTER_X = LOGICAL_WIDTH / 2;

// カードサイズ (固定)
const STD_W = 46.7;
const STD_H = 63.3;
const DON_W = 32.0;
const DON_H = 43.3;

// 余白設定
const GAP_S = 5;
const GAP_M = 10;
const GAP_L = 20;

// 色定義 (フォールバック付き)
const THEME = {
  BG: COLORS?.BACKGROUND || 0x2E8B57, // 深い緑
  ZONE_BORDER: 0xFFFFFF,
  ZONE_BG: 0x000000,
  TEXT: 0xFFFFFF,
  BADGE_BG: 0xFF0000,
  BADGE_TEXT: 0xFFFFFF,
  PLAYER_TINT: 0xAAAAFF, // 自分側の識別用（薄い青）
  ENEMY_TINT: 0xFFAAAA,  // 相手側の識別用（薄い赤）
};

export const RealGame = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const intervalRef = useRef<number | null>(null); // APIポーリング用

  // レスポンシブ計算用ステート
  const [dimensions, setDimensions] = useState({ 
    scale: 1, 
    left: 0, 
    top: 0 
  });

  // --- 2. レスポンシブ計算 (論理座標 390x844 を画面にフィット) ---
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      
      // アスペクト比を維持して画面に収める (contain)
      const scaleW = w / LOGICAL_WIDTH;
      const scaleH = h / LOGICAL_HEIGHT;
      const scale = Math.min(scaleW, scaleH);

      const left = (w - LOGICAL_WIDTH * scale) / 2;
      const top = (h - LOGICAL_HEIGHT * scale) / 2;

      setDimensions({ scale, left, top });
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- 3. PixiJS 初期化 & 盤面構築 ---
  useEffect(() => {
    if (!containerRef.current || appRef.current) return;

    try {
      console.log('[PixiJS] Initializing v1.2 Layout...');

      // アプリケーション作成 (論理解像度で固定)
      const app = new PIXI.Application({
        width: LOGICAL_WIDTH,
        height: LOGICAL_HEIGHT,
        backgroundColor: THEME.BG,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        antialias: true,
      });

      containerRef.current.appendChild(app.view as HTMLCanvasElement);
      appRef.current = app;

      // ---------------------------------------------------------
      // 🛠 ヘルパー関数
      // ---------------------------------------------------------

      // ゾーン（枠線）の作成
      const createZone = (
        x: number, 
        y: number, 
        w: number, 
        h: number, 
        options: { label?: string, tint?: number, alpha?: number } = {}
      ) => {
        const container = new PIXI.Container();
        container.position.set(x, y);

        // 背景と枠線
        const g = new PIXI.Graphics();
        const color = options.tint || THEME.ZONE_BORDER;
        const alpha = options.alpha || 0.2;
        
        g.lineStyle(1, color, 0.6);
        g.beginFill(THEME.ZONE_BG, alpha);
        g.drawRoundedRect(0, 0, w, h, 4);
        g.endFill();
        container.addChild(g);

        // ラベル (デバッグ用または薄く表示)
        if (options.label) {
          const text = new PIXI.Text(options.label, {
            fontFamily: 'Arial',
            fontSize: 10,
            fill: color,
            align: 'center',
          });
          text.alpha = 0.5;
          text.anchor.set(0.5);
          text.position.set(w / 2, h / 2);
          container.addChild(text);
        }

        app.stage.addChild(container);
        return container;
      };

      // バッジ（枚数表示）の作成
      const createBadge = (parent: PIXI.Container, count: number, w: number, h: number) => {
        const badge = new PIXI.Container();
        
        // 右下に配置
        const r = 10;
        badge.position.set(w - r/2, h - r/2);

        const bg = new PIXI.Graphics();
        bg.beginFill(THEME.BADGE_BG);
        bg.drawCircle(0, 0, r);
        bg.endFill();
        badge.addChild(bg);

        const text = new PIXI.Text(count.toString(), {
          fontFamily: 'Arial',
          fontSize: 10,
          fontWeight: 'bold',
          fill: THEME.BADGE_TEXT,
        });
        text.anchor.set(0.5);
        badge.addChild(text);

        parent.addChild(badge);
      };

      // ---------------------------------------------------------
      // 🎨 盤面レイアウト実装 (指示書 v1.2)
      // ---------------------------------------------------------

      // === 座標計算 ===
      
      // [Player] Y座標の基準点 (下から積み上げ)
      const P_HAND_Y = LOGICAL_HEIGHT - STD_H - GAP_M; // 手札 (Bottom)
      const P_LEADER_Y = P_HAND_Y - GAP_M - STD_H;     // リーダー列
      const P_BATTLE_Y = P_LEADER_Y - GAP_M - STD_H;   // バトル場 (キャラ)

      // [Enemy] Y座標の基準点 (上から配置)
      const E_HAND_Y = GAP_M;                          // 手札 (Top)
      const E_LEADER_Y = E_HAND_Y + STD_H + GAP_M;     // リーダー列
      const E_BATTLE_Y = E_LEADER_Y + STD_H + GAP_M;   // バトル場

      // [X座標]
      const X_LEADER = CENTER_X - STD_W / 2;
      
      // リーダー列の配置: Life -- Don -- [Leader] -- Stage -- Deck -- Trash
      // ※スペースが狭いため、少し調整して配置
      const X_RIGHT_BLOCK = CENTER_X + STD_W / 2 + GAP_M; // リーダーの右
      const X_LEFT_BLOCK  = CENTER_X - STD_W / 2 - GAP_M; // リーダーの左

      // ==========================================
      // 🟢 PLAYER SIDE (自分)
      // ==========================================
      
      // 1. Hand (手札) - 横幅いっぱい
      createZone(GAP_S, P_HAND_Y, LOGICAL_WIDTH - GAP_S * 2, STD_H, { label: "Hand Area", tint: THEME.PLAYER_TINT });

      // 2. Leader (中央)
      createZone(X_LEADER, P_LEADER_Y, STD_W, STD_H, { label: "Leader", tint: 0x00FF00 });

      // 3. Stage (リーダーの右隣と仮定 ※指示書「リーダーとデッキの中間」)
      createZone(X_RIGHT_BLOCK, P_LEADER_Y, STD_W, STD_H, { label: "Stage", tint: THEME.PLAYER_TINT });

      // 4. Deck (ステージのさらに右)
      const pDeckZone = createZone(X_RIGHT_BLOCK + STD_W + GAP_S, P_LEADER_Y, STD_W, STD_H, { label: "Deck", tint: THEME.PLAYER_TINT });
      createBadge(pDeckZone, 40, STD_W, STD_H); // 初期枚数バッジ

      // 5. Trash (デッキの右、または下？ スペース的にデッキの下に配置してみる)
      // 今回はデッキの右（画面端）に配置
      const pTrashZone = createZone(X_RIGHT_BLOCK + (STD_W + GAP_S) * 2, P_LEADER_Y, STD_W, STD_H, { label: "Trash", tint: THEME.PLAYER_TINT });
      createBadge(pTrashZone, 0, STD_W, STD_H);

      // 6. Life (リーダーの左隣)
      const pLifeZone = createZone(X_LEFT_BLOCK - STD_W, P_LEADER_Y, STD_W, STD_H, { label: "Life", tint: THEME.PLAYER_TINT });
      createBadge(pLifeZone, 5, STD_W, STD_H);

      // 7. Don Area (ライフのさらに左)
      // Active Don / Rest Don を分けて置くか、ドンデッキを置くか。
      // ここではドンデッキ＋ドン置き場として2つ配置
      const X_DON = X_LEFT_BLOCK - STD_W - GAP_S - DON_W;
      const pDonDeck = createZone(X_DON, P_LEADER_Y, DON_W, DON_H, { label: "Don", tint: 0xDDDDDD });
      createBadge(pDonDeck, 10, DON_W, DON_H);
      
      const pCostArea = createZone(X_DON - GAP_S - DON_W, P_LEADER_Y, DON_W, DON_H, { label: "Cost", tint: 0xDDDDDD });
      createBadge(pCostArea, 0, DON_W, DON_H);

      // 8. Battle Area (Characters) - 5枚グリッド
      // 中央揃えにする: 全幅 = 5 * STD_W + 4 * GAP_S
      const BATTLE_ROW_W = (STD_W * 5) + (GAP_S * 4);
      const BATTLE_START_X = CENTER_X - BATTLE_ROW_W / 2;
      
      for (let i = 0; i < 5; i++) {
        createZone(
          BATTLE_START_X + i * (STD_W + GAP_S), 
          P_BATTLE_Y, 
          STD_W, 
          STD_H, 
          { label: `Chr ${i+1}`, tint: THEME.PLAYER_TINT }
        );
      }


      // ==========================================
      // 🔴 OPPONENT SIDE (相手) - 点対称配置
      // ==========================================
      
      // 1. Hand (最上部)
      createZone(GAP_S, E_HAND_Y, LOGICAL_WIDTH - GAP_S * 2, STD_H, { label: "Enemy Hand", tint: THEME.ENEMY_TINT });

      // 2. Leader (中央)
      createZone(X_LEADER, E_LEADER_Y, STD_W, STD_H, { label: "E.Ldr", tint: 0xFF0000 });

      // 3. Enemy Deck / Trash (相手から見て右＝こちらから見て左)
      const eDeckZone = createZone(X_LEFT_BLOCK - STD_W, E_LEADER_Y, STD_W, STD_H, { label: "E.Deck", tint: THEME.ENEMY_TINT });
      createBadge(eDeckZone, 40, STD_W, STD_H);
      
      // 4. Enemy Life (相手から見て左＝こちらから見て右)
      const eLifeZone = createZone(X_RIGHT_BLOCK, E_LEADER_Y, STD_W, STD_H, { label: "E.Life", tint: THEME.ENEMY_TINT });
      createBadge(eLifeZone, 5, STD_W, STD_H);

      // 5. Enemy Battle Area (Characters)
      for (let i = 0; i < 5; i++) {
        // 相手側は右詰め（相手視点で左詰め）にするか、こちらも中央揃えで統一
        createZone(
          BATTLE_START_X + i * (STD_W + GAP_S), 
          E_BATTLE_Y, 
          STD_W, 
          STD_H, 
          { label: `E.Chr ${i+1}`, tint: THEME.ENEMY_TINT }
        );
      }

      console.log('[PixiJS] Layout v1.2 Complete.');

      // --- 4. API Polling Setup (Mock) ---
      // 将来的にここへ fetch ロジックを組み込む
      intervalRef.current = window.setInterval(() => {
        // console.log("Fetching game state..."); 
        // updateGameState(app); // 関数を実装して呼び出す
      }, 1000);

    } catch (e: any) {
      console.error("PIXI LAYOUT ERROR:", e);
      if (containerRef.current) {
        containerRef.current.innerHTML = `
          <div style="color: red; padding: 20px; font-family: monospace;">
            <h3>LAYOUT ERROR</h3>
            <pre>${e.message}</pre>
          </div>
        `;
      }
    }

    // --- クリーンアップ ---
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (appRef.current) {
        console.log('[PixiJS] Destroying...');
        appRef.current.destroy(true, { children: true, texture: true, baseTexture: true });
        appRef.current = null;
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      style={{
        position: 'absolute',
        // 画面中央に配置
        transformOrigin: '0 0',
        transform: `translate(${dimensions.left}px, ${dimensions.top}px) scale(${dimensions.scale})`,
        width: LOGICAL_WIDTH,
        height: LOGICAL_HEIGHT,
        // デバッグ用に影をつける
        boxShadow: '0 0 50px rgba(0,0,0,0.8)',
        overflow: 'hidden'
      }}
    />
  );
};
