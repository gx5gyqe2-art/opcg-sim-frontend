import { Component, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { RealGame } from './screens/RealGame';
import GameStart from './ui/GameStart';
// 新規作成したDeckBuilderをインポート
import { DeckBuilder } from './screens/DeckBuilder'; 

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// 元のコードにあったErrorBoundaryクラスをそのまま維持
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          backgroundColor: '#330000',
          color: '#ffaaaa',
          height: '100vh',
          fontFamily: 'monospace',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <h2 style={{ color: '#ff5555' }}>⚠️ RENDER ERROR</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>
            {this.state.error && this.state.error.toString()}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  // 画面モードの状態管理: 'start' | 'game' | 'deck'
  const [mode, setMode] = useState<'start' | 'game' | 'deck'>('start');

  return (
    <div 
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#1a1a1a',
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0,
        touchAction: 'none'
      }}
    >
      <ErrorBoundary>
        {mode === 'start' && (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {/* 既存のGameStartコンポーネントを使用 */}
            <GameStart 
              p1Name="P1" 
              p2Name="P2" 
              p1Deck="imu.json" // デフォルト値（必要に応じて変更可）
              p2Deck="nami.json" 
              onStart={() => setMode('game')} 
            />
            
            {/* デッキ作成画面への遷移ボタンを追加（画面右上に配置） */}
            <button 
              onClick={() => setMode('deck')}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                padding: '10px 20px',
                backgroundColor: '#e67e22',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                fontWeight: 'bold',
                cursor: 'pointer',
                zIndex: 100 // GameStartより手前に表示
              }}
            >
              デッキ作成
            </button>
          </div>
        )}

        {mode === 'game' && (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {/* ゲーム中もTOPに戻れるようにボタンを配置（任意） */}
            <button 
              onClick={() => {
                if(confirm("タイトルに戻りますか？")) setMode('start');
              }}
              style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  zIndex: 1000,
                  padding: '5px 10px',
                  background: 'rgba(0,0,0,0.5)',
                  color: 'white',
                  border: '1px solid #555',
                  cursor: 'pointer'
              }}
            >
              TOPへ
            </button>
            <RealGame />
          </div>
        )}

        {mode === 'deck' && (
          // デッキビルダーを表示
          <DeckBuilder onBack={() => setMode('start')} />
        )}

      </ErrorBoundary>
    </div>
  );
}
