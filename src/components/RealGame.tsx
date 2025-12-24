import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { SCREEN_WIDTH, SCREEN_HEIGHT, COLORS, CARD_WIDTH, CARD_HEIGHT } from '../constants';

// 万が一 constants に定義がない場合のフォールバック値
const CW = CARD_WIDTH || 120;
const CH = CARD_HEIGHT || 170;
const GAP = 20;

export const RealGame = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);

  // --- 1. レスポンシブ計算用ステート ---
  const [dimensions, setDimensions] = useState({ 
    scale: 1, 
    left: 0, 
    top: 0 
  });

  // --- 2. リサイズ監視 (CSS Transform) ---
  useEffect(() => {
    const handleResize = () => {
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      
      const scaleW = windowWidth / SCREEN_WIDTH;
      const scaleH = windowHeight / SCREEN_HEIGHT;
      const scale = Math.min(scaleW, scaleH);

      const left = (windowWidth - SCREEN_WIDTH * scale) / 2;
      const top = (windowHeight - SCREEN_HEIGHT * scale) / 2;

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
      console.log('[PixiJS] Initializing Game Layout...');

      const app = new PIXI.Application({
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        backgroundColor: COLORS.BACKGROUND || 0x222222,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        antialias: true,
      });

      containerRef.current.appendChild(app.view as HTMLCanvasElement);
      appRef.current = app;

      // ---------------------------------------------
      // 🛠 ヘルパー関数: Zone（枠線＋ラベル）の作成
      // ---------------------------------------------
      const createZone = (x: number, y: number, w: number, h: number, label: string, color = 0xFFFFFF) => {
        const container = new PIXI.Container();
        container.position.set(x, y);

        // 枠線と半透明背景
        const g = new PIXI.Graphics();
        g.lineStyle(2, color, 0.5); // 枠線: 2px, 透過0.5
        g.beginFill(color, 0.1);    // 背景: 透過0.1
        g.drawRoundedRect(0, 0, w, h, 8);
        g.endFill();
        container.addChild(g);

        // ラベルテキスト
        const text = new PIXI.Text(label, {
          fontFamily: 'Arial',
          fontSize: 14,
          fill: color,
          alpha: 0.7,
          align: 'center',
        });
        text.anchor.set(0.5);
        text.x = w / 2;
        text.y = h / 2;
        container.addChild(text);

        app.stage.addChild(container);
        return container;
      };

      // ---------------------------------------------
      // 🎨 盤面レイアウト描画 (Layout Definitions)
      // ---------------------------------------------
      
      const CENTER_X = SCREEN_WIDTH / 2;
      const CENTER_Y = SCREEN_HEIGHT / 2;

      // === 背景 ===
      const bg = new PIXI.Graphics();
      bg.beginFill(COLORS.BACKGROUND || 0x222222);
      bg.drawRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
      bg.endFill();
      app.stage.addChildAt(bg, 0);

      // ============================================
      // 🟢 PLAYER SIDE (自分: 下側)
      // ============================================
      const P_Y_CHAR = CENTER_Y + 40;       // キャラクター列
      const P_Y_LEADER = P_Y_CHAR + CH + GAP; // リーダー列 (一番手前)
      
      // 1. Leader (中央手前)
      createZone(CENTER_X - CW / 2, P_Y_LEADER, CW, CH, "Leader", 0x00FF00);

      // 2. Characters (5枠: 中央配置)
      const charStartX = CENTER_X - (CW * 2.5) - (GAP * 2);
      for (let i = 0; i < 5; i++) {
        createZone(charStartX + i * (CW + GAP), P_Y_CHAR, CW, CH, `Char ${i+1}`);
      }

      // 3. Stage (リーダーの左)
      createZone(CENTER_X - CW / 2 - CW - GAP, P_Y_LEADER, CW, CH, "Stage");

      // 4. Deck (リーダーの右下)
      createZone(SCREEN_WIDTH - CW - GAP * 2, P_Y_LEADER, CW, CH, "Deck");

      // 5. Trash (デッキの上)
      createZone(SCREEN_WIDTH - CW - GAP * 2, P_Y_LEADER - CH - GAP, CW, CH, "Trash");

      // 6. Cost / Don (左下)
      createZone(GAP * 2, P_Y_LEADER, CW * 2 + GAP, CH / 2, "Cost Area");
      createZone(GAP * 2, P_Y_LEADER + CH / 2 + 10, CW, CH / 2, "Don Deck");

      // 7. Life (リーダーの左、ステージの左？ レイアウトによるがとりあえず左配置)
      createZone(CENTER_X - CW * 2.5 - GAP * 2, P_Y_LEADER, CW, CH / 2, "Life");

      // 8. Hand (一番下)
      createZone(GAP, SCREEN_HEIGHT - 100, SCREEN_WIDTH - GAP * 2, 90, "Hand Area");


      // ============================================
      // 🔴 OPPONENT SIDE (相手: 上側)
      // ============================================
      const O_Y_CHAR = CENTER_Y - 40 - CH;  // キャラクター列
      const O_Y_LEADER = O_Y_CHAR - CH - GAP; // リーダー列 (奥)

      // 1. Leader (中央奥)
      createZone(CENTER_X - CW / 2, O_Y_LEADER, CW, CH, "Enemy\nLeader", 0xFF5555);

      // 2. Characters (5枠)
      for (let i = 0; i < 5; i++) {
        createZone(charStartX + i * (CW + GAP), O_Y_CHAR, CW, CH, `Enemy\nChar ${i+1}`, 0xFFAAAA);
      }

      // 3. Deck / Trash (左奥 = 相手の右手)
      createZone(GAP * 2, O_Y_LEADER, CW, CH, "Enemy\nDeck", 0xFFAAAA);
      createZone(GAP * 2, O_Y_LEADER + CH + GAP, CW, CH, "Enemy\nTrash", 0xFFAAAA);

      // 4. Life (右奥 = 相手の左手)
      createZone(SCREEN_WIDTH - CW - GAP * 2, O_Y_LEADER, CW, CH / 2, "Enemy\nLife", 0xFFAAAA);

      // 5. Hand (一番上)
      createZone(GAP, 10, SCREEN_WIDTH - GAP * 2, 90, "Enemy Hand", 0xFFAAAA);


      console.log('[PixiJS] Layout Complete.');

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
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        boxShadow: '0 0 50px rgba(0,0,0,0.8)',
        overflow: 'hidden'
      }}
    />
  );
};
