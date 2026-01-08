import React, { useState, useEffect } from 'react';
import { API_CONFIG } from '../api/api.config';

interface DeckOption {
  id: string;
  name: string;
}

interface GameStartProps {
  onStart: (p1Deck: string, p2Deck: string) => void;
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
        
        // デフォルトのデッキ
        const defaults = [
          { id: 'imu.json', name: 'Imu (Default)' },
          { id: 'nami.json', name: 'Nami (Default)' }
        ];

        let loadedDecks: DeckOption[] = [];
        if (data.success && Array.isArray(data.decks)) {
          // DBのデッキには "db:" プレフィックスをつける（バックエンドの識別用）
          loadedDecks = data.decks.map((d: any) => ({
            id: `db:${d.id}`,
            name: d.name
          }));
        }
        
        setDeckOptions([...defaults, ...loadedDecks]);
      } catch (e) {
        console.error("Failed to load decks", e);
        // エラー時もデフォルトデッキは使えるようにする
        setDeckOptions([
          { id: 'imu.json', name: 'Imu (Default)' },
          { id: 'nami.json', name: 'Nami (Default)' }
        ]);
      }
    };
    fetchDecks();
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100vw',
      background: 'linear-gradient(135deg, #1a1c2c 0%, #4a192c 100%)',
      color: '#fff',
      fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      padding: '20px',
      boxSizing: 'border-box',
    }}>
      <div style={{
        fontSize: 'clamp(32px, 8vw, 56px)',
        fontWeight: '900',
        marginBottom: '40px',
        textShadow: '0 0 20px rgba(255,255,255,0.3)',
        letterSpacing: '4px',
        textAlign: 'center'
      }}>
        BATTLE START
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '30px',
        width: '100%',
        maxWidth: '500px',
        marginBottom: '50px',
        background: 'rgba(0,0,0,0.3)',
        padding: '30px',
        borderRadius: '16px',
        backdropFilter: 'blur(5px)'
      }}>
        
        {/* PLAYER 1 Selection */}
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#54a0ff' }}>PLAYER 1</label>
          <select 
            value={p1Deck}
            onChange={(e) => setP1Deck(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #555',
              background: '#222',
              color: 'white',
              fontSize: '16px'
            }}
          >
            {deckOptions.map(opt => (
              <option key={`p1-${opt.id}`} value={opt.id}>{opt.name}</option>
            ))}
          </select>
        </div>

        <div style={{ textAlign: 'center', fontSize: '24px', fontStyle: 'italic', fontWeight: 'bold', color: '#aaa' }}>VS</div>

        {/* PLAYER 2 Selection */}
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#ff6b6b' }}>PLAYER 2</label>
          <select 
            value={p2Deck}
            onChange={(e) => setP2Deck(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #555',
              background: '#222',
              color: 'white',
              fontSize: '16px'
            }}
          >
            {deckOptions.map(opt => (
              <option key={`p2-${opt.id}`} value={opt.id}>{opt.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
        <button 
          onClick={onDeckBuilder}
          style={{
            padding: '16px 32px',
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#fff',
            backgroundColor: '#e67e22',
            border: 'none',
            borderRadius: '50px',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(230, 126, 34, 0.4)',
            transition: 'transform 0.2s',
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          デッキ作成
        </button>

        <button 
          onClick={() => onStart(p1Deck, p2Deck)}
          style={{
            padding: '16px 48px',
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#fff',
            backgroundColor: '#ff4757',
            border: 'none',
            borderRadius: '50px',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(255, 71, 87, 0.4)',
            transition: 'transform 0.2s',
            textTransform: 'uppercase'
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          DUEL START
        </button>
      </div>
    </div>
  );
};

export default GameStart;
