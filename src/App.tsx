import { Component, useState, useEffect } from 'react';
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
        <div style={{ padding: '20px', backgroundColor: '#330000', color: '#ffaaaa', height: '100vh', fontFamily: 'monospace', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <h2 style={{ color: '#ff5555' }}>⚠️ RENDER ERROR</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>{this.state.error && this.state.error.toString()}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  // 対策①：初期値をsessionStorageから復元するように変更
  const [mode, setMode] = useState<'start' | 'game' | 'deck' | 'sandbox' | 'cardList' | 'lobby'>(() => {
    return (sessionStorage.getItem('opcg_app_mode') as any) || 'start';
  });

  const [selectedDecks, setSelectedDecks] = useState<{ p1: string; p2: string }>(() => {
    const saved = sessionStorage.getItem('opcg_selected_decks');
    return saved ? JSON.parse(saved) : { p1: 'imu.json', p2: 'nami.json' };
  });

  const [sandboxOptions, setSandboxOptions] = useState<{ role: 'both' | 'p1' | 'p2', gameId?: string, room_name?: string }>(() => {
    const saved = sessionStorage.getItem('opcg_sandbox_options');
    return saved ? JSON.parse(saved) : { role: 'both' };
  });

  // 対策①：状態が変更されるたびにsessionStorageへ保存
  useEffect(() => {
    sessionStorage.setItem('opcg_app_mode', mode);
  }, [mode]);

  useEffect(() => {
    sessionStorage.setItem('opcg_selected_decks', JSON.stringify(selectedDecks));
  }, [selectedDecks]);

  useEffect(() => {
    sessionStorage.setItem('opcg_sandbox_options', JSON.stringify(sandboxOptions));
  }, [sandboxOptions]);

  const handleStart = (p1: string, p2: string, gameMode: 'normal' | 'sandbox' = 'normal', sbOptions?: any) => {
    
    if (gameMode === 'sandbox') {
        // メニューから新規にサンドボックスを開始する場合は、前回の進行中ゲーム保存を破棄する
        // （クラッシュ/リロード復帰用の保存を、意図的な新規開始と区別するため）
        sessionStorage.removeItem('opcg_sandbox_state');
        setSelectedDecks({ p1, p2 });
        setSandboxOptions(sbOptions || { role: 'both' });
        setMode('sandbox');
    } else {
        setSelectedDecks({ 
          p1: p1 || 'imu.json', 
          p2: p2 || 'nami.json' 
        });
        setMode('game');
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#1a1a1a', overflow: 'hidden', position: 'fixed', top: 0, left: 0, touchAction: 'none' }}>
      <ErrorBoundary>
        {mode === 'start' && (
          <GameStart onStart={handleStart} onDeckBuilder={() => setMode('deck')} onCardList={() => setMode('cardList')} onLobby={() => setMode('lobby')} />
        )}
        {mode === 'game' && (
          <RealGame p1Deck={selectedDecks.p1} p2Deck={selectedDecks.p2} onBack={() => { if (confirm("終了しますか？")) setMode('start'); }} />
        )}
        {mode === 'sandbox' && (
          <SandboxGame
            myPlayerId={sandboxOptions.role === 'both' ? 'both' : sandboxOptions.role}
            gameId={sandboxOptions.gameId}
            roomName={sandboxOptions.room_name}
            initialP1DeckId={selectedDecks.p1}
            initialP2DeckId={selectedDecks.p2}
            onBack={() => { if (confirm("終了しますか？")) setMode('start'); }}
            onForceBack={() => setMode('lobby')}
          />
        )}
        {(mode === 'deck' || mode === 'cardList') && (
          <DeckBuilder onBack={() => setMode('start')} viewOnly={mode === 'cardList'} />
        )}
        {mode === 'lobby' && (
          <RoomLobby
            onBack={() => setMode('start')}
            onJoin={(gameId, role) => handleStart('', '', 'sandbox', { role, gameId })}
            onCreate={(gameId) => {
              localStorage.setItem('opcg_host_game', gameId);
              handleStart('', '', 'sandbox', { role: 'p1', gameId });
            }}
          />
        )}
      </ErrorBoundary>
    </div>
  );
}