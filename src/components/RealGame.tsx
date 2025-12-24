import { useEffect, useState, useCallback } from 'react';
import { Stage, Container, Graphics } from '@pixi/react';
import { GameBoard } from './GameBoard';
import { SCREEN_WIDTH, SCREEN_HEIGHT, COLORS } from '../constants';

export const RealGame = () => {
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
      
      // 画面内に収まる最大スケールを計算
      const scaleW = windowWidth / SCREEN_WIDTH;
      const scaleH = windowHeight / SCREEN_HEIGHT;
      const scale = Math.min(scaleW, scaleH);

      // 中央寄せのための位置計算
      const left = (windowWidth - SCREEN_WIDTH * scale) / 2;
      const top = (windowHeight - SCREEN_HEIGHT * scale) / 2;

      setDimensions({ scale, left, top });
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // 初期実行

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- 3. 背景描画関数 ---
  // GraphicsコンポーネントとCOLORS定数を使用し、TS6133エラーを回避
  const drawBackground = useCallback((g: any) => {
    g.clear();
    g.beginFill(COLORS.BACKGROUND);
    g.drawRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    g.endFill();
  }, []);

  return (
    <div style={{
      position: 'absolute',
      transformOrigin: '0 0',
      transform: `translate(${dimensions.left}px, ${dimensions.top}px) scale(${dimensions.scale})`,
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      boxShadow: '0 0 20px rgba(0,0,0,0.5)',
      overflow: 'hidden'
    }}>
      <Stage 
        width={SCREEN_WIDTH} 
        height={SCREEN_HEIGHT} 
        options={{ 
          background: COLORS.BACKGROUND, // 初期化時の背景色指定
          antialias: true,
          resolution: window.devicePixelRatio || 1
        }}
      >
        <Container>
          {/* 背景レイヤー (Graphics使用) */}
          <Graphics draw={drawBackground} />
          
          {/* メインゲーム盤面 */}
          <GameBoard />
        </Container>
      </Stage>
    </div>
  );
};
