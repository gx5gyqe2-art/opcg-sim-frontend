import React from 'react';
import { LAYOUT_PARAMS } from '../../layout/layout.config';
import { ModalButton, type ModalButtonVariant } from './ModalButton';

/**
 * 統一ポップアップ基盤の細バナー（盤面に被さらない通知帯）。
 *
 * 対象選択（攻撃/ドン）・盤面カード選択・Generic Pending を共通スタイルで表示する。
 * 配色は `LAYOUT_PARAMS.MODAL` の BANNER_* トークンを正本とする。
 */
export interface PromptBannerAction {
  label: React.ReactNode;
  variant?: ModalButtonVariant;
  onClick: () => void;
  disabled?: boolean;
}

interface PromptBannerProps {
  /** top: 画面最上部中央 / center: 盤面中央（layoutCoords.y を topPx で渡す）。既定 top。 */
  position?: 'top' | 'center';
  /** center 配置時の Y 座標(px)。未指定なら 50%。 */
  topPx?: number;
  message: React.ReactNode;
  /** カウンター/ヒント行（省略可）。 */
  subText?: React.ReactNode;
  /** 先頭に脈動ドットを表示（盤面選択の導線強調）。 */
  accentDot?: boolean;
  /** 背後のカードをタップ可能にする（バナー本体は透過、ボタンのみ有効）。 */
  pointerThrough?: boolean;
  /** バトル情報など、メッセージとボタンの間に挟む任意ブロック。 */
  children?: React.ReactNode;
  actions?: PromptBannerAction[];
  zIndex?: number;
  /** アクセント色（指定時は枠＋外周グローをこの色にし、バナー種別を視覚的に区別する）。 */
  accentColor?: string;
}

const { MODAL, Z_INDEX } = LAYOUT_PARAMS;

const pillStyle: React.CSSProperties = { padding: '7px 18px', borderRadius: 999, fontSize: '13px' };

export const PromptBanner: React.FC<PromptBannerProps> = ({
  position = 'top', topPx, message, subText, accentDot = false,
  pointerThrough = false, children, actions, zIndex = Z_INDEX.BANNER,
  accentColor,
}) => {
  const posStyle: React.CSSProperties = position === 'top'
    ? { top: 'max(12px, env(safe-area-inset-top, 0px))', left: '50%', transform: 'translateX(-50%)' }
    : { top: topPx !== undefined ? `${topPx}px` : '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    ...posStyle,
    zIndex,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px',
    padding: '9px 16px 11px', borderRadius: 14,
    background: MODAL.BANNER_BG,
    backdropFilter: MODAL.BANNER_BLUR, WebkitBackdropFilter: MODAL.BANNER_BLUR,
    border: accentColor ? `1.5px solid ${accentColor}` : MODAL.BANNER_BORDER,
    boxShadow: accentColor
      ? `0 0 0 1px ${accentColor}55, 0 0 18px ${accentColor}40, 0 8px 24px rgba(0,0,0,0.45)`
      : '0 8px 24px rgba(0,0,0,0.45)',
    color: '#fff', textAlign: 'center', maxWidth: 'min(92vw, 360px)',
    pointerEvents: pointerThrough ? 'none' : 'auto',
  };

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '13px', lineHeight: 1.35 }}>
        {accentDot && (
          <span style={{
            flex: '0 0 auto', width: '7px', height: '7px', borderRadius: '50%',
            background: MODAL.ACCENT, boxShadow: `0 0 8px ${MODAL.ACCENT}`,
          }} />
        )}
        <span>{message}</span>
      </div>

      {subText !== undefined && (
        <div style={{ fontSize: '11px', color: MODAL.TEXT_MUTED }}>{subText}</div>
      )}

      {children}

      {actions && actions.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '1px', pointerEvents: 'auto' }}>
          {actions.map((a, i) => (
            <ModalButton
              key={i}
              variant={a.variant ?? 'primary'}
              disabled={a.disabled}
              onClick={a.onClick}
              style={pillStyle}
            >
              {a.label}
            </ModalButton>
          ))}
        </div>
      )}
    </div>
  );
};
