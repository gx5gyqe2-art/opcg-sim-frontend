import { useEffect, useState } from 'react';

export default function App() {
  const [logs, setLogs] = useState<string[]>([]);

  // --- デバッグ機能: Consoleジャック & エラー捕捉 ---
  useEffect(() => {
    // 既存のコンソール関数を保存
    const originalLog = console.log;
    const originalError = console.error;

    // ログを画面表示用に整形して保存するヘルパー
    const captureLog = (type: string, args: any[]) => {
      try {
        const message = args.map(arg => {
          if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack}`;
          if (typeof arg === 'object') return JSON.stringify(arg);
          return String(arg);
        }).join(' ');

        setLogs(prev => [`[${type}] ${message}`, ...prev].slice(0, 100));
      } catch (e) {
        // JSON.stringify等で失敗した場合のフォールバック
        setLogs(prev => [`[INTERNAL_ERR] Log capture failed`, ...prev]);
      }
    };

    // console.log を上書き
    console.log = (...args) => {
      originalLog(...args);
      captureLog('LOG', args);
    };

    // console.error を上書き
    console.error = (...args) => {
      originalError(...args);
      captureLog('ERR', args);
    };

    // グローバルな未補足エラーをキャッチ (window.onerror)
    const handleError = (event: ErrorEvent) => {
      captureLog('WIN_ERR', [`${event.message} at ${event.filename}:${event.lineno}`]);
    };
    window.addEventListener('error', handleError);

    // 起動確認ログ
    console.log('--- SYSTEM RECOVERY MODE STARTED ---');
    console.log(`User Agent: ${navigator.userAgent}`);
    console.log(`Screen Size: ${window.innerWidth}x${window.innerHeight}`);

    return () => {
      // クリーンアップ
      console.log = originalLog;
      console.error = originalError;
      window.removeEventListener('error', handleError);
    };
  }, []);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#000000',
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      fontFamily: 'sans-serif',
      position: 'fixed', // iPhoneでのスクロールバウンス防止
      top: 0,
      left: 0
    }}>
      {/* メイン表示エリア */}
      <div style={{
        textAlign: 'center',
        marginBottom: '20px',
        padding: '20px',
        border: '2px solid #fff'
      }}>
        <h1 style={{ margin: 0, fontSize: '24px', color: '#00ff00' }}>
          SYSTEM RECOVERY MODE
        </h1>
        <p style={{ marginTop: '10px', color: '#cccccc' }}>
          PixiJS and external modules are disabled.
        </p>
      </div>

      {/* 簡易コンソールログ表示エリア */}
      <div style={{
        width: '90%',
        flex: 1,
        backgroundColor: '#111',
        border: '1px solid #333',
        borderRadius: '4px',
        padding: '10px',
        overflowY: 'auto',
        fontFamily: 'monospace',
        fontSize: '11px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        marginBottom: '20px',
        boxShadow: 'inset 0 0 10px #000'
      }}>
        {logs.length === 0 ? (
          <div style={{ color: '#555' }}>Waiting for logs...</div>
        ) : (
          logs.map((log, index) => {
            const isError = log.startsWith('[ERR]') || log.startsWith('[WIN_ERR]');
            return (
              <div 
                key={index} 
                style={{ 
                  marginBottom: '4px', 
                  color: isError ? '#ff4444' : '#00ff00',
                  borderBottom: '1px solid #222'
                }}
              >
                {log}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
