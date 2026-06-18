import type React from 'react';
import { LAYOUT_PARAMS } from '../../layout/layout.config';

/**
 * 統一トースト基盤のスタイル定義。
 *
 * EffectToast（効果フィードバック）と RealGame のエラートーストで共通の
 * 配色・角丸・rise アニメ・z-index を提供する。
 */
export const TOAST_KEYFRAMES =
  '@keyframes opcgToastRise{0%{opacity:0;transform:translateY(10px) scale(0.94);}' +
  '12%{opacity:1;transform:translateY(0) scale(1);}78%{opacity:1;transform:translateY(0) scale(1);}' +
  '100%{opacity:0;transform:translateY(-12px) scale(1);}}';

export type ToastVariant = 'info' | 'emphasis' | 'error';

const VARIANT_BG: Record<ToastVariant, string> = {
  info: 'rgba(22,24,34,0.92)',
  emphasis: 'rgba(155,24,24,0.92)',
  error: 'rgba(192,40,40,0.95)',
};

export const TOAST_Z_INDEX = LAYOUT_PARAMS.Z_INDEX.TOAST;

/** トースト1個分の共通スタイル。animate=true で rise アニメ（自動消滅トースト用）。 */
export function toastPillStyle(variant: ToastVariant, animate: boolean): React.CSSProperties {
  return {
    padding: '6px 16px',
    background: VARIANT_BG[variant],
    color: '#fff',
    borderRadius: 16,
    fontSize: '13px',
    fontWeight: 'bold',
    fontFamily: 'sans-serif',
    letterSpacing: '0.5px',
    border: variant === 'error' ? '1px solid rgba(255,255,255,0.85)' : undefined,
    boxShadow: '0 3px 14px rgba(0,0,0,0.55)',
    animation: animate ? 'opcgToastRise 1.8s ease-out forwards' : undefined,
  };
}
