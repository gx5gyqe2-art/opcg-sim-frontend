import React, { useEffect } from 'react';
import CONST from '../../shared_constants.json';
import { logger } from '../utils/logger';
import type { CardInstance, BoardCard, LeaderCard } from '../game/types';

interface CardDetailSheetProps {
  card: CardInstance & { cards?: CardInstance[] };
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
    await onAction(type, { uuid: card.uuid, extra });
  };

  const renderButtons = () => {
    const btns: React.ReactElement[] = [];
    if (isMyTurn && location === 'hand') {
      btns.push(
        <button key="play" onClick={() => handleExecute(ACTIONS.PLAY)} style={btnStyle("#2ecc71", "white")}>
          登場させる
        </button>
      );
    }
    if (isMyTurn && (location === 'field' || location === 'leader')) {
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
      if ('text' in card && card.text?.includes('起動メイン')) {
        btns.push(
          <button key="activate" onClick={() => handleExecute(ACTIONS.ACTIVATE_MAIN)} style={btnStyle("#3498db", "white")}>
            効果起動
          </button>
        );
      }
    }
    return btns;
  };

  // --- トラッシュ等のリスト表示モード ---
  if (card.cards && card.cards.length > 0) {
    return (
      <div style={overlayStyle} onClick={onClose}>
        <div style={sheetStyle} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h2 style={{ margin: 0 }}>{card.name} ({card.cards.length})</h2>
            <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {card.cards.map((c, idx) => (
              <div key={idx} style={{ 
                border: '1px solid #ccc', borderRadius: '4px', padding: '4px', 
                width: '80px', height: '110px', fontSize: '0.7rem', 
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                backgroundColor: '#fff'
              }}>
                <div style={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                {/* 修正: プロパティ存在チェックを追加して型エラーを回避 */}
                <div style={{ textAlign: 'center', fontSize: '1rem', color: '#e74c3c' }}>
                  {'power' in c ? c.power : '-'}
                </div>
                <div style={{ fontSize: '0.6rem', color: '#666' }}>
                  {'type' in c ? c.type : ''}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '10px' }}>
            <button onClick={onClose} style={btnStyle("#95a5a6", "white")}>閉じる</button>
          </div>
        </div>
      </div>
    );
  }

  // --- 通常の詳細表示モード ---
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={sheetStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{card.name || 'Unknown Card'}</h2>
            <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#999' }}>×</button>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <span style={badgeStyle('#333')}>{location.toUpperCase()}</span>
            {'attribute' in card && card.attribute && <span style={badgeStyle('#c0392b')}>{card.attribute}</span>}
            {'traits' in card && card.traits && card.traits.map((trait: string, idx: number) => (
              <span key={idx} style={badgeStyle('#34495e')}>{trait}</span>
            ))}
          </div>
          <p style={{ fontSize: '0.9rem', color: '#444', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
            {'text' in card ? card.text : ''}
          </p>
          <div style={{ marginTop: '15px', fontWeight: 'bold', display: 'flex', gap: '20px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
            {'power' in card && <span>POWER: {(card as LeaderCard | BoardCard).power}</span>}
            {'cost' in card && <span>COST: {(card as BoardCard).cost}</span>}
            {'counter' in card && (card as BoardCard).counter !== undefined && (card as BoardCard).counter! > 0 && (
              <span>COUNTER: +{(card as BoardCard).counter}</span>
            )}
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
  cursor: 'pointer',
  width: '100%'
});
