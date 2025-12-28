import React from 'react';

interface GameStartProps {
  p1Name: string;
  p1Deck: string;
  p2Name: string;
  p2Deck: string;
  onStart: () => void;
}

const GameStart: React.FC<GameStartProps> = ({ p1Name, p1Deck, p2Name, p2Deck, onStart }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'linear-gradient(135deg, #1a1c2c 0%, #4a192c 100%)',
      color: '#fff',
      fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    }}>
      <div style={{
        fontSize: '48px',
        fontWeight: '900',
        marginBottom: '40px',
        textShadow: '0 0 20px rgba(255,255,255,0.3)',
        letterSpacing: '4px'
      }}>
        BATTLE START
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '40px',
        marginBottom: '60px'
      }}>
        <DeckPanel name={p1Name} deck={p1Deck} label="PLAYER 1" side="left" />
        
        <div style={{
          fontSize: '32px',
          fontWeight: 'bold',
          color: '#ff4757',
          fontStyle: 'italic'
        }}>
          VS
        </div>

        <DeckPanel name={p2Name} deck={p2Deck} label="PLAYER 2" side="right" />
      </div>

      <button 
        onClick={onStart}
        style={{
          padding: '16px 64px',
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#fff',
          backgroundColor: '#ff4757',
          border: 'none',
          borderRadius: '50px',
          cursor: 'pointer',
          boxShadow: '0 4px 15px rgba(255, 71, 87, 0.4)',
          transition: 'transform 0.2s, background-color 0.2s',
          textTransform: 'uppercase'
        }}
        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        Duel Ready
      </button>
    </div>
  );
};

const DeckPanel = ({ name, deck, label, side }: { name: string, deck: string, label: string, side: 'left' | 'right' }) => (
  <div style={{
    width: '280px',
    padding: '24px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '16px',
    border: `2px solid ${side === 'left' ? '#54a0ff' : '#ff6b6b'}`,
    textAlign: 'center',
    backdropFilter: 'blur(10px)'
  }}>
    <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '8px' }}>{label}</div>
    <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>{name}</div>
    <div style={{
      padding: '12px',
      background: 'rgba(0,0,0,0.3)',
      borderRadius: '8px',
      fontSize: '14px',
      color: '#00d2d3'
    }}>
      {deck.replace('.json', '')}
    </div>
  </div>
);

export default GameStart;