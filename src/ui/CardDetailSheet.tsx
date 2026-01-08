import React, { useEffect } from 'react';
import CONST from '../../shared_constants.json';
import { logger } from '../utils/logger';
import { LAYOUT_CONSTANTS, LAYOUT_PARAMS } from '../layout/layout.config';
import { API_CONFIG } from '../api/api.config'; // 追加
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
    logger.log({ level: 'debug', action: "debug.sheet_mount", msg: `Detail sheet: ${card.name}` });
  }, [card]);

  const ACTIONS = CONST.c_to_s_interface.GAME_ACTIONS.TYPES;

  const handleExecute = async (type: string, extra: any = {}) => {
    await onAction(type, { uuid: card.uuid, extra });
  };

  const renderButtons = () => {
    const btns: React.ReactElement[] = [];
    if (isMyTurn && location === 'hand') {
      btns.push(<button key="play" onClick={() => handleExecute(ACTIONS.PLAY)} style={btnStyle(COLORS.BTN_SUCCESS, COLORS.TEXT_LIGHT)}>登場させる</button>);
    }
    if (isMyTurn && (location === 'field' || location === 'leader')) {
      btns.push(<button key="attack" onClick={() => handleExecute(ACTIONS.ATTACK)} style={btnStyle(COLORS.BTN_DANGER, COLORS.TEXT_LIGHT)}>攻撃する</button>);
      btns.push(<button key="don" onClick={() => handleExecute(ACTIONS.ATTACH_DON)} style={btnStyle(COLORS.BTN_WARNING, COLORS.TEXT_DEFAULT)}>ドン!!付与 (+1)</button>);
      if ('text' in card && card.text?.includes('起動メイン')) {
        btns.push(<button key="activate" onClick={() => handleExecute(ACTIONS.ACTIVATE_MAIN)} style={btnStyle(COLORS.BTN_PRIMARY, COLORS.TEXT_LIGHT)}>効果起動</button>);
      }
    }
    return btns;
  };

  // --- スタイル定義 ---
  const overlayStyle: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: COLORS.OVERLAY_MODAL_BG,
    display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
    zIndex: Z_INDEX.SHEET
  };
  const sheetStyle: React.CSSProperties = {
    backgroundColor: 'white', width: '100%', maxWidth: UI_DETAILS.MODAL_MAX_WIDTH,
    padding: '24px', borderRadius: SHAPE.CORNER_RADIUS_MODAL,
    boxShadow: SHADOWS.MODAL, boxSizing: 'border-box',
    maxHeight: '90vh', overflowY: 'auto'
  };
  const btnStyle = (bg: string, color: string | number): React.CSSProperties => ({
    padding: '14px', borderRadius: SHAPE.CORNER_RADIUS_BTN, border: 'none',
    backgroundColor: bg, color: String(color), fontWeight: 'bold', fontSize: '1rem',
    cursor: 'pointer', width: '100%'
  });
  const badgeStyle = (bg: string): React.CSSProperties => ({
    backgroundColor: bg, color: 'white', padding: '2px 8px',
    borderRadius: SHAPE.CORNER_RADIUS_SHEET_BADGE, fontSize: '0.7rem', fontWeight: 'bold'
  });

  // 画像URL生成
  const imageUrl = ('card_id' in card) ? `${API_CONFIG.IMAGE_BASE_URL}/${(card as any).card_id}.png` : null;

  // --- 重なりカード一覧表示 (今回は変更なし) ---
  if (card.cards && card.cards.length > 0) {
    return (
      <div style={overlayStyle} onClick={onClose}>
        <div style={sheetStyle} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h2 style={{ margin: 0 }}>{card.name} ({card.cards.length})</h2>
            <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
          </div>
          {/* ... (省略: 重なりカードのリスト表示は変更なし) ... */}
          <div style={{ marginTop: '10px' }}>
            <button onClick={onClose} style={btnStyle(COLORS.BTN_SECONDARY, COLORS.TEXT_LIGHT)}>閉じる</button>
          </div>
        </div>
      </div>
    );
  }

  // --- 詳細表示 ---
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={sheetStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
          
          {/* ▼▼▼ 画像表示エリア ▼▼▼ */}
          {imageUrl && (
            <div style={{ marginBottom: '15px' }}>
              <img 
                src={imageUrl} 
                alt={card.name} 
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '300px', // 画面からはみ出さないよう制限
                  borderRadius: '8px',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
                }} 
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'; // 読み込み失敗時は非表示
                }}
              />
            </div>
          )}
          {/* ▲▲▲ 画像エリアここまで ▲▲▲ */}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', textAlign: 'left' }}>
            <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{card.name || 'Unknown Card'}</h2>
            <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#999' }}>×</button>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px', justifyContent: 'flex-start' }}>
            <span style={badgeStyle(COLORS.BADGE_LOC)}>{location.toUpperCase()}</span>
            {'attribute' in card && card.attribute && <span style={badgeStyle(COLORS.BADGE_ATTR)}>{card.attribute}</span>}
            {'traits' in card && card.traits && card.traits.map((trait: string, idx: number) => (
              <span key={idx} style={badgeStyle(COLORS.BADGE_TRAIT)}>{trait}</span>
            ))}
          </div>
          
          <p style={{ fontSize: '0.9rem', color: '#444', lineHeight: '1.6', whiteSpace: 'pre-wrap', textAlign: 'left' }}>
            {'text' in card ? card.text : ''}
          </p>
          
          <div style={{ marginTop: '15px', fontWeight: 'bold', display: 'flex', gap: '20px', borderTop: '1px solid #eee', paddingTop: '10px', justifyContent: 'center' }}>
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
