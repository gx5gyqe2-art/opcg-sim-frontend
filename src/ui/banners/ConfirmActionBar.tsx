import React from 'react';
import { LAYOUT_PARAMS } from '../../layout/layout.config';
import { ModalButton } from '../common/ModalButton';

// 任意効果/トリガー（CONFIRM_OPTIONAL / CONFIRM_TRIGGER）の確認を、盤面を覆わない
// スリムバーで出す。発生源カードの小サムネ＋効果名＋発動可否ボタンに絞り、ドン!!・
// トラッシュ行の高さに配置。👁長押し中は透過して背後の盤面を確認できる。

const { MODAL, Z_INDEX } = LAYOUT_PARAMS;

interface ConfirmActionBarProps {
  title: string;
  accentColor: string;
  sourceImg?: string | null;
  sourceName?: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  disabled?: boolean;
  /** 配置Y(px)。指定時はその高さに中央寄せ。未指定は下端寄せ。 */
  topPx?: number;
  peek: boolean;
  onPeekDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPeekUp: () => void;
}

export const ConfirmActionBar: React.FC<ConfirmActionBarProps> = ({
  title, accentColor, sourceImg, sourceName, message, confirmLabel, cancelLabel,
  onConfirm, onCancel, disabled, topPx, peek, onPeekDown, onPeekUp,
}) => {
  const posStyle: React.CSSProperties = topPx !== undefined
    ? { top: `${topPx}px`, transform: 'translate(-50%, -50%)' }
    : { bottom: 'calc(env(safe-area-inset-bottom, 0px) + 14vh)', transform: 'translateX(-50%)' };

  return (
    <div
      style={{
        position: 'absolute', left: '50%', ...posStyle,
        zIndex: Z_INDEX.BANNER,
        // 画像以外の配置は中央寄せのまま。画像が入った分だけ横へ伸ばせるよう max-width を広げ、
        // 折り返しによる縦伸び（手札への被り）を避ける。
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center',
        gap: '8px 10px', padding: '7px 12px', borderRadius: 12,
        background: MODAL.BANNER_BG,
        backdropFilter: MODAL.BANNER_BLUR, WebkitBackdropFilter: MODAL.BANNER_BLUR,
        border: `1.5px solid ${accentColor}`,
        boxShadow: `0 0 0 1px ${accentColor}55, 0 0 16px ${accentColor}40, 0 8px 22px rgba(0,0,0,0.45)`,
        color: '#fff', maxWidth: 'min(98vw, 720px)',
        opacity: peek ? 0.1 : 1, transition: 'opacity 120ms ease',
      }}
    >
      {sourceImg && (
        <img
          src={sourceImg}
          alt={sourceName ?? ''}
          style={{ width: '34px', borderRadius: '4px', flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.5)' }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, maxWidth: '230px' }}>
        <span style={{ fontWeight: 800, color: accentColor, fontSize: '13px', whiteSpace: 'nowrap' }}>{title}</span>
        <span style={{ fontSize: '11px', color: MODAL.TEXT_MUTED, lineHeight: 1.3 }}>{message}</span>
      </span>

      <div style={{ display: 'flex', gap: '7px', alignItems: 'center' }}>
        <ModalButton variant="success" disabled={disabled} onClick={onConfirm} style={{ padding: '6px 13px', borderRadius: 999, fontSize: '12.5px' }}>
          {confirmLabel}
        </ModalButton>
        <ModalButton variant="secondary" disabled={disabled} onClick={onCancel} style={{ padding: '6px 13px', borderRadius: 999, fontSize: '12.5px' }}>
          {cancelLabel}
        </ModalButton>
        <button
          onPointerDown={onPeekDown}
          onPointerUp={onPeekUp}
          onPointerCancel={onPeekUp}
          onLostPointerCapture={onPeekUp}
          title="長押し中だけ透過して盤面を確認"
          style={{
            background: 'transparent', color: MODAL.TEXT_MUTED, border: `1px solid ${MODAL.TEXT_MUTED}`,
            borderRadius: 6, padding: '6px 10px', fontSize: '13px', cursor: 'pointer',
            touchAction: 'none', userSelect: 'none', lineHeight: 1,
          }}
        >👁</button>
      </div>
    </div>
  );
};
