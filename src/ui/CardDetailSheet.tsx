import React, { useEffect } from 'react';
import CONST from '../../shared_constants.json';
import { logger } from '../utils/logger'; // 共通ロガーをインポート

interface CardDetailSheetProps {
  card: any;
  location: string;
  onAction: (type: string, payload: any) => Promise<void>;
  onClose: () => void;
}

export const CardDetailSheet: React.FC<CardDetailSheetProps> = ({ card, location, onAction, onClose }) => {
  useEffect(() => {
    // 古い fetch を廃止し、共通ロガーを使用
    logger.log({
      level: 'debug',
      action: "debug.sheet_mount",
      msg: `Detail sheet mounted for: ${card.name}`,
      payload: { uuid: card.uuid, location }
    });
  }, [card.name, card.uuid, location]);

  const ACTIONS = CONST.c_to_s_interface.GAME_ACTIONS.TYPES;

  const handleExecute = async (type: string, extra: any = {}) => {
    console.log("!!! SHEET_EXECUTE_START !!!", type);
    
    // アクション実行時も共通ロガーを使用
    logger.log({
      level: 'info',
      action: "trace.handleExecute_called",
      msg: `Execute clicked: ${type}`,
      payload: { type, uuid: card.uuid }
    });

    // 親コンポーネント（RealGame.tsx）の handleAction を呼び出す
    await onAction(type, { ...card, extra });
  };

  const renderButtons = () => {
    const btns = [];
    if (location === 'hand') {
      btns.push(
        <button 
          key="play" 
          onClick={() => handleExecute(ACTIONS.PLAY)} 
          style={btnStyle("#2ecc71", "white")}
        >
          登場させる
        </button>
      );
    }
    if (location === 'field' && !card.is_rest) {
      btns.push(
        <button 
          key="attack" 
          onClick={() => handleExecute(ACTIONS.ATTACK)} 
          style={btnStyle("#e74c3c", "white")}
        >
          アタック
        </button>
      );
      btns.push(
        <button 
          key="don" 
          onClick={() => handleExecute(ACTIONS.ATTACH_DON)} 
          style={btnStyle("#f1c40f", "black")}
        >
          ドン!!を付与
        </button>
      );
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
    cursor: 'pointer'
  });

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
  maxWidth: '400px'
};
