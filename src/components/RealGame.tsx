import { useEffect, useState, useCallback } from 'react';
import { Stage, Container, Graphics } from '@pixi/react';
// import { GameBoard } from './GameBoard'; // ⚠️ 原因切り分けのためコメントアウト
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

  // --- 3. 背景描画関数 ---
  const drawBackground = useCallback((g: any) => {
    g.clear();
    // COLORS.BACKGROUND がもし読み込めない場合用の一時的なフォールバックも含めておく
    const bgColor = COLORS?.BACKGROUND || 0x005500; 
    g.beginFill(bgColor);
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
          background: COLORS?.BACKGROUND || 0x005500,
          antialias: true,
          resolution: window.devicePixelRatio || 1
        }}
      >
        <Container>
          {/* 背景レイヤー */}
          <Graphics draw={drawBackground} />
          
          {/* ⚠️ CRITICAL DIAGNOSTIC STEP ⚠️
            GameBoardの描画を一時的に停止中。
            これでクラッシュが治れば、原因は GameBoard 内部にある。
          */}
          {/* <GameBoard /> */}
        </Container>
      </Stage>
    </div>
  );
};
