import React, { useEffect } from 'react';
import CONST from '../../shared_constants.json';
import { logger } from '../utils/logger';

interface CardDetailSheetProps {
  card: any;
  location: string;
  isMyTurn: boolean; 
  onAction: (type: string, payload: any) => Promise<void>;
  onClose: () => void;
}

export const CardDetailSheet: React.FC<CardDetailSheetProps> = ({ card, location, isMyTurn, onAction, onClose }) => {
  useEffect(() => {
    logger.log({
      level: 'debug',
      action: "debug.sheet_mount",
      msg: `Detail sheet mounted for: ${card.name}`,
      payload: { uuid: card.uuid, location }
    });
  }, [card.name, card.uuid, location]);

  const ACTIONS = CONST.c_to_s_interface.GAME_ACTIONS.TYPES;

  const handleExecute = async (type: string, extra: any = {}) => {
    logger.log({
      level: 'info',
      action: "trace.handleExecute_called",
      msg: `Execute clicked: ${type}`,
      payload: { type, uuid: card.uuid }
    });
    await onAction(type, { ...card, extra });
  };

  const renderButtons = () => {
    const btns = [];

    if (!isMyTurn) {
      return btns; 
    }

    if (location === 'hand') {
      btns.push(
        <button key="play" onClick={() => handleExecute(ACTIONS.PLAY)} style={btnStyle("#2ecc71", "white")}>
          登場させる
        </button>
      );
    }

    if (location === 'field' || location === 'leader') {
      btns.push(
        <button key="attack" onClick={() => handleExecute(ACTIONS.ATTACK)} style={btnStyle("#e74c3c", "white")}>
          攻撃する
        </button>
      );
      btns.push(
        <button key="don" onClick={() => handleExecute(ACTIONS.ATTACH_DON)} style={btnStyle("#f1c40f", "#333")}>
          ドン!!付与 (+1)
        </button>
      );

      if (card.text?.includes('起動メイン')) {
        btns.push(
          <button key="activate" onClick={() => handleExecute(ACTIONS.ACTIVATE_MAIN)} style={btnStyle("#3498db", "white")}>
            効果起動
          </button>
        );
      }
    }
    
    return btns;
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={sheetStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{card.name}</h2>
            <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#999' }}>×</button>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <span style={badgeStyle('#333')}>{location.toUpperCase()}</span>
            {card.attribute && <span style={badgeStyle('#c0392b')}>{card.attribute}</span>}
            {card.traits && card.traits.map((trait: string, idx: number) => (
              <span key={idx} style={badgeStyle('#34495e')}>{trait}</span>
            ))}
          </div>
          <p style={{ fontSize: '0.9rem', color: '#444', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{card.text}</p>
          <div style={{ marginTop: '15px', fontWeight: 'bold', display: 'flex', gap: '20px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
            {card.power !== undefined && <span>POWER: {card.power}</span>}
            {card.cost !== undefined && <span>COST: {card.cost}</span>}
            {card.counter !== undefined && card.counter > 0 && <span>COUNTER: +{card.counter}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {renderButtons()}
          <button onClick={onClose} style={btnStyle("#95a5a6", "white")}>閉じる</button>
        </div>
      </div>
    </div>
  );
};

const badgeStyle = (bg: string): React.CSSProperties => ({
  backgroundColor: bg,
  color: 'white',
  padding: '2px 8px',
  borderRadius: '4px',
  fontSize: '0.7rem',
  fontWeight: 'bold'
});

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-end',
  zIndex: 2000
};

const sheetStyle: React.CSSProperties = {
  backgroundColor: 'white',
  width: '100%',
  maxWidth: '500px',
  padding: '24px',
  borderRadius: '20px 20px 0 0',
  boxShadow: '0 -4px 16px rgba(0,0,0,0.2)',
  boxSizing: 'border-box'
};

const btnStyle = (bg: string, color: string): React.CSSProperties => ({
  padding: '14px',
  borderRadius: '12px',
  border: 'none',
  backgroundColor: bg,
  color: color,
  fontWeight: 'bold',
  fontSize: '1rem',
  cursor: 'pointer'
});
