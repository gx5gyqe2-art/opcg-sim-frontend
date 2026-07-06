import { Component, useState, useEffect } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { RealGame } from './screens/RealGame';
import { SandboxGame } from './screens/SandboxGame';
import GameStart from './ui/GameStart';
import { DeckBuilder } from './screens/DeckBuilder';
import { RoomLobby } from './screens/RoomLobby';
import { RuleLobby } from './screens/RuleLobby';
import { FlagshipEvents } from './flagship/FlagshipEvents';
import { API_CONFIG } from './api/api.config';
import { setImageVersion } from './utils/imageAssets';

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

  componentDidCatch(_error: Error, errorInfo: ErrorInfo) {
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

type AppMode = 'start' | 'game' | 'deck' | 'sandbox' | 'cardList' | 'lobby' | 'ruleLobby' | 'flagship';
type SandboxOptions = { role: 'both' | 'p1' | 'p2'; gameId?: string; room_name?: string };
// ルールモード・オンライン対戦の接続情報（null = ソロのルールモード）。
type RuleOnlineOptions = { gameId: string; role: 'p1' | 'p2'; roomName?: string } | null;
// ルールモード・CPU 対戦の設定（null = CPU 対戦ではない）。
type RuleCpuOptions = { difficulty: 'learned' | 'hard' } | null;

export default function App() {
  // 対策①：初期値をsessionStorageから復元するように変更
  const [mode, setMode] = useState<AppMode>(() => {
    return (sessionStorage.getItem('opcg_app_mode') as AppMode | null) || 'start';
  });

  const [selectedDecks, setSelectedDecks] = useState<{ p1: string; p2: string }>(() => {
    const saved = sessionStorage.getItem('opcg_selected_decks');
    if (saved) {
      const parsed = JSON.parse(saved) as { p1?: string; p2?: string };
      // db: 形式以外（旧サンプルデッキ 'imu.json' 等の残骸）は無効化して選択し直させる
      const sanitize = (id?: string) => (id && id.startsWith('db:') ? id : '');
      return { p1: sanitize(parsed.p1), p2: sanitize(parsed.p2) };
    }
    return { p1: '', p2: '' };
  });

  const [sandboxOptions, setSandboxOptions] = useState<SandboxOptions>(() => {
    const saved = sessionStorage.getItem('opcg_sandbox_options');
    return saved ? JSON.parse(saved) : { role: 'both' };
  });

  const [ruleOnline, setRuleOnline] = useState<RuleOnlineOptions>(() => {
    const saved = sessionStorage.getItem('opcg_rule_online');
    return saved ? JSON.parse(saved) : null;
  });

  const [ruleCpu, setRuleCpu] = useState<RuleCpuOptions>(() => {
    const saved = sessionStorage.getItem('opcg_rule_cpu');
    return saved ? JSON.parse(saved) : null;
  });

  // 起動時に画像キャッシュ版数を取得し、以降の getCardImageUrl に ?v= として反映する。
  // 取得前は localStorage の前回値で描画するためブロッキングしない（失敗時も無害）。
  useEffect(() => {
    let aborted = false;
    fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ASSETS_VERSION}`)
      .then(r => r.json())
      .then(data => { if (!aborted && data?.success && data.v) setImageVersion(String(data.v)); })
      .catch(() => { /* オフライン等: 前回版数のまま継続 */ });
    return () => { aborted = true; };
  }, []);

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

  useEffect(() => {
    if (ruleOnline) sessionStorage.setItem('opcg_rule_online', JSON.stringify(ruleOnline));
    else sessionStorage.removeItem('opcg_rule_online');
  }, [ruleOnline]);

  useEffect(() => {
    if (ruleCpu) sessionStorage.setItem('opcg_rule_cpu', JSON.stringify(ruleCpu));
    else sessionStorage.removeItem('opcg_rule_cpu');
  }, [ruleCpu]);

  const handleStart = (p1: string, p2: string, gameMode: 'normal' | 'sandbox' = 'normal', sbOptions?: SandboxOptions) => {

    if (gameMode === 'sandbox') {
        // メニューから新規にサンドボックスを開始する場合は、前回の進行中ゲーム保存を破棄する
        // （クラッシュ/リロード復帰用の保存を、意図的な新規開始と区別するため）
        sessionStorage.removeItem('opcg_sandbox_state');
        setSelectedDecks({ p1, p2 });
        setSandboxOptions(sbOptions || { role: 'both' });
        setMode('sandbox');
    } else {
        // ソロのルールモード開始時はオンライン/CPU 設定を破棄する。
        setRuleOnline(null);
        setRuleCpu(null);
        setSelectedDecks({ p1, p2 });
        setMode('game');
    }
  };

  // ルールモード・オンライン対戦の開始（ロビーから入室/作成）。
  const startRuleOnline = (gameId: string, role: 'p1' | 'p2', roomName?: string) => {
    setRuleCpu(null);
    setRuleOnline({ gameId, role, roomName });
    setMode('game');
  };

  // ルールモード・CPU 対戦の開始（人間=p1。デッキは RealGame のセットアップ画面で選ぶ）。
  const startRuleCpu = (difficulty: 'learned' | 'hard') => {
    setRuleOnline(null);
    setRuleCpu({ difficulty });
    setSelectedDecks({ p1: '', p2: '' });
    setMode('game');
  };

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#1a1a1a', overflow: 'hidden', position: 'fixed', top: 0, left: 0, touchAction: 'none' }}>
      <ErrorBoundary>
        {mode === 'start' && (
          <GameStart onStart={handleStart} onStartCpu={startRuleCpu} onDeckBuilder={() => setMode('deck')} onCardList={() => setMode('cardList')} onRuleLobby={() => setMode('ruleLobby')} onFlagship={() => setMode('flagship')} />
        )}
        {mode === 'flagship' && (
          <FlagshipEvents onBack={() => setMode('start')} />
        )}
        {mode === 'game' && (
          <RealGame
            key={ruleOnline ? ruleOnline.gameId : (ruleCpu ? 'cpu' : 'solo')}
            p1Deck={selectedDecks.p1}
            p2Deck={selectedDecks.p2}
            gameId={ruleOnline?.gameId}
            myPlayerId={ruleOnline ? ruleOnline.role : 'both'}
            roomName={ruleOnline?.roomName}
            vsCpu={!!ruleCpu}
            cpuDifficulty={ruleCpu?.difficulty}
            onBack={() => { if (confirm("終了しますか？")) { setRuleOnline(null); setRuleCpu(null); setMode('start'); } }}
            onForceBack={() => { setRuleOnline(null); setMode('ruleLobby'); }}
          />
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
          <DeckBuilder
            onBack={() => setMode('start')}
            viewOnly={mode === 'cardList'}
          />
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
        {mode === 'ruleLobby' && (
          <RuleLobby
            onBack={() => setMode('start')}
            onJoin={(gameId, role, roomName) => startRuleOnline(gameId, role, roomName)}
            onCreate={(gameId) => {
              localStorage.setItem('opcg_rule_host_game', gameId);
              startRuleOnline(gameId, 'p1');
            }}
          />
        )}
      </ErrorBoundary>
    </div>
  );
}