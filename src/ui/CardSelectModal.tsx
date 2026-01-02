import React, { useState } from 'react';
import { LAYOUT_CONSTANTS, LAYOUT_PARAMS } from '../layout/layout.config';
import type { CardInstance } from '../game/types';

interface CardSelectModalProps {
  candidates: CardInstance[];
  message: string;
  minSelect: number;
  maxSelect: number;
  onConfirm: (selectedUuids: string[]) => void;
  onCancel?: () => void;
}

export const CardSelectModal: React.FC<CardSelectModalProps> = ({ 
  candidates, message, minSelect, maxSelect, onConfirm, onCancel 
}) => {
  const [selected, setSelected] = useState<string[]>([]);
  const { COLORS } = LAYOUT_CONSTANTS;
  const { SHAPE, SHADOWS, UI_DETAILS } = LAYOUT_PARAMS;

  const handleToggle = (uuid: string) => {
    setSelected(prev => {
      if (prev.includes(uuid)) {
        return prev.filter(id => id !== uuid);
      }
      if (maxSelect === 1) {
        return [uuid]; // 単数選択なら入れ替え
      }
      if (prev.length >= maxSelect) {
        return prev; // 上限到達
      }
      return [...prev, uuid];
    });
  };

  const isValid = selected.length >= minSelect && selected.length <= maxSelect;

  // スタイル定義
  const overlayStyle: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: COLORS.OVERLAY_MODAL_BG,
    zIndex: 3000,
    display: 'flex', justifyContent: 'center', alignItems: 'center'
  };

  const modalStyle: React.CSSProperties = {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '8px',
    maxWidth: '800px',
    width: '90%',
    maxHeight: '80vh',
    display: 'flex', flexDirection: 'column',
    boxShadow: SHADOWS.MODAL
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
    gap: '12px',
    overflowY: 'auto',
    flex: 1,
    padding: '10px'
  };

  const cardStyle = (isSelected: boolean): React.CSSProperties => ({
    border: isSelected ? `3px solid ${COLORS.BTN_PRIMARY}` : '1px solid #ccc',
    borderRadius: SHAPE.CORNER_RADIUS_CARD,
    padding: '8px',
    cursor: 'pointer',
    backgroundColor: isSelected ? '#e3f2fd' : 'white',
    position: 'relative',
    height: '140px',
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
  });

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ marginBottom: '16px', textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 8px 0' }}>{message}</h3>
          <div style={{ fontSize: '0.9rem', color: '#666' }}>
            選択中: {selected.length} / {maxSelect}枚 (最小 {minSelect}枚)
          </div>
        </div>

        <div style={gridStyle}>
          {candidates.map(card => (
            <div 
              key={card.uuid} 
              onClick={() => handleToggle(card.uuid)}
              style={cardStyle(selected.includes(card.uuid))}
            >
              <div style={{ fontWeight: 'bold', fontSize: '0.8rem', overflow: 'hidden', height: '3em' }}>
                {card.name}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#555' }}>
                {card.type}
              </div>
              <div style={{ 
                marginTop: 'auto', 
                fontWeight: 'bold', 
                color: COLORS.TEXT_POWER,
                textAlign: 'center' 
              }}>
                {'power' in card ? (card as any).power : ''}
              </div>
              {selected.includes(card.uuid) && (
                <div style={{
                  position: 'absolute', top: '4px', right: '4px',
                  backgroundColor: COLORS.BTN_PRIMARY, color: 'white',
                  borderRadius: '50%', width: '20px', height: '20px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px'
                }}>✓</div>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
          {onCancel && (
            <button 
              onClick={onCancel}
              style={{
                padding: '10px 20px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: COLORS.BTN_SECONDARY,
                color: 'white',
                cursor: 'pointer'
              }}
            >
              キャンセル
            </button>
          )}
          <button 
            onClick={() => isValid && onConfirm(selected)}
            disabled={!isValid}
            style={{
              padding: '10px 20px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: isValid ? COLORS.BTN_PRIMARY : COLORS.BTN_DISABLED,
              color: 'white',
              cursor: isValid ? 'pointer' : 'not-allowed',
              fontWeight: 'bold'
            }}
          >
            決定する
          </button>
        </div>
      </div>
    </div>
  );
};
