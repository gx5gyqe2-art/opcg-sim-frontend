import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../constants';

export const RealGame = () => {
  // Pixi Canvas をマウントする親 div の参照
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Pixi Application インスタンスの保持（クリーンアップ用）
  const appRef = useRef<PIXI.Application | null>(null);

  // レスポンシブ計算用ステート
  const [dimensions, setDimensions] = useState({ 
    scale: 1, 
    left: 0, 
    top: 0 
  });

  // --- 1. レスポンシブ計算 (CSS Transform用) ---
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

  // --- 2. PixiJS 初期化 (Pure Mode) ---
  useEffect(() => {
    // コンテナが存在しない、または既にアプリが作成済みの場合は何もしない
    if (!containerRef.current || appRef.current) return;

    try {
      console.log('[PixiJS] Initializing Application...');

      // Pixi Application の作成
      // メモ: v7系構文を使用。v8の場合は app.init() が非同期になりますが、
      // ここでは最も安定している同期的な new Application() を想定しています。
      const app = new PIXI.Application({
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        backgroundColor: 0x000000,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true, // CSSピクセルと物理ピクセルの整合性を取る
        antialias: true,
      });

      // Canvas を DOM に追加
      // (TypeScriptエラー回避のため as HTMLCanvasElement キャストを入れています)
      containerRef.current.appendChild(app.view as HTMLCanvasElement);
      appRef.current = app;

      console.log('[PixiJS] Canvas appended to DOM.');

      // --- 描画コンテンツの追加 ---
      
      const graphics = new PIXI.Graphics();
      
      // 1. 背景 (赤色で塗りつぶし)
      graphics.beginFill(0xFF0000);
      graphics.drawRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
      graphics.endFill();

      // 2. 診断用オブジェクト (中央の白い四角)
      graphics.beginFill(0xFFFFFF);
      graphics.drawRect(SCREEN_WIDTH / 2 - 50, SCREEN_HEIGHT / 2 - 50, 100, 100);
      graphics.endFill();

      app.stage.addChild(graphics);

      console.log('[PixiJS] Graphics drawn.');

    } catch (e: any) {
      console.error('[PixiJS Critical Error]', e);
      
      // 画面上に直接エラーを表示
      if (containerRef.current) {
        containerRef.current.innerHTML = `
          <div style="color: red; padding: 20px; font-family: monospace;">
            <h3>PixiJS Init Failed</h3>
            <p>${e.message}</p>
            <pre>${e.stack}</pre>
          </div>
        `;
      }
    }

    // --- クリーンアップ関数 ---
    return () => {
      if (appRef.current) {
        console.log('[PixiJS] Destroying application...');
        // true: 子供の要素やテクスチャも破棄する
        // { children: true, texture: true, baseTexture: true } を推奨
        appRef.current.destroy(true, {
          children: true,
          texture: true,
          baseTexture: true
        });
        appRef.current = null;
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      style={{
        position: 'absolute',
        // CSS Transform で全体を拡縮する（Pixi内部の座標系は変更しない）
        transformOrigin: '0 0',
        transform: `translate(${dimensions.left}px, ${dimensions.top}px) scale(${dimensions.scale})`,
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        boxShadow: '0 0 20px rgba(255, 0, 0, 0.5)',
        border: '2px solid red', // 診断モード枠線
        overflow: 'hidden'
      }}
    />
  );
};
