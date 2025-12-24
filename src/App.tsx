import React, { useEffect, useState } from 'react';
import { Stage, Container, Graphics } from '@pixi/react';
import { GameBoard } from './components/GameBoard';
import { SCREEN_WIDTH, SCREEN_HEIGHT, COLORS } from './constants';

export default function App() {
  const [scale, setScale] = useState(1);
  const [logs, setLogs] = useState<string[]>([]);

  // --- デバッグログのオーバーライド ---
  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;

    const formatArgs = (args: any[]) => {
      return args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
    };

    console.log = (...args) => {
      originalLog(...args);
      setLogs(prev => [`[LOG] ${formatArgs(args)}`, ...prev].slice(0, 50));
    };

    console.error = (...args) => {
      originalError(...args);
      setLogs(prev => [`[ERR] ${formatArgs(args)}`, ...prev].slice(0, 50));
    };

    // 初期ログ
    console.log('App initialized. PixiJS environment ready.');

    return () => {
      console.log = originalLog;
      console.error = originalError;
    };
  }, []);

  // --- レスポンシブスケール計算 ---
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const ratio = Math.min(w / SCREEN_WIDTH, h / SCREEN_HEIGHT);
      setScale(ratio);
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      {/* PixiJS Stage */}
      <Stage
        width={SCREEN_WIDTH * scale}
        height={SCREEN_HEIGHT * scale}
        options={{
          background: COLORS.BACKGROUND,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        }}
      >
        <Container scale={scale}>
          {/* 背景描画 */}
          <Graphics
            draw={(g) => {
              g.clear();
              g.beginFill(COLORS.BACKGROUND);
              g.drawRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
              g.endFill();
            }}
          />
          {/* ゲームボードコンポーネント */}
          <GameBoard />
        </Container>
      </Stage>

      {/* デバッグオーバーレイ (HTML) */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '200px',
        maxHeight: '150px',
        overflowY: 'auto',
        background: 'rgba(0, 0, 0, 0.7)',
        color: '#0f0',
        fontSize: '10px',
        fontFamily: 'monospace',
        padding: '4px',
        pointerEvents: 'none', // ゲーム操作を邪魔しないように
        zIndex: 9999,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all'
      }}>
        <div style={{ borderBottom: '1px solid #444', marginBottom: '2px', fontWeight: 'bold' }}>
          Debug Console
        </div>
        {logs.map((log, i) => (
          <div key={i} style={{ marginBottom: '2px', color: log.startsWith('[ERR]') ? '#f44' : '#0f0' }}>
            {log}
          </div>
        ))}
      </div>
    </>
  );
}
