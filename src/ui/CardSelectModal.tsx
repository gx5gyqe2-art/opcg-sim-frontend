import React, { useState, useEffect } from 'react';
import { LAYOUT_CONSTANTS, LAYOUT_PARAMS } from '../layout/layout.config';
import type { CardInstance } from '../game/types';
// ▼ 変更: imageAssetsから関数をインポート
import { getCardImageUrl } from '../utils/imageAssets';

interface CardSelectModalProps {
  candidates: CardInstance[];
  message: string;
  minSelect: number;
  maxSelect: number;
  onConfirm: (selectedUuids: string[]) => void;
  onCancel?: () => void;
  selectableUuids?: string[];
}

export const CardSelectModal: React.FC<CardSelectModalProps> = ({
  candidates, message, minSelect, maxSelect, onConfirm, onCancel, selectableUuids
}) => {
  const { COLORS } = LAYOUT_CONSTANTS;
  const { SHAPE, SHADOWS } = LAYOUT_PARAMS;

  const selectableSet = selectableUuids ? new Set(selectableUuids) : null;
  const isSelectable = (uuid: string) => !selectableSet || selectableSet.has(uuid);
  const selectableCards = candidates.filter(c => isSelectable(c.uuid));

  // 並び替えモード: maxSelect < 0（REMAINING＝「残りを好きな順番で置く」）。全カードを
  // 配置順に並べて確定する。従来は max=-1 で1枚も選べず確定もできない致命的バグだった。
  const isOrderMode = maxSelect < 0;
  const effMax = isOrderMode ? selectableCards.length : maxSelect;

  const [selected, setSelected] = useState<string[]>([]);

  // 並び替えモードでは全選択可能カードを初期順序で確定対象にする。
  useEffect(() => {
    if (isOrderMode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 並び替えモード移行時に確定対象を初期化する意図的な同期
      setSelected(selectableCards.map(c => c.uuid));
    }
  }, [isOrderMode, candidates]);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = (uuid: string) => {
    if (!isSelectable(uuid) || isOrderMode) return;  // 並び替えモードはトグル不可（全配置）
    setSelected(prev => {
      if (prev.includes(uuid)) {
        return prev.filter(id => id !== uuid);
      }
      if (effMax === 1) {
        return [uuid];
      }
      if (prev.length >= effMax) {
        return prev;
      }
      return [...prev, uuid];
    });
  };

  // 並び替え: 配置順を入れ替える（↑↓）。
  const moveOrder = (uuid: string, dir: -1 | 1) => {
    setSelected(prev => {
      const i = prev.indexOf(uuid);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const isValid = isOrderMode
    ? selected.length === selectableCards.length
    : selected.length >= minSelect && selected.length <= effMax;

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
    gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', 
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
            {isOrderMode
              ? `配置順を ↑↓ で並び替えてください（${selected.length}枚を上から順に配置）`
              : `選択中: ${selected.length} / ${effMax}枚 (最小 ${minSelect}枚)`}
          </div>
        </div>

        <div style={gridStyle}>
          {/* 並び替えモードは selected（配置順）で描画し、それ以外は候補順で描画する */}
          {(isOrderMode
              ? selected.map(uid => candidates.find(c => c.uuid === uid)!).filter(Boolean)
              : candidates
          ).map((card, idx) => {
            const isSelected = selected.includes(card.uuid);
            const canSelect = isSelectable(card.uuid);
            const imageUrl = getCardImageUrl(card.card_id);
            const orderPos = isOrderMode ? selected.indexOf(card.uuid) : -1;

            return (
              <div
                key={card.uuid}
                onClick={() => handleToggle(card.uuid)}
                style={{
                  border: isSelected ? `3px solid ${COLORS.BTN_PRIMARY}` : '1px solid #ccc',
                  borderRadius: SHAPE.CORNER_RADIUS_CARD,
                  cursor: canSelect ? 'pointer' : 'default',
                  backgroundColor: '#444',
                  position: 'relative',
                  aspectRatio: '0.714',
                  overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: canSelect ? 1 : 0.4,
                }}
              >
                <img
                  src={imageUrl}
                  alt={card.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement!.innerHTML = `<span style="color:white;font-size:0.7rem;padding:2px;text-align:center;">${card.name}</span>`;
                  }}
                />

                {isSelected && (
                  <div style={{
                    position: 'absolute', top: '4px', right: '4px',
                    backgroundColor: COLORS.BTN_PRIMARY, color: 'white',
                    borderRadius: '50%', width: '24px', height: '24px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', zIndex: 10, border: '2px solid white'
                  }}>✓</div>
                )}

                {!canSelect && !isOrderMode && (
                  <div style={{
                    position: 'absolute', bottom: '4px', left: 0, right: 0,
                    textAlign: 'center', fontSize: '0.6rem', color: '#ccc',
                    background: 'rgba(0,0,0,0.5)', padding: '1px 0',
                  }}>選択不可</div>
                )}

                {isOrderMode && (
                  <>
                    <div style={{
                      position: 'absolute', top: '4px', left: '4px',
                      backgroundColor: COLORS.BTN_PRIMARY, color: 'white',
                      borderRadius: '50%', width: '22px', height: '22px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', fontWeight: 'bold', zIndex: 10, border: '2px solid white'
                    }}>{orderPos + 1}</div>
                    <div style={{
                      position: 'absolute', bottom: '2px', left: 0, right: 0,
                      display: 'flex', justifyContent: 'center', gap: '4px', zIndex: 10,
                    }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); moveOrder(card.uuid, -1); }}
                        disabled={idx === 0}
                        style={{ fontSize: '11px', padding: '0 6px', cursor: idx === 0 ? 'default' : 'pointer',
                                 opacity: idx === 0 ? 0.4 : 1, border: 'none', borderRadius: '3px' }}
                      >↑</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); moveOrder(card.uuid, 1); }}
                        disabled={idx === selected.length - 1}
                        style={{ fontSize: '11px', padding: '0 6px', cursor: idx === selected.length - 1 ? 'default' : 'pointer',
                                 opacity: idx === selected.length - 1 ? 0.4 : 1, border: 'none', borderRadius: '3px' }}
                      >↓</button>
                    </div>
                  </>
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
