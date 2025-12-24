import { useEffect, useState, useCallback } from 'react';
import { Stage, Graphics } from '@pixi/react';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../constants';

export const RealGame = () => {
  // --- 1. レスポンシブ計算用ステート ---
  const [dimensions, setDimensions] = useState({ 
    scale: 1, 
    left: 0, 
    top: 0 
  });

  // --- 2. リサイズ監視ロジック (既存ロジックの維持) ---
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

  // --- 3. 診断用描画関数 (画面を赤く塗るだけ) ---
  const drawDiagnosticScreen = useCallback((g: any) => {
    g.clear();
    g.beginFill(0xFF0000); // 赤色
    g.drawRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    g.endFill();
    
    // 動作確認用のテキスト代わりの矩形（中央に白い四角）
    g.beginFill(0xFFFFFF);
    g.drawRect(SCREEN_WIDTH / 2 - 50, SCREEN_HEIGHT / 2 - 50, 100, 100);
    g.endFill();
  }, []);

  return (
    <div style={{
      position: 'absolute',
      transformOrigin: '0 0',
      transform: `translate(${dimensions.left}px, ${dimensions.top}px) scale(${dimensions.scale})`,
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      boxShadow: '0 0 20px rgba(255, 0, 0, 0.5)', // 赤い影で診断モードであることを強調
      border: '2px solid red'
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
        <Graphics draw={drawDiagnosticScreen} />
      </Stage>
    </div>
  );
};
