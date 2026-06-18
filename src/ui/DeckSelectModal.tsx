import React from 'react';
import { getCardImageUrl } from '../utils/imageAssets';
import { ModalShell } from './common/ModalShell';
import { LAYOUT_PARAMS } from '../layout/layout.config';

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

  const { MODAL } = LAYOUT_PARAMS;

  return (
    <ModalShell title={title} onClose={onClose} width="800px" padding="18px">
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {options.map(opt => (
          <div
            key={opt.id}
            onClick={() => handleDeckClick(opt)}
            role="button"
            tabIndex={0}
            style={{
              display: 'flex', alignItems: 'center',
              background: 'rgba(255,255,255,0.05)', borderRadius: '8px', cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.12)',
              padding: '10px', minHeight: '80px', transition: 'background 0.2s',
              touchAction: 'manipulation'
            }}
            className="hover-scale"
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.10)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
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
              <div style={{ color: MODAL.TEXT_PRIMARY, fontWeight: 'bold', fontSize: '16px' }}>
                {opt.name}
              </div>
              <div style={{ color: MODAL.TEXT_MUTED, fontSize: '12px', marginTop: '4px', fontFamily: 'monospace' }}>
                ID: {opt.id}
              </div>
            </div>

            {/* 矢印アイコン */}
            <div style={{ color: MODAL.TEXT_MUTED, fontSize: '20px', marginLeft: '10px' }}>›</div>
          </div>
        ))}
      </div>
    </ModalShell>
  );
};
