import { useEffect, useState } from 'react';
import { Stage, Container, Graphics } from '@pixi/react';
import { GameBoard } from './components/GameBoard';
import { SCREEN_WIDTH, SCREEN_HEIGHT, COLORS } from './constants';

export default function App() {
  // --- 状態管理 ---
  const [logs, setLogs] = useState<string[]>([]);
  const [dimensions, setDimensions] = useState({ 
    scale: 1, 
    left: 0, 
    top: 0 
  });

  // --- デバッグ機能: Consoleジャック & エラー捕捉 (維持) ---
  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;

    const captureLog = (type: string, args: any[]) => {
      try {
        const message = args.map(arg => {
          if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack}`;
          if (typeof arg === 'object') return JSON.stringify(arg);
          return String(arg);
        }).join(' ');

        // 最新のログを上に、最大50件保持
        setLogs(prev => [`[${type}] ${message}`, ...prev].slice(0, 50));
      } catch (e) {
        setLogs(prev => [`[INTERNAL_ERR] Log capture failed`, ...prev]);
      }
    };

    console.log = (...args) => { originalLog(...args); captureLog('LOG', args); };
    console.error = (...args) => { originalError(...args); captureLog('ERR', args); };

    const handleError = (event: ErrorEvent) => {
      captureLog('WIN_ERR', [`${event.message} at ${event.filename}:${event.lineno}`]);
    };
    window.addEventListener('error', handleError);

    console.log('--- OPCG SIM BOOT SEQUENCE ---');
    console.log(`Resolution: ${SCREEN_WIDTH}x${SCREEN_HEIGHT}`);

    return () => {
      console.log = originalLog;
      console.error = originalError;
      window.removeEventListener('error', handleError);
    };
  }, []);

  // --- レスポンシブ対応 (画面サイズに合わせてScale計算) ---
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
      console.log(`Resized: Scale=${scale.toFixed(2)}`);
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // 初期実行

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#1a1a1a', // 背景色 (定数が無い場合のフォールバック)
      overflow: 'hidden',
      position: 'fixed',
      top: 0,
      left: 0,
      touchAction: 'none' // スマホでの誤操作防止
    }}>
      
      {/* --- PixiJS Game Stage --- */}
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
            backgroundColor: 0x1099bb, // 初期背景色（ロード遅延時のチラつき防止）
            antialias: true,
            resolution: window.devicePixelRatio || 1
          }}
        >
          {/* 背景などが必要な場合はここにGraphicsを追加 */}
          <Container>
            <GameBoard />
          </Container>
        </Stage>
      </div>

      {/* --- Debug Overlay (最前面表示) --- */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '300px', // スマホで見やすい幅
        maxWidth: '50%',
        height: '200px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: '#0f0',
        fontFamily: 'monospace',
        fontSize: '10px',
        overflowY: 'auto',
        zIndex: 9999,
        pointerEvents: 'auto', // スクロール可能にする
        padding: '5px',
        borderBottomLeftRadius: '5px'
      }}>
        <div style={{ borderBottom: '1px solid #444', marginBottom: '4px', fontWeight: 'bold' }}>
          DEBUG LOG
        </div>
        {logs.map((log, i) => (
          <div key={i} style={{ 
            marginBottom: '2px', 
            borderBottom: '1px solid #333',
            color: log.includes('ERR') ? '#ff4444' : '#0f0' 
          }}>
            {log}
          </div>
        ))}
      </div>

    </div>
  );
}
