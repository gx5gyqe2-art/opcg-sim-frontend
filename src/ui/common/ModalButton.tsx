import React from 'react';
import { LAYOUT_CONSTANTS, LAYOUT_PARAMS } from '../../layout/layout.config';

/**
 * 統一ポップアップ基盤のボタン。
 *
 * 各モーダル/ダイアログ/バナーで個別にベタ書きしていた padding/borderRadius/配色を
 * variant に一元化する。色は `COLORS.BTN_*`、角丸は `SHAPE.CORNER_RADIUS_BTN` を正本とする。
 */
export type ModalButtonVariant =
  | 'primary'
  | 'danger'
  | 'success'
  | 'warning'
  | 'secondary'
  | 'ghost';

interface ModalButtonProps {
  variant?: ModalButtonVariant;
  disabled?: boolean;
  fullWidth?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  /** 個別の微調整用（padding/fontSize 等を上書き）。配色は variant に従うのが原則。 */
  style?: React.CSSProperties;
}

const { COLORS } = LAYOUT_CONSTANTS;
const { SHAPE } = LAYOUT_PARAMS;

// variant → {背景, 文字色}。warning(黄)のみ可読性のため濃色文字。
const VARIANT_COLORS: Record<ModalButtonVariant, { bg: string; fg: string }> = {
  primary: { bg: COLORS.BTN_PRIMARY, fg: '#fff' },
  danger: { bg: COLORS.BTN_DANGER, fg: '#fff' },
  success: { bg: COLORS.BTN_SUCCESS, fg: '#fff' },
  warning: { bg: COLORS.BTN_WARNING, fg: '#222' },
  secondary: { bg: COLORS.BTN_SECONDARY, fg: '#fff' },
  ghost: { bg: 'rgba(255,255,255,0.06)', fg: '#f2f4f8' },
};

export const ModalButton: React.FC<ModalButtonProps> = ({
  variant = 'primary', disabled = false, fullWidth = false, onClick, children, style,
}) => {
  const c = VARIANT_COLORS[variant];
  const baseStyle: React.CSSProperties = {
    padding: '11px 22px',
    borderRadius: SHAPE.CORNER_RADIUS_BTN,
    border: variant === 'ghost' ? '1px solid rgba(255,255,255,0.25)' : 'none',
    background: disabled ? COLORS.BTN_DISABLED : c.bg,
    color: disabled ? 'rgba(255,255,255,0.85)' : c.fg,
    fontWeight: 700,
    fontSize: '0.95rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    width: fullWidth ? '100%' : undefined,
    transition: 'filter 120ms ease, transform 80ms ease',
    ...style,
  };
  return (
    <button onClick={onClick} disabled={disabled} style={baseStyle}>
      {children}
    </button>
  );
};
