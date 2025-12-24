import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { SCREEN_WIDTH, SCREEN_HEIGHT, COLORS } from '../constants';

export const RealGame = () => {
  // Pixi Canvas をマウントする親 div の参照
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Pixi Application インスタンスの保持（厳密なライフサイクル管理用）
  const appRef = useRef<PIXI.Application | null>(null);

  // --- 1. レスポンシブ計算用ステート ---
  const [dimensions, setDimensions] = useState({ 
    scale: 1, 
    left: 0, 
    top: 0 
  });

  // --- 2. リサイズ監視ロジック ---
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

  // --- 3. Pure PixiJS 初期化 & 描画ロジック ---
  useEffect(() => {
    // コンテナが無い、または既にApp作成済みの場合はガード
    if (!containerRef.current || appRef.current) return;

    try {
      console.log('[PixiJS] Starting Native Initialization...');

      // アプリケーションの作成
      const app = new PIXI.Application({
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        backgroundColor: COLORS.BACKGROUND || 0x222222, // 定数がない場合の安全策
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        antialias: true,
      });

      // Canvas を DOM に追加
      containerRef.current.appendChild(app.view as HTMLCanvasElement);
      appRef.current = app;

      console.log('[PixiJS] Canvas appended. Starting draw...');

      // --- インライン描画ロジック (GameBoardの代わり) ---

      // 1. 背景描画
      const background = new PIXI.Graphics();
      background.beginFill(COLORS.BACKGROUND || 0x222222);
      background.drawRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
      background.endFill();
      app.stage.addChild(background);

      // 2. テスト用オブジェクト描画 (Zoneのシミュレーション)
      // 白い枠線と半透明の塗り
      const zone = new PIXI.Graphics();
      zone.lineStyle(4, 0xFFFFFF, 1);
      zone.beginFill(0xFFFFFF, 0.1);
      zone.drawRect(SCREEN_WIDTH / 2 - 100, SCREEN_HEIGHT / 2 - 50, 200, 100);
      zone.endFill();
      app.stage.addChild(zone);

      // 3. テストテキスト
      const text = new PIXI.Text('NATIVE PIXI MODE', {
        fontFamily: 'Arial',
        fontSize: 24,
        fill: 0xFFFFFF,
        align: 'center',
      });
      text.anchor.set(0.5);
      text.x = SCREEN_WIDTH / 2;
      text.y = SCREEN_HEIGHT / 2;
      app.stage.addChild(text);

      console.log('[PixiJS] Draw complete.');

    } catch (e: any) {
      // 致命的なエラー捕捉
      console.error("PIXI CRASH:", e);
      
      // 画面上にもエラーを表示（黒画面回避）
      if (containerRef.current) {
        containerRef.current.innerHTML = `
          <div style="color: red; background: #300; padding: 20px;">
            <h3>PIXI CRASHED</h3>
            <pre>${e.message}\n${e.stack}</pre>
          </div>
        `;
      }
    }

    // --- クリーンアップ ---
    return () => {
      if (appRef.current) {
        console.log('[PixiJS] Destroying instance...');
        appRef.current.destroy(true, {
          children: true,
          texture: true,
          baseTexture: true
        });
        appRef.current = null;
      }
    };
  }, []); // 初回のみ実行

  return (
    <div 
      ref={containerRef}
      style={{
        position: 'absolute',
        transformOrigin: '0 0',
        transform: `translate(${dimensions.left}px, ${dimensions.top}px) scale(${dimensions.scale})`,
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        boxShadow: '0 0 20px rgba(0,0,0,0.5)',
        overflow: 'hidden'
      }}
    />
  );
};
