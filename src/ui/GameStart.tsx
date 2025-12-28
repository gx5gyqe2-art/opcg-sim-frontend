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
      minHeight: '100vh', // height から minHeight に変更し、縦伸びを許容
      width: '100vw',
      background: 'linear-gradient(135deg, #1a1c2c 0%, #4a192c 100%)',
      color: '#fff',
      fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      padding: '20px', // 全体に余白を追加
      boxSizing: 'border-box',
      overflowY: 'auto' // 縦にはみ出た場合にスクロール可能にする
    }}>
      <div style={{
        fontSize: 'clamp(24px, 8vw, 48px)', // 画面幅に合わせてフォントサイズを可変に
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
        flexWrap: 'wrap', // 狭い時に折り返す設定
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px',
        width: '100%',
        maxWidth: '1000px',
        marginBottom: '60px'
      }}>
        <DeckPanel name={p1Name} deck={p1Deck} label="PLAYER 1" side="left" />
        
        <div style={{
          fontSize: '32px',
          fontWeight: 'bold',
          color: '#ff4757',
          fontStyle: 'italic',
          padding: '10px 0'
        }}>
          VS
        </div>

        <DeckPanel name={p2Name} deck={p2Deck} label="PLAYER 2" side="right" />
      </div>

      <button 
        onClick={onStart}
        style={{
          padding: '16px clamp(32px, 10vw, 64px)',
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
        Duel Ready
      </button>
    </div>
  );
};

const DeckPanel = ({ name, deck, label, side }: { name: string, deck: string, label: string, side: 'left' | 'right' }) => (
  <div style={{
    width: '100%',
    maxWidth: '280px', // 固定幅から最大幅に変更
    padding: '24px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '16px',
    border: `2px solid ${side === 'left' ? '#54a0ff' : '#ff6b6b'}`,
    textAlign: 'center',
    backdropFilter: 'blur(10px)',
    boxSizing: 'border-box'
  }}>
    <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '8px' }}>{label}</div>
    <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', wordBreak: 'break-all' }}>{name}</div>
    <div style={{
      padding: '12px',
      background: 'rgba(0,0,0,0.3)',
      borderRadius: '8px',
      fontSize: '14px',
      color: '#00d2d3',
      wordBreak: 'break-all'
    }}>
      {deck.replace('.json', '')}
    </div>
  </div>
);

export default GameStart;
