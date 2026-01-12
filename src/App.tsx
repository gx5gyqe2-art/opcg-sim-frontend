import { Component, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { RealGame } from './screens/RealGame';
import { SandboxGame } from './screens/SandboxGame';
import GameStart from './ui/GameStart';
import { DeckBuilder } from './screens/DeckBuilder';
import { RoomLobby } from './screens/RoomLobby';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

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
  const [mode, setMode] = useState<'start' | 'game' | 'deck' | 'sandbox' | 'cardList' | 'lobby'>('start');
  const [selectedDecks, setSelectedDecks] = useState<{ p1: string; p2: string }>({
    p1: 'imu.json',
    p2: 'nami.json'
  });
  
  const [sandboxOptions, setSandboxOptions] = useState<{ role: 'both' | 'p1' | 'p2', gameId?: string, room_name?: string }>({ role: 'both' });

  // 共通のゲーム開始ハンドラー
  const handleStart = (p1: string, p2: string, gameMode: 'normal' | 'sandbox' = 'normal', sbOptions?: any) => {
    setSelectedDecks({ p1, p2 });
    if (gameMode === 'sandbox') {
        setSandboxOptions(sbOptions || { role: 'both' });
        setMode('sandbox');
    } else {
        setMode('game');
    }
  };

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
          <GameStart 
            onStart={handleStart}
            onDeckBuilder={() => setMode('deck')}
            onCardList={() => setMode('cardList')}
            onLobby={() => setMode('lobby')}
          />
        )}
        
        {mode === 'game' && (
          <RealGame 
            p1Deck={selectedDecks.p1} 
            p2Deck={selectedDecks.p2}
            onBack={() => {
              if (confirm("ゲームを終了してタイトルに戻りますか？")) {
                setMode('start');
              }
            }}
          />
        )}

        {mode === 'sandbox' && (
          <SandboxGame 
            p1Deck={selectedDecks.p1} 
            p2Deck={selectedDecks.p2}
            myPlayerId={sandboxOptions.role === 'both' ? 'both' : sandboxOptions.role}
            gameId={sandboxOptions.gameId}
            onBack={() => {
              if (confirm("サンドボックスを終了しますか？")) {
                setMode('start');
              }
            }}
          />
        )}

        {(mode === 'deck' || mode === 'cardList') && (
          <DeckBuilder 
            onBack={() => setMode('start')} 
            viewOnly={mode === 'cardList'} 
          />
        )}

        {mode === 'lobby' && (
          <RoomLobby 
            onBack={() => setMode('start')}
            onJoin={(gameId) => handleStart(selectedDecks.p1, selectedDecks.p2, 'sandbox', { role: 'p2', gameId })}
          />
        )}
      </ErrorBoundary>
    </div>
  );
}
