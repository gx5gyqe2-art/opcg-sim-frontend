import { useEffect, useState, useCallback } from 'react';
import { Stage, Container, Graphics } from '@pixi/react';
import { GameBoard } from './GameBoard';
import { SCREEN_WIDTH, SCREEN_HEIGHT, COLORS } from '../constants';

export const RealGame = () => {
  const [dimensions, setDimensions] = useState({ 
    scale: 1, 
    left: 0, 
    top: 0 
  });

  // レスポンシブ対応 (画面サイズに合わせてScale計算)
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
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 背景描画（Graphics使用の要件を満たすため）
  const drawBackground = useCallback((g: any) => {
    g.clear();
    // COLORS.BACKGROUND が未定義の場合はフォールバック色を使用
    g.beginFill(COLORS.BACKGROUND || 0x222222);
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
      boxShadow: '0 0 20px rgba(0,0,0,0.5)'
    }}>
      <Stage 
        width={SCREEN_WIDTH} 
        height={SCREEN_HEIGHT} 
        options={{ 
          backgroundColor: 0x000000,
          antialias: true,
          resolution: window.devicePixelRatio || 1
        }}
      >
        <Container>
          {/* 背景レイヤー */}
          <Graphics draw={drawBackground} />
          {/* ゲーム盤面レイヤー */}
          <GameBoard />
        </Container>
      </Stage>
    </div>
  );
};
