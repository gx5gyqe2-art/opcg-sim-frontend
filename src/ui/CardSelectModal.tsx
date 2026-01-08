import React, { useState } from 'react';
import { LAYOUT_CONSTANTS, LAYOUT_PARAMS } from '../layout/layout.config';
import type { CardInstance } from '../game/types';
import { API_CONFIG } from '../api/api.config'; // 追加

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
  const { SHAPE, SHADOWS } = LAYOUT_PARAMS;

  const handleToggle = (uuid: string) => {
    setSelected(prev => {
      if (prev.includes(uuid)) {
        return prev.filter(id => id !== uuid);
      }
      if (maxSelect === 1) {
        return [uuid];
      }
      if (prev.length >= maxSelect) {
        return prev;
      }
      return [...prev, uuid];
    });
  };

  const isValid = selected.length >= minSelect && selected.length <= maxSelect;

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
    gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', // 画像に合わせてサイズ調整
    gap: '10px',
    overflowY: 'auto',
    flex: 1,
    padding: '10px'
  };

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
          {candidates.map(card => {
            const isSelected = selected.includes(card.uuid);
            const imageUrl = `${API_CONFIG.IMAGE_BASE_URL}/${card.card_id}.png`;

            return (
              <div 
                key={card.uuid} 
                onClick={() => handleToggle(card.uuid)}
                style={{
                  border: isSelected ? `3px solid ${COLORS.BTN_PRIMARY}` : '1px solid #ccc',
                  borderRadius: SHAPE.CORNER_RADIUS_CARD,
                  cursor: 'pointer',
                  backgroundColor: '#444', // 画像読み込み前用の背景
                  position: 'relative',
                  aspectRatio: '0.714', // カード比率
                  overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <img 
                  src={imageUrl} 
                  alt={card.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    // 読み込み失敗時はテキストを表示
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement!.innerHTML = `<span style="color:white;font-size:0.7rem;padding:2px;text-align:center;">${card.name}</span>`;
                  }}
                />
                
                {/* 選択中のチェックマーク */}
                {isSelected && (
                  <div style={{
                    position: 'absolute', top: '4px', right: '4px',
                    backgroundColor: COLORS.BTN_PRIMARY, color: 'white',
                    borderRadius: '50%', width: '24px', height: '24px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', zIndex: 10, border: '2px solid white'
                  }}>✓</div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
          {onCancel && (
            <button 
              onClick={onCancel}
              style={{
                padding: '10px 20px', borderRadius: '4px', border: 'none',
                backgroundColor: COLORS.BTN_SECONDARY, color: 'white', cursor: 'pointer'
              }}
            >
              キャンセル
            </button>
          )}
          <button 
            onClick={() => isValid && onConfirm(selected)}
            disabled={!isValid}
            style={{
              padding: '10px 20px', borderRadius: '4px', border: 'none',
              backgroundColor: isValid ? COLORS.BTN_PRIMARY : COLORS.BTN_DISABLED,
              color: 'white', cursor: isValid ? 'pointer' : 'not-allowed',
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
