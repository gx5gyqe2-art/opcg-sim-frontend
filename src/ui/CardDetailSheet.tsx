import React, { useEffect, useState } from 'react';
import CONST from '../../shared_constants.json';
import { LAYOUT_CONSTANTS, LAYOUT_PARAMS } from '../layout/layout.config';
// ▼ 変更: imageAssetsから関数をインポート
import { getCardImageUrl } from '../utils/imageAssets';
import type { CardInstance, BoardCard, LeaderCard } from '../game/types';
import { getAvailableActions, type CardActionKey } from '../game/cardActions';

interface CardDetailSheetProps {
  card: CardInstance & { cards?: CardInstance[] };
  location: string;
  isMyTurn: boolean;
  activeDonCount?: number;
  onAction: (type: string, payload: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}

export const CardDetailSheet: React.FC<CardDetailSheetProps> = ({ card, location, isMyTurn, activeDonCount = 0, onAction, onClose }) => {
  const { COLORS } = LAYOUT_CONSTANTS;
  const { UI_DETAILS, Z_INDEX, SHAPE, SHADOWS } = LAYOUT_PARAMS;

  // ドン付与モード用ステート
  const [donMode, setDonMode] = useState(false);
  const [donAmount, setDonAmount] = useState(1);

  useEffect(() => {
  }, [card.name, card.uuid, location]);

  const ACTIONS = CONST.c_to_s_interface.GAME_ACTIONS.TYPES;

  const handleExecute = async (type: string, extra: Record<string, unknown> = {}) => {
    await onAction(type, { uuid: card.uuid, extra });
  };

  // ドン付与一括実行ロジック
  const handleAttachDonBatch = async () => {
    for (let i = 0; i < donAmount; i++) {
        await onAction(ACTIONS.ATTACH_DON, { uuid: card.uuid });
    }
    setDonMode(false);
    onClose();
  };

  const renderButtons = () => {
    if (donMode) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', background: '#f0f0f0', padding: '10px', borderRadius: '8px' }}>
          <div style={{ fontWeight: 'bold' }}>ドン!!を付与する枚数</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button 
              onClick={() => setDonAmount(Math.max(1, donAmount - 1))}
              style={btnStyle(COLORS.BTN_SECONDARY, 'white')}
            >-</button>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{donAmount}</div>
            <button 
              onClick={() => setDonAmount(Math.min(activeDonCount, donAmount + 1))}
              disabled={donAmount >= activeDonCount}
              style={btnStyle(donAmount >= activeDonCount ? COLORS.BTN_DISABLED : COLORS.BTN_SECONDARY, 'white')}
            >+</button>
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>可能: {activeDonCount}枚</div>
          <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
            <button onClick={() => setDonMode(false)} style={btnStyle(COLORS.BTN_SECONDARY, COLORS.TEXT_LIGHT)}>キャンセル</button>
            <button onClick={handleAttachDonBatch} style={btnStyle(COLORS.BTN_WARNING, COLORS.TEXT_DEFAULT)}>決定</button>
          </div>
        </div>
      );
    }

    // ボタンの表示可否はカード種別・ロケーションに基づき getAvailableActions に一元化。
    // ステージカードに攻撃/ドン付与が出るバグはこのヘルパー側で防いでいる。
    const actionStyles: Record<CardActionKey, React.CSSProperties> = {
      play: btnStyle(COLORS.BTN_SUCCESS, COLORS.TEXT_LIGHT),
      attack: btnStyle(COLORS.BTN_DANGER, COLORS.TEXT_LIGHT),
      don: btnStyle(COLORS.BTN_WARNING, COLORS.TEXT_DEFAULT),
      activate: btnStyle(COLORS.BTN_PRIMARY, COLORS.TEXT_LIGHT),
    };
    const actionHandlers: Record<CardActionKey, () => void> = {
      play: () => handleExecute(ACTIONS.PLAY),
      attack: () => handleExecute(ACTIONS.ATTACK),
      don: () => { setDonAmount(1); setDonMode(true); },
      activate: () => handleExecute(ACTIONS.ACTIVATE_MAIN),
    };

    return getAvailableActions(card, location, isMyTurn, activeDonCount).map(a => (
      <button key={a.key} onClick={actionHandlers[a.key]} style={actionStyles[a.key]}>
        {a.label}
      </button>
    ));
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

  // ▼ 変更: getCardImageUrlを使用
  const mainImageUrl = ('card_id' in card) ? getCardImageUrl((card as { card_id: string }).card_id) : null;

  if (card.cards && card.cards.length > 0) {
    return (
      <div style={overlayStyle} onClick={onClose}>
        <div style={sheetStyle} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h2 style={{ margin: 0 }}>{card.name} ({card.cards.length})</h2>
            <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ maxHeight: '60vh', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '8px' }}>
            {card.cards.map((c, idx) => {
              // ▼ 変更: getCardImageUrlを使用
              const imgUrl = getCardImageUrl(c.card_id);
              return (
                <div key={idx} style={{ 
                  aspectRatio: '0.714',
                  borderRadius: '4px', 
                  overflow: 'hidden',
                  border: '1px solid #ccc',
                  backgroundColor: '#444',
                  position: 'relative'
                }}>
                  <img 
                    src={imgUrl} 
                    alt={c.name}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement!.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:white;font-size:0.7rem;text-align:center;padding:2px;">${c.name}</div>`;
                    }}
                  />
                </div>
              );
            })}
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
        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
          
          {mainImageUrl && (
            <div style={{ marginBottom: '15px' }}>
              <img 
                src={mainImageUrl} 
                alt={card.name} 
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '300px', 
                  borderRadius: '8px',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
                }} 
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}

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
            {card.is_frozen && <span style={badgeStyle(COLORS.BADGE_FROZEN_CSS)}>凍結</span>}
            {card.ability_disabled && <span style={badgeStyle(COLORS.BADGE_NEGATE_CSS)}>効果無効</span>}
          </div>
          <p style={{ fontSize: '0.9rem', color: '#444', lineHeight: '1.6', whiteSpace: 'pre-wrap', textAlign: 'left' }}>
            {'text' in card ? card.text : ''}
          </p>
          {'trigger_text' in card && card.trigger_text && (
            <p style={{ fontSize: '0.9rem', color: '#444', lineHeight: '1.6', whiteSpace: 'pre-wrap', textAlign: 'left', borderTop: '1px solid #eee', paddingTop: '8px', marginTop: '4px' }}>
              <span style={{ fontWeight: 'bold', color: COLORS.BADGE_ATTR }}>【トリガー】</span> {card.trigger_text}
            </p>
          )}
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
          {!donMode && (
            <button onClick={onClose} style={btnStyle(COLORS.BTN_SECONDARY, COLORS.TEXT_LIGHT)}>閉じる</button>
          )}
        </div>
      </div>
    </div>
  );
};
