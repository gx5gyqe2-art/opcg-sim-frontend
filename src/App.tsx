import { Component, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { RealGame } from './screens/RealGame';
import GameStart from './ui/GameStart';

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
  const [isStarted, setIsStarted] = useState(false);

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
        {!isStarted ? (
          <GameStart 
            p1Name="p1" 
            p1Deck="imu.json" 
            p2Name="p2" 
            p2Deck="nami.json" 
            onStart={() => setIsStarted(true)} 
          />
        ) : (
          <RealGame />
        )}
      </ErrorBoundary>
    </div>
  );
}
