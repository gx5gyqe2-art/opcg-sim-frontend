import React, { useEffect } from 'react';
import CONST from '../../shared_constants.json';
import { logger } from '../utils/logger';
import type { CardInstance, BoardCard, LeaderCard } from '../game/types';

interface CardDetailSheetProps {
  card: CardInstance;
  location: string;
  isMyTurn: boolean; 
  onAction: (type: string, payload: any) => Promise<void>;
  onClose: () => void;
  // 追加: カードリスト（トラッシュ一覧などを表示する場合）
  cardList?: CardInstance[];
}

export const CardDetailSheet: React.FC<CardDetailSheetProps> = ({ card, location, isMyTurn, onAction, onClose, cardList }) => {
  useEffect(() => {
    logger.log({
      level: 'debug',
      action: "debug.sheet_mount",
      msg: `Detail sheet mounted for: ${card.name}`,
      payload: { uuid: card.uuid, location, listSize: cardList?.length }
    });
  }, [card.name, card.uuid, location, cardList]);

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
    // リスト表示モードの場合はボタンを表示しない（必要なら個別のカードに対するアクションを実装）
    if (cardList && cardList.length > 0) return null;

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

  // トラッシュ一覧などのレンダリング
  const renderCardList = () => {
    if (!cardList) return null;
    return (
      <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
        {cardList.length === 0 && <div style={{color: '#777', textAlign: 'center'}}>カードがありません</div>}
        {cardList.map((c, idx) => (
          <div key={`${c.uuid}-${idx}`} style={{ 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
            padding: '8px', backgroundColor: '#f9f9f9', borderRadius: '6px', border: '1px solid #eee' 
          }}>
            <div style={{ fontWeight: 'bold' }}>{c.name}</div>
            <div style={{ fontSize: '0.8rem', color: '#666' }}>
              {'power' in c ? `P:${(c as any).power}` : ''} {'cost' in c ? `C:${(c as any).cost}` : ''}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={sheetStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '1.4rem' }}>
              {cardList ? `${card.name} (${cardList.length})` : (card.name || 'Unknown Card')}
            </h2>
            <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#999' }}>×</button>
          </div>
          
          {/* リストがある場合はリストを表示、そうでなければ詳細を表示 */}
          {cardList ? (
            renderCardList()
          ) : (
            <>
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
            </>
          )}
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
  maxHeight: '80vh', // 追加：リストが長い場合に備えて
  display: 'flex', // 追加
  flexDirection: 'column', // 追加
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
