import React, { useState, useEffect } from 'react';
import { API_CONFIG } from '../api/api.config';
import './GameUI.css'; // CSS読み込み

interface DeckOption { id: string; name: string; }
interface GameStartProps { onStart: (p1: string, p2: string) => void; onDeckBuilder: () => void; }

const GameStart: React.FC<GameStartProps> = ({ onStart, onDeckBuilder }) => {
  const [deckOptions, setDeckOptions] = useState<DeckOption[]>([]);
  const [p1Deck, setP1Deck] = useState('imu.json');
  const [p2Deck, setP2Deck] = useState('nami.json');

  useEffect(() => {
    const fetchDecks = async () => {
      try {
        const res = await fetch(`${API_CONFIG.BASE_URL}/api/deck/list`);
        const data = await res.json();
        const defaults = [{ id: 'imu.json', name: 'Imu (Default)' }, { id: 'nami.json', name: 'Nami (Default)' }];
        let loadedDecks: DeckOption[] = [];
        if (data.success && Array.isArray(data.decks)) {
          loadedDecks = data.decks.map((d: any) => ({ id: `db:${d.id}`, name: d.name }));
        }
        setDeckOptions([...defaults, ...loadedDecks]);
      } catch {
        setDeckOptions([{ id: 'imu.json', name: 'Imu (Default)' }, { id: 'nami.json', name: 'Nami (Default)' }]);
      }
    };
    fetchDecks();
  }, []);

  // --- サイバー・スタイル定義 ---
  const styles = {
    container: {
      minHeight: '100vh', width: '100vw',
      background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
      backgroundSize: '400% 400%',
      animation: 'bg-pan 15s ease infinite',
      display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontFamily: '"Courier New", monospace', position: 'relative' as const, overflow: 'hidden'
    },
    gridOverlay: {
      position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0,
      backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 255, 255, 0.05) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(255, 0, 0, 0.02), rgba(255, 0, 0, 0.06))',
      backgroundSize: '100% 2px, 3px 100%', pointerEvents: 'none' as const, zIndex: 0
    },
    title: {
      fontSize: 'clamp(40px, 8vw, 80px)', fontWeight: 'bold', marginBottom: '60px',
      textShadow: '2px 2px 0px #ff00ff, -2px -2px 0px #00ffff', letterSpacing: '8px',
      zIndex: 1, textTransform: 'uppercase' as const
    },
    panel: {
      background: 'rgba(0, 0, 0, 0.6)', border: '1px solid #00ffff',
      boxShadow: '0 0 15px rgba(0, 255, 255, 0.3), inset 0 0 20px rgba(0, 255, 255, 0.1)',
      padding: '40px', borderRadius: '4px', backdropFilter: 'blur(5px)',
      display: 'flex', flexDirection: 'column' as const, gap: '30px',
      width: '90%', maxWidth: '600px', zIndex: 1, position: 'relative' as const
    },
    selectLabel: {
      display: 'block', marginBottom: '8px', fontSize: '14px', color: '#00ffff', letterSpacing: '2px'
    },
    select: {
      width: '100%', padding: '12px', background: '#111', color: '#fff',
      border: '1px solid #333', borderRadius: '0', fontSize: '16px', fontFamily: 'inherit',
      outline: 'none', cursor: 'pointer'
    },
    vs: {
      textAlign: 'center' as const, fontSize: '30px', fontWeight: 'bold',
      color: '#ff00ff', textShadow: '0 0 10px #ff00ff', margin: '-10px 0'
    },
    mainBtn: {
      background: 'linear-gradient(90deg, #ff00ff, #00ffff)', border: 'none',
      padding: '20px 60px', fontSize: '24px', fontWeight: 'bold', color: '#000',
      clipPath: 'polygon(10% 0, 100% 0, 100% 80%, 90% 100%, 0 100%, 0 20%)',
      cursor: 'pointer', letterSpacing: '4px', marginTop: '20px', zIndex: 1
    },
    subBtn: {
      background: 'transparent', border: '2px solid #00ffff', color: '#00ffff',
      padding: '10px 30px', fontSize: '16px', cursor: 'pointer',
      marginTop: '20px', marginRight: '20px', letterSpacing: '2px', zIndex: 1
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.gridOverlay}></div>
      
      <div style={styles.title}>OPCG SIM</div>

      <div style={styles.panel}>
        {/* 装飾用コーナー */}
        <div style={{ position: 'absolute', top: -1, left: -1, width: 20, height: 20, borderTop: '2px solid #00ffff', borderLeft: '2px solid #00ffff' }}></div>
        <div style={{ position: 'absolute', bottom: -1, right: -1, width: 20, height: 20, borderBottom: '2px solid #00ffff', borderRight: '2px solid #00ffff' }}></div>

        <div>
          <label style={styles.selectLabel}>PLAYER 1 // SYSTEM.DECK</label>
          <select value={p1Deck} onChange={(e) => setP1Deck(e.target.value)} style={{...styles.select, borderLeft: '4px solid #00ffff'}}>
            {deckOptions.map(opt => <option key={`p1-${opt.id}`} value={opt.id}>{opt.name}</option>)}
          </select>
        </div>

        <div style={styles.vs}>/// VS ///</div>

        <div>
          <label style={{...styles.selectLabel, color: '#ff00ff'}}>PLAYER 2 // TARGET.DECK</label>
          <select value={p2Deck} onChange={(e) => setP2Deck(e.target.value)} style={{...styles.select, borderLeft: '4px solid #ff00ff'}}>
            {deckOptions.map(opt => <option key={`p2-${opt.id}`} value={opt.id}>{opt.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button onClick={onDeckBuilder} style={styles.subBtn} className="hover-scale">DECK BUILD</button>
        <button onClick={() => onStart(p1Deck, p2Deck)} style={styles.mainBtn} className="hover-scale">
          INITIALIZE
        </button>
      </div>
    </div>
  );
};

export default GameStart;
