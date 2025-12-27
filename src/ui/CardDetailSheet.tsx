import React, { useEffect } from 'react'; // 【修正】useEffectをインポート
import CONST from '../../shared_constants.json';

interface CardDetailSheetProps {
  card: any;
  location: string;
  onAction: (type: string, payload: any) => Promise<void>;
  onClose: () => void;
}

export const CardDetailSheet: React.FC<CardDetailSheetProps> = ({ card, location, onAction, onClose }) => {
  // 【修正】マウント時ロガーの追加
  useEffect(() => {
    fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: "FE_SHEET",
        action: "debug.sheet_mount",
        msg: `Detail sheet mounted for: ${card.name}`,
        payload: { uuid: card.uuid, location },
        timestamp: new Date().toISOString()
      })
    }).catch(() => {});
  }, []);

  const ACTIONS = CONST.c_to_s_interface.GAME_ACTIONS.TYPES;

  const handleExecute = async (type: string, extra: any = {}) => {
    await onAction(type, {
      card_id: card.uuid,
      ...extra
    });
    onClose();
  };

  const renderButtons = () => {
    const buttons = [];

    if (location === 'hand') {
      buttons.push(
        <button key="play" onClick={() => handleExecute(ACTIONS.PLAY)} style={btnStyle("#2ecc71", "white")}>
          登場させる
        </button>
      );
    }

    if (location === 'field' || location === 'leader') {
      if (!card.is_rest) {
        buttons.push(
          <button key="attack" onClick={() => handleExecute(ACTIONS.ATTACK)} style={btnStyle("#e74c3c", "white")}>
            アタック
          </button>
        );
      }
      
      buttons.push(
        <button key="attach" onClick={() => handleExecute(ACTIONS.ATTACH_DON, { extra: { count: 1 } })} style={btnStyle("#f1c40f", "black")}>
          ドン!!を1枚付与
        </button>
      );

      if (card.text && card.text.includes('起動メイン')) {
        buttons.push(
          <button key="activate" onClick={() => handleExecute(ACTIONS.ACTIVATE_MAIN)} style={btnStyle("#3498db", "white")}>
            効果発動
          </button>
        );
      }
    }

    return buttons;
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={contentStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ margin: '0 0 10px 0', fontSize: '1.2rem' }}>{card.name}</h2>
          <p style={{ fontSize: '0.9rem', color: '#666', lineHeight: '1.4' }}>{card.text}</p>
          <div style={{ marginTop: '10px', fontWeight: 'bold', display: 'flex', gap: '15px' }}>
            {card.power !== undefined && <span>POWER: {card.power}</span>}
            {card.cost !== undefined && <span>COST: {card.cost}</span>}
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

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.7)',
  display: 'flex', 
  justifyContent: 'center', 
  alignItems: 'center',
  zIndex: 1000
};

const contentStyle: React.CSSProperties = {
  backgroundColor: 'white',
  padding: '20px',
  borderRadius: '12px',
  width: '85%',
  maxWidth: '350px',
  maxHeight: '80vh',
  overflowY: 'auto'
};

const btnStyle = (bg: string, color: string): React.CSSProperties => ({
  padding: '12px',
  border: 'none',
  borderRadius: '6px',
  fontWeight: 'bold',
  cursor: 'pointer',
  backgroundColor: bg,
  color: color,
  fontSize: '1rem'
});