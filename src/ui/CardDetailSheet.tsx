import React, { useEffect } from 'react';
import CONST from '../../shared_constants.json';
import { logger } from '../utils/logger';

interface CardDetailSheetProps {
  card: any;
  location: string;
  onAction: (type: string, payload: any) => Promise<void>;
  onClose: () => void;
}

export const CardDetailSheet: React.FC<CardDetailSheetProps> = ({ card, location, onAction, onClose }) => {
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
    
    // 1. 手札にある場合
    if (location === 'hand') {
      btns.push(
        <button key="play" onClick={() => handleExecute(ACTIONS.PLAY)} style={btnStyle("#2ecc71", "white")}>
          登場させる
        </button>
      );
    }

    // 2. 盤面（フィールド）またはリーダーの場合
    if (location === 'field' || location === 'leader') {
      // 共通のアクション：ドン!!付与
      btns.push(
        <button key="don" onClick={() => handleExecute(ACTIONS.ATTACH_DON)} style={btnStyle("#f1c40f", "black")}>
          ドン!!を付与
        </button>
      );

      // 未レスト（アクティブ）ならアタック可能
      if (!card.is_rest) {
        btns.push(
          <button key="attack" onClick={() => handleExecute(ACTIONS.ATTACK)} style={btnStyle("#e74c3c", "white")}>
            アタック
          </button>
        );
      }

      // 効果（起動メイン等）を持っている場合のボタン（簡易判定）
      if (card.text && (card.text.includes('起動メイン') || card.text.includes('ターン1回'))) {
        btns.push(
          <button key="effect" onClick={() => handleExecute(ACTIONS.ACTIVATE_MAIN)} style={btnStyle("#3498db", "white")}>
            効果を発動
          </button>
        );
      }
    }

    return btns;
  };

  const btnStyle = (bg: string, color: string): React.CSSProperties => ({
    backgroundColor: bg,
    color: color,
    border: 'none',
    padding: '12px',
    borderRadius: '8px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '1rem',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  });

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={contentStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ margin: '0 0 10px 0', fontSize: '1.2rem' }}>{card.name}</h2>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <span style={badgeStyle('#333')}>{location.toUpperCase()}</span>
            {card.attribute && <span style={badgeStyle('#c0392b')}>{card.attribute}</span>}
          </div>
          <p style={{ fontSize: '0.9rem', color: '#444', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{card.text}</p>
          <div style={{ marginTop: '15px', fontWeight: 'bold', display: 'flex', gap: '20px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
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
  backgroundColor: 'rgba(0,0,0,0.75)',
  display: 'flex', 
  justifyContent: 'center', 
  alignItems: 'center',
  zIndex: 1000
};

const contentStyle: React.CSSProperties = {
  backgroundColor: 'white',
  padding: '25px',
  borderRadius: '16px',
  width: '85%',
  maxWidth: '400px',
  boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
};
