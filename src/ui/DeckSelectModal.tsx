import React from 'react';
import { getCardImageUrl } from '../utils/imageAssets';

export interface DeckOption {
  id: string;
  name: string;
  leaderId?: string;
}

interface DeckSelectModalProps {
  title: string;
  options: DeckOption[];
  onSelect: (deckId: string) => void;
  onClose: () => void;
}

export const DeckSelectModal: React.FC<DeckSelectModalProps> = ({ title, options, onSelect, onClose }) => {
  
  const handleDeckClick = (deck: DeckOption) => {
    onSelect(deck.id);
  };

  return (
    <div style={{ 
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 3000,
      display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'
    }}>
      <div style={{ width: '100%', maxWidth: '800px', maxHeight: '80vh', background: '#222', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '15px', borderBottom: '1px solid #444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: '#f0e6d2' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer' }}>×</button>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {options.map(opt => (
            <div 
              key={opt.id} 
              onClick={() => handleDeckClick(opt)}
              role="button"
              tabIndex={0}
              style={{ 
                display: 'flex', alignItems: 'center',
                background: '#333', borderRadius: '8px', cursor: 'pointer', border: '1px solid #555',
                padding: '10px', minHeight: '80px', transition: 'background 0.2s',
                touchAction: 'manipulation'
              }}
              className="hover-scale"
              onMouseOver={(e) => e.currentTarget.style.background = '#444'}
              onMouseOut={(e) => e.currentTarget.style.background = '#333'}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleDeckClick(opt);
                }
              }}
            >
              {/* 左側: リーダー画像 */}
              <div style={{ width: '50px', height: '70px', flexShrink: 0, marginRight: '15px', background: '#000', borderRadius: '4px', overflow: 'hidden', border: '1px solid #666' }}>
                {opt.leaderId ? (
                  <img
                    src={getCardImageUrl(opt.leaderId)}
                    alt="leader"
                    loading="lazy"
                    decoding="async"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      const img = e.currentTarget;
                      img.style.display = 'none';
                      if (img.parentElement) img.parentElement.innerText = opt.leaderId || 'No Img';
                    }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '10px' }}>No Img</div>
                )}
              </div>
              
              {/* 右側: デッキ情報 */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '16px' }}>
                  {opt.name}
                </div>
                {/* ▼▼▼ 追加: ID表示 ▼▼▼ */}
                <div style={{ color: '#aaa', fontSize: '12px', marginTop: '4px', fontFamily: 'monospace' }}>
                  ID: {opt.id}
                </div>
              </div>

              {/* 矢印アイコン */}
              <div style={{ color: '#666', fontSize: '20px', marginLeft: '10px' }}>›</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
