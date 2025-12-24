import { useEffect, useState } from 'react';
import { RealGame } from './components/RealGame';

// 🔧 デバッグモード切替スイッチ
// true: 外部依存を排除したメンテナンス画面を表示
// false: 本番のゲーム画面 (RealGame) を表示
const IS_DEBUG_MODE = false;

export default function App() {
  const [logs, setLogs] = useState<string[]>([]);

  // --- デバッグ機能: Consoleジャック & エラー捕捉 ---
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

    console.log(`--- APP STARTED (Mode: ${IS_DEBUG_MODE ? 'DEBUG' : 'GAME'}) ---`);

    return () => {
      console.log = originalLog;
      console.error = originalError;
      window.removeEventListener('error', handleError);
    };
  }, []);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#1a1a1a',
      overflow: 'hidden',
      position: 'fixed',
      top: 0,
      left: 0,
      touchAction: 'none'
    }}>
      
      {/* --- メインコンテンツ切替 --- */}
      {IS_DEBUG_MODE ? (
        <div style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontFamily: 'sans-serif'
        }}>
          <h1 style={{ color: '#ffcc00', border: '2px solid #ffcc00', padding: '10px' }}>
            🔧 MAINTENANCE MODE
          </h1>
          <p>PixiJS is currently disabled.</p>
        </div>
      ) : (
        <RealGame />
      )}

      {/* --- Debug Overlay (常時表示) --- */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '300px',
        maxWidth: '50%',
        height: '200px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: '#0f0',
        fontFamily: 'monospace',
        fontSize: '10px',
        overflowY: 'auto',
        zIndex: 9999,
        pointerEvents: 'auto',
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
