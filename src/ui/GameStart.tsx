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
  // --- グランド・バトル風スタイル ---
  const styles = {
    container: {
      minHeight: '100vh', width: '100vw',
      background: 'radial-gradient(circle at center, #5e2c2c 0%, #1a0b0b 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      color: '#f0e6d2', fontFamily: '"Times New Roman", serif'
    },
    // タイトルはゴールドのグラデーション
    title: {
      fontSize: 'clamp(40px, 8vw, 80px)', fontWeight: '900', marginBottom: '40px',
      background: 'linear-gradient(to bottom, #ffd700, #b8860b)',
      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      filter: 'drop-shadow(0 2px 0px black)', letterSpacing: '5px'
    },
    // パネルは羊皮紙風
    panel: {
      background: '#f4e4bc', border: '4px solid #8b4513',
      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
      padding: '40px', borderRadius: '8px',
      width: '90%', maxWidth: '500px', color: '#3e2723'
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
