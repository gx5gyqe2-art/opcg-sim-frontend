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
const DON_H = 43.3; // 修正: Cost/Donエリアで使用する高さ

// 余白設定
const GAP_S = 5;
const GAP_M = 10;

// 色定義
const THEME = {
  BG: COLORS?.BACKGROUND || 0x2E8B57,
  ZONE_BORDER: 0xFFFFFF,
  ZONE_BG: 0x000000,
  TEXT: 0xFFFFFF,
  BADGE_BG: 0xFF0000,
  BADGE_TEXT: 0xFFFFFF,
  PLAYER_TINT: 0xAAAAFF, // 自分側 (青系)
  ENEMY_TINT: 0xFFAAAA,  // 相手側 (赤系)
  DON_TINT: 0xDDDDDD,
};

export const RealGame = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const intervalRef = useRef<number | null>(null);

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
      console.log('[PixiJS] Initializing v1.2 Compliant Layout...');

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

        // ラベル
        if (options.label) {
          const text = new PIXI.Text(options.label, {
            fontFamily: 'Arial',
            fontSize: 9, // 少し小さく
            fill: color,
            align: 'center',
          });
          text.alpha = 0.6;
          text.anchor.set(0.5);
          text.position.set(w / 2, h / 2);
          container.addChild(text);
        }

        app.stage.addChild(container);
        return container;
      };

      const createBadge = (parent: PIXI.Container, count: number, w: number, h: number) => {
        const badge = new PIXI.Container();
        const r = 9;
        badge.position.set(w - r/2 - 2, h - r/2 - 2);

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
      // 🎨 盤面レイアウト実装 (指示書 v1.2 完全準拠)
      // ---------------------------------------------------------

      // === Y座標計算 ===
      // [Player] 下から積み上げ
      const P_HAND_Y   = LOGICAL_HEIGHT - STD_H - GAP_M; // Row 3 (Bottom)
      const P_MAIN_Y   = P_HAND_Y - GAP_M - STD_H;       // Row 2 (Leader)
      const P_BATTLE_Y = P_MAIN_Y - GAP_M - STD_H;       // Row 1 (Battle)

      // [Opponent] 上から配置 (順序修正: Hand -> Main -> Battle)
      const E_HAND_Y   = GAP_M;                          // Row 1 (Top)
      const E_MAIN_Y   = E_HAND_Y + STD_H + GAP_M;       // Row 2 (Leader)
      const E_BATTLE_Y = E_MAIN_Y + STD_H + GAP_M;       // Row 3 (Battle)

      // === X座標計算 (メイン列 - Player基準) ===
      const LEADER_X = CENTER_X - STD_W / 2;
      
      // Player Side X
      const P_STAGE_X  = LEADER_X + STD_W + GAP_S;
      const P_DECK_X   = P_STAGE_X + STD_W + GAP_S;
      const P_TRASH_X  = P_DECK_X + STD_W + GAP_S;
      
      const P_LIFE_X     = LEADER_X - STD_W - GAP_S;
      const P_DON_DECK_X = P_LIFE_X - DON_W - GAP_S;
      const P_COST_X     = P_DON_DECK_X - DON_W - GAP_S;

      // Opponent Side X (点対称配置 = 左右反転)
      const E_STAGE_X = LEADER_X - STD_W - GAP_S;
      const E_DECK_X  = E_STAGE_X - STD_W - GAP_S;
      const E_TRASH_X = E_DECK_X - STD_W - GAP_S;

      const E_LIFE_X     = LEADER_X + STD_W + GAP_S;
      const E_DON_DECK_X = E_LIFE_X + STD_W + GAP_S;
      const E_COST_X     = E_DON_DECK_X + DON_W + GAP_S;


      // ==========================================
      // 🟢 PLAYER SIDE (自分)
      // ==========================================
      
      // 1. Hand Area (7枚並べる)
      for (let i = 0; i < 7; i++) {
        createZone(
          GAP_S + i * (STD_W + GAP_S), 
          P_HAND_Y, 
          STD_W, 
          STD_H, 
          { label: `Hand ${i+1}`, tint: THEME.PLAYER_TINT }
        );
      }

      // 2. Main Row
      // Cost & Don Deck (小さいカード: DON_Hを使用し、下揃えにする)
      const OFFSET_Y = STD_H - DON_H;

      // Cost
      const costZone = createZone(P_COST_X, P_MAIN_Y + OFFSET_Y, DON_W, DON_H, { label: "Cost", tint: THEME.DON_TINT });
      createBadge(costZone, 0, DON_W, DON_H);
      
      // Don Deck
      const donDeckZone = createZone(P_DON_DECK_X, P_MAIN_Y + OFFSET_Y, DON_W, DON_H, { label: "Don", tint: THEME.DON_TINT });
      createBadge(donDeckZone, 10, DON_W, DON_H);
      
      // Life (Standard Height)
      const lifeZone = createZone(P_LIFE_X, P_MAIN_Y, STD_W, STD_H, { label: "Life", tint: THEME.PLAYER_TINT });
      createBadge(lifeZone, 5, STD_W, STD_H);
      // Leader
      createZone(LEADER_X, P_MAIN_Y, STD_W, STD_H, { label: "Leader", tint: 0x00FF00 });
      // Stage
      createZone(P_STAGE_X, P_MAIN_Y, STD_W, STD_H, { label: "Stage", tint: THEME.PLAYER_TINT });
      // Deck
      const deckZone = createZone(P_DECK_X, P_MAIN_Y, STD_W, STD_H, { label: "Deck", tint: THEME.PLAYER_TINT });
      createBadge(deckZone, 40, STD_W, STD_H);
      // Trash
      const trashZone = createZone(P_TRASH_X, P_MAIN_Y, STD_W, STD_H, { label: "Trash", tint: THEME.PLAYER_TINT });
      createBadge(trashZone, 0, STD_W, STD_H);

      // 3. Battle Area (Characters)
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
      
      // 1. Hand Area
      for (let i = 0; i < 7; i++) {
        createZone(
          GAP_S + i * (STD_W + GAP_S), 
          E_HAND_Y, 
          STD_W, 
          STD_H, 
          { label: `Opp ${i+1}`, tint: THEME.ENEMY_TINT }
        );
      }

      // 2. Main Row
      // Leader (Center)
      createZone(LEADER_X, E_MAIN_Y, STD_W, STD_H, { label: "E.Ldr", tint: 0xFF0000 });
      
      // E.Trash
      const eTrash = createZone(E_TRASH_X, E_MAIN_Y, STD_W, STD_H, { label: "E.Trs", tint: THEME.ENEMY_TINT });
      createBadge(eTrash, 0, STD_W, STD_H);
      // E.Deck
      const eDeck = createZone(E_DECK_X, E_MAIN_Y, STD_W, STD_H, { label: "E.Deck", tint: THEME.ENEMY_TINT });
      createBadge(eDeck, 40, STD_W, STD_H);
      // E.Stage
      createZone(E_STAGE_X, E_MAIN_Y, STD_W, STD_H, { label: "E.Stg", tint: THEME.ENEMY_TINT });

      // Right Side: Life -> Don -> Cost
      // E.Life
      const eLife = createZone(E_LIFE_X, E_MAIN_Y, STD_W, STD_H, { label: "E.Life", tint: THEME.ENEMY_TINT });
      createBadge(eLife, 5, STD_W, STD_H);
      
      // E.Don (Top Aligned relative to screen = Bottom aligned relative to Opponent Hand)
      // 小さいカードは行の上端 (E_MAIN_Y) に合わせる
      const eDon = createZone(E_DON_DECK_X, E_MAIN_Y, DON_W, DON_H, { label: "E.Don", tint: THEME.DON_TINT });
      createBadge(eDon, 10, DON_W, DON_H);
      
      // E.Cost
      createZone(E_COST_X, E_MAIN_Y, DON_W, DON_H, { label: "E.Cost", tint: THEME.DON_TINT });

      // 3. Battle Area (Characters)
      for (let i = 0; i < 5; i++) {
        createZone(
          BATTLE_START_X + i * (STD_W + GAP_S), 
          E_BATTLE_Y, 
          STD_W, 
          STD_H, 
          { label: `E.Chr ${i+1}`, tint: THEME.ENEMY_TINT }
        );
      }

      console.log('[PixiJS] Layout v1.2 Complete.');

      // --- 4. API Polling (Mock) ---
      const fetchGameState = async () => {
        try {
          // const res = await fetch('...');
          // const data = await res.json();
          // updateBoard(app, data);
        } catch (err) {
          console.error("Fetch error:", err);
        }
      };

      intervalRef.current = window.setInterval(fetchGameState, 2000);

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
        transformOrigin: '0 0',
        transform: `translate(${dimensions.left}px, ${dimensions.top}px) scale(${dimensions.scale})`,
        width: LOGICAL_WIDTH,
        height: LOGICAL_HEIGHT,
        boxShadow: '0 0 50px rgba(0,0,0,0.8)',
        overflow: 'hidden'
      }}
    />
  );
};
