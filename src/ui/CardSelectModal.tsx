import React, { useState, useEffect, useRef } from 'react';
import { LAYOUT_CONSTANTS, LAYOUT_PARAMS } from '../layout/layout.config';
import type { CardInstance } from '../game/types';
// ▼ 変更: imageAssetsから関数をインポート
import { getCardImageUrl } from '../utils/imageAssets';

interface CardSelectModalProps {
  candidates: CardInstance[];
  message: string;
  minSelect: number;
  maxSelect: number;
  onConfirm: (selectedUuids: string[], position?: 'TOP' | 'BOTTOM') => void;
  onCancel?: () => void;
  selectableUuids?: string[];
  // ARRANGE_DECK(課題2a): true でデッキの上/下を選ぶ確定ボタンを出す。
  allowPosition?: boolean;
}

export const CardSelectModal: React.FC<CardSelectModalProps> = ({
  candidates, message, minSelect, maxSelect, onConfirm, onCancel, selectableUuids, allowPosition
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

  // --- 並び替えモード: ドラッグ&ドロップで配置順を入れ替える ---
  // 旧来の小さな↑↓ボタンは操作性が悪かったため、Pointer Events による
  // ドラッグに置き換える（追加ライブラリなし・タッチ対応）。
  const [dragUuid, setDragUuid] = useState<string | null>(null);
  const itemRefs = useRef(new Map<string, HTMLDivElement>());
  const dragMovedRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const arrayMove = (arr: string[], from: number, to: number): string[] => {
    const next = [...arr];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  };

  // ポインタ座標直下のカード(ドラッグ中カードを除く)を矩形判定で探す。
  const findItemAt = (x: number, y: number, exclude: string): string | null => {
    for (const [uuid, node] of itemRefs.current) {
      if (uuid === exclude) continue;
      const r = node.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return uuid;
    }
    return null;
  };

  const handleDragPointerDown = (e: React.PointerEvent<HTMLDivElement>, uuid: string) => {
    if (!isOrderMode) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragMovedRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    setDragUuid(uuid);
  };

  const handleDragPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isOrderMode || dragUuid === null) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    // 6px 動くまではドラッグ開始とみなさない（誤操作・タップ判定の余地）。
    if (!dragMovedRef.current && Math.hypot(dx, dy) < 6) return;
    dragMovedRef.current = true;

    const overUuid = findItemAt(e.clientX, e.clientY, dragUuid);
    if (overUuid) {
      setSelected(prev => {
        const from = prev.indexOf(dragUuid);
        const to = prev.indexOf(overUuid);
        if (from < 0 || to < 0 || from === to) return prev;
        return arrayMove(prev, from, to);
      });
    }
  };

  const endDrag = () => setDragUuid(null);

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
              ? `配置順をドラッグで並び替えてください（${selected.length}枚を①から順に配置）`
              : `選択中: ${selected.length} / ${effMax}枚 (最小 ${minSelect}枚)`}
          </div>
        </div>

        <div style={gridStyle}>
          {/* 並び替えモードは selected（配置順）で描画し、それ以外は候補順で描画する */}
          {(isOrderMode
              ? selected.map(uid => candidates.find(c => c.uuid === uid)!).filter(Boolean)
              : candidates
          ).map((card) => {
            const isSelected = selected.includes(card.uuid);
            const canSelect = isSelectable(card.uuid);
            const imageUrl = getCardImageUrl(card.card_id);
            const orderPos = isOrderMode ? selected.indexOf(card.uuid) : -1;

            const isDragging = isOrderMode && dragUuid === card.uuid;
            return (
              <div
                key={card.uuid}
                ref={(node) => {
                  if (node) itemRefs.current.set(card.uuid, node);
                  else itemRefs.current.delete(card.uuid);
                }}
                onClick={() => handleToggle(card.uuid)}
                onPointerDown={isOrderMode ? (e) => handleDragPointerDown(e, card.uuid) : undefined}
                onPointerMove={isOrderMode ? handleDragPointerMove : undefined}
                onPointerUp={isOrderMode ? endDrag : undefined}
                onPointerCancel={isOrderMode ? endDrag : undefined}
                onLostPointerCapture={isOrderMode ? endDrag : undefined}
                style={{
                  border: isSelected ? `3px solid ${COLORS.BTN_PRIMARY}` : '1px solid #ccc',
                  borderRadius: SHAPE.CORNER_RADIUS_CARD,
                  cursor: isOrderMode ? (isDragging ? 'grabbing' : 'grab') : (canSelect ? 'pointer' : 'default'),
                  backgroundColor: '#444',
                  position: 'relative',
                  aspectRatio: '0.714',
                  overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: canSelect ? 1 : 0.4,
                  touchAction: isOrderMode ? 'none' : undefined,
                  transform: isDragging ? 'scale(1.08)' : undefined,
                  boxShadow: isDragging ? '0 8px 20px rgba(0,0,0,0.45)' : undefined,
                  zIndex: isDragging ? 100 : undefined,
                  transition: isDragging ? 'none' : 'transform 120ms ease',
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
                  <div style={{
                    position: 'absolute', top: '4px', left: '4px',
                    backgroundColor: COLORS.BTN_PRIMARY, color: 'white',
                    borderRadius: '50%', width: '24px', height: '24px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: 'bold', zIndex: 10, border: '2px solid white',
                    pointerEvents: 'none',
                  }}>{orderPos + 1}</div>
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
          {allowPosition ? (
            // ARRANGE_DECK: デッキの上/下を選んで確定する。
            <>
              <button
                onClick={() => isValid && onConfirm(selected, 'TOP')}
                disabled={!isValid}
                style={{
                  padding: '10px 20px', borderRadius: '4px', border: 'none',
                  backgroundColor: isValid ? COLORS.BTN_PRIMARY : COLORS.BTN_DISABLED,
                  color: 'white', cursor: isValid ? 'pointer' : 'not-allowed', fontWeight: 'bold'
                }}
              >
                デッキの上へ
              </button>
              <button
                onClick={() => isValid && onConfirm(selected, 'BOTTOM')}
                disabled={!isValid}
                style={{
                  padding: '10px 20px', borderRadius: '4px', border: 'none',
                  backgroundColor: isValid ? COLORS.BTN_PRIMARY : COLORS.BTN_DISABLED,
                  color: 'white', cursor: isValid ? 'pointer' : 'not-allowed', fontWeight: 'bold'
                }}
              >
                デッキの下へ
              </button>
            </>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
};
