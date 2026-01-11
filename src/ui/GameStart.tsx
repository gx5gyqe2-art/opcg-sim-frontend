import React, { useState, useEffect } from 'react';
import { API_CONFIG } from '../api/api.config';
import './GameUI.css'; 

interface DeckOption {
  id: string;
  name: string;
}

interface GameStartProps {
  onStart: (p1: string, p2: string, mode?: 'normal' | 'sandbox') => void;
  onDeckBuilder: () => void;
}

const GameStart: React.FC<GameStartProps> = ({ onStart, onDeckBuilder }) => {
  const [deckOptions, setDeckOptions] = useState<DeckOption[]>([]);
  const [p1Deck, setP1Deck] = useState('imu.json');
  const [p2Deck, setP2Deck] = useState('nami.json');

  useEffect(() => {
    const fetchDecks = async () => {
      try {
        const res = await fetch(`${API_CONFIG.BASE_URL}/api/deck/list`);
        const data = await res.json();
        
        const defaults = [
          { id: 'imu.json', name: 'Imu (Default)' },
          { id: 'nami.json', name: 'Nami (Default)' }
        ];

        let loadedDecks: DeckOption[] = [];
        if (data.success && Array.isArray(data.decks)) {
          loadedDecks = data.decks.map((d: any) => ({
            id: `db:${d.id}`,
            name: d.name
          }));
        }
        
        setDeckOptions([...defaults, ...loadedDecks]);
      } catch (e) {
        console.error("Failed to load decks", e);
        setDeckOptions([
          { id: 'imu.json', name: 'Imu (Default)' },
          { id: 'nami.json', name: 'Nami (Default)' }
        ]);
      }
    };
    fetchDecks();
  }, []);

  const styles = {
    container: {
      minHeight: '100vh',
      width: '100vw',
      background: 'radial-gradient(circle at center, #3e2723 0%, #1a0b0b 100%)',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      color: '#f0e6d2',
      fontFamily: '"Times New Roman", "YuMincho", "Hiragino Mincho ProN", serif',
      position: 'relative' as const,
      overflow: 'hidden'
    },
    bgOverlay: {
      position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0,
      backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.1) 0px, rgba(0,0,0,0.1) 2px, transparent 2px, transparent 20px)',
      pointerEvents: 'none' as const,
      zIndex: 0
    },
    title: {
      fontSize: 'clamp(40px, 8vw, 80px)',
      fontWeight: '900',
      marginBottom: '50px',
      background: 'linear-gradient(to bottom, #ffd700, #b8860b, #8b4513)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      filter: 'drop-shadow(0 4px 0px rgba(0,0,0,0.8))',
      letterSpacing: '6px',
      zIndex: 1,
      textTransform: 'uppercase' as const
    },
    panel: {
      background: '#f4e4bc',
      border: '6px solid #5d4037',
      boxShadow: '0 10px 40px rgba(0,0,0,0.7), inset 0 0 30px rgba(139, 69, 19, 0.2)',
      borderRadius: '8px',
      padding: '40px',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '30px',
      width: '90%',
      maxWidth: '600px',
      zIndex: 1,
      position: 'relative' as const,
      color: '#3e2723'
    },
    rivet: (top: boolean, left: boolean) => ({
      position: 'absolute' as const,
      width: '12px', height: '12px',
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #ffd700, #8b4513)',
      boxShadow: '1px 1px 2px rgba(0,0,0,0.5)',
      top: top ? '10px' : 'auto',
      bottom: !top ? '10px' : 'auto',
      left: left ? '10px' : 'auto',
      right: !left ? '10px' : 'auto'
    }),
    selectGroup: {
      display: 'flex', flexDirection: 'column' as const, gap: '8px'
    },
    label: {
      fontSize: '16px', fontWeight: 'bold', color: '#5d4037',
      textTransform: 'uppercase' as const, letterSpacing: '1px'
    },
    select: {
      width: '100%', padding: '12px',
      background: '#fff8e1',
      color: '#3e2723',
      border: '2px solid #8b4513',
      borderRadius: '4px',
      fontSize: '18px',
      fontFamily: 'inherit',
      fontWeight: 'bold',
      outline: 'none',
      cursor: 'pointer',
      boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.1)'
    },
    vs: {
      textAlign: 'center' as const,
      fontSize: '36px',
      fontWeight: 'bold',
      color: '#8b0000',
      textShadow: '0 2px 0 rgba(0,0,0,0.2)',
      margin: '-10px 0',
      fontStyle: 'italic'
    },
    actions: {
      display: 'flex', gap: '20px', marginTop: '30px', zIndex: 1, alignItems: 'center'
    },
    subBtn: {
      background: 'transparent',
      border: '2px solid #d4af37',
      color: '#d4af37',
      padding: '12px 30px',
      fontSize: '16px',
      fontWeight: 'bold',
      borderRadius: '4px',
      cursor: 'pointer',
      fontFamily: 'inherit',
      textShadow: '0 1px 2px black'
    },
    mainBtn: {
      background: 'linear-gradient(to bottom, #d32f2f, #b71c1c)',
      border: '2px solid #ffeba7',
      padding: '18px 60px',
      fontSize: '24px',
      fontWeight: 'bold',
      color: '#fff',
      borderRadius: '4px',
      cursor: 'pointer',
      boxShadow: '0 5px 15px rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,0.3)',
      textShadow: '0 2px 0 #3e2723',
      fontFamily: 'inherit',
      letterSpacing: '2px'
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.bgOverlay}></div>
      <div style={styles.title}>OPCG SIM</div>
      <div style={styles.panel}>
        <div style={styles.rivet(true, true)}></div>
        <div style={styles.rivet(true, false)}></div>
        <div style={styles.rivet(false, true)}></div>
        <div style={styles.rivet(false, false)}></div>

        <div style={styles.selectGroup}>
          <label style={styles.label}>Player 1 (Host)</label>
          <select 
            value={p1Deck}
            onChange={(e) => setP1Deck(e.target.value)}
            style={styles.select}
          >
            {deckOptions.map(opt => (
              <option key={`p1-${opt.id}`} value={opt.id}>{opt.name}</option>
            ))}
          </select>
        </div>

        <div style={styles.vs}>VS</div>

        <div style={styles.selectGroup}>
          <label style={styles.label}>Player 2 (Opponent)</label>
          <select 
            value={p2Deck}
            onChange={(e) => setP2Deck(e.target.value)}
            style={styles.select}
          >
            {deckOptions.map(opt => (
              <option key={`p2-${opt.id}`} value={opt.id}>{opt.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={styles.actions}>
        <button 
          onClick={onDeckBuilder}
          style={styles.subBtn}
          className="hover-scale"
        >
          デッキ作成
        </button>

        <button 
          onClick={() => onStart(p1Deck, p2Deck, 'sandbox')}
          style={{ ...styles.subBtn, borderColor: '#2ecc71', color: '#2ecc71' }}
          className="hover-scale"
        >
          1人回し
        </button>

        <button 
          onClick={() => onStart(p1Deck, p2Deck, 'normal')}
          style={styles.mainBtn}
          className="hover-scale"
        >
          決闘開始
        </button>
      </div>
    </div>
  );
};

export default GameStart;
