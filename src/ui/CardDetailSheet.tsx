import React, { useEffect } from 'react';
import CONST from '../../shared_constants.json';
import { logger } from '../utils/logger';
import { LAYOUT_CONSTANTS, LAYOUT_PARAMS } from '../layout/layout.config';
import type { CardInstance, BoardCard, LeaderCard } from '../game/types';

interface CardDetailSheetProps {
  card: CardInstance & { cards?: CardInstance[] };
  location: string;
  isMyTurn: boolean; 
  onAction: (type: string, payload: any) => Promise<void>;
  onClose: () => void;
}

export const CardDetailSheet: React.FC<CardDetailSheetProps> = ({ card, location, isMyTurn, onAction, onClose }) => {
  const { COLORS } = LAYOUT_CONSTANTS;
  const { UI_DETAILS, Z_INDEX, SHAPE, SHADOWS } = LAYOUT_PARAMS;

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
        <button key="play" onClick={() => handleExecute(ACTIONS.PLAY)} style={btnStyle(COLORS.BTN_SUCCESS, COLORS.TEXT_LIGHT)}>
          登場させる
        </button>
      );
    }
    if (isMyTurn && (location === 'field' || location === 'leader')) {
      btns.push(
        <button key="attack" onClick={() => handleExecute(ACTIONS.ATTACK)} style={btnStyle(COLORS.BTN_DANGER, COLORS.TEXT_LIGHT)}>
          攻撃する
        </button>
      );
      btns.push(
        <button key="don" onClick={() => handleExecute(ACTIONS.ATTACH_DON)} style={btnStyle(COLORS.BTN_WARNING, COLORS.TEXT_DEFAULT)}>
          ドン!!付与 (+1)
        </button>
      );
      if ('text' in card && card.text?.includes('起動メイン')) {
        btns.push(
          <button key="activate" onClick={() => handleExecute(ACTIONS.ACTIVATE_MAIN)} style={btnStyle(COLORS.BTN_PRIMARY, COLORS.TEXT_LIGHT)}>
            効果起動
          </button>
        );
      }
    }
    return btns;
  };

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: COLORS.OVERLAY_MODAL_BG,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-end',
    zIndex: Z_INDEX.SHEET
  };

  const sheetStyle: React.CSSProperties = {
    backgroundColor: 'white',
    width: '100%',
    maxWidth: UI_DETAILS.MODAL_MAX_WIDTH,
    padding: '24px',
    borderRadius: SHAPE.CORNER_RADIUS_MODAL,
    boxShadow: SHADOWS.MODAL,
    boxSizing: 'border-box'
  };

  const btnStyle = (bg: string, color: string | number): React.CSSProperties => ({
    padding: '14px',
    borderRadius: SHAPE.CORNER_RADIUS_BTN,
    border: 'none',
    backgroundColor: bg,
    color: String(color),
    fontWeight: 'bold',
    fontSize: '1rem',
    cursor: 'pointer',
    width: '100%'
  });

  const badgeStyle = (bg: string): React.CSSProperties => ({
    backgroundColor: bg,
    color: 'white',
    padding: '2px 8px',
    borderRadius: SHAPE.CORNER_RADIUS_SHEET_BADGE,
    fontSize: '0.7rem',
    fontWeight: 'bold'
  });

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
                width: UI_DETAILS.THUMBNAIL_WIDTH, height: UI_DETAILS.THUMBNAIL_HEIGHT, fontSize: '0.7rem', 
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                backgroundColor: '#fff'
              }}>
                <div style={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                <div style={{ textAlign: 'center', fontSize: '1rem', color: COLORS.BTN_DANGER }}>
                  {'power' in c ? String((c as any).power) : '-'}
                </div>
                <div style={{ fontSize: '0.6rem', color: '#666' }}>
                  {'type' in c ? String((c as any).type) : ''}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '10px' }}>
            <button onClick={onClose} style={btnStyle(COLORS.BTN_SECONDARY, COLORS.TEXT_LIGHT)}>閉じる</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={sheetStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{card.name || 'Unknown Card'}</h2>
            <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#999' }}>×</button>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <span style={badgeStyle(COLORS.BADGE_LOC)}>{location.toUpperCase()}</span>
            {'attribute' in card && card.attribute && <span style={badgeStyle(COLORS.BADGE_ATTR)}>{card.attribute}</span>}
            {'traits' in card && card.traits && card.traits.map((trait: string, idx: number) => (
              <span key={idx} style={badgeStyle(COLORS.BADGE_TRAIT)}>{trait}</span>
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
          <button onClick={onClose} style={btnStyle(COLORS.BTN_SECONDARY, COLORS.TEXT_LIGHT)}>閉じる</button>
        </div>
      </div>
    </div>
  );
};
