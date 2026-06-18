import React from 'react';
import { LAYOUT_PARAMS } from '../../layout/layout.config';

/**
 * 統一ポップアップ基盤の土台（全画面 scrim ＋ パネル）。
 *
 * 各モーダルで個別実装していた overlay/背景/角丸/影/blur を一元化する。
 * 配色は `LAYOUT_PARAMS.MODAL` トークン（ダーク・グラスモーフィズム）を正本とする。
 */
interface ModalShellProps {
  /** center: 画面中央 / bottom: 下端（ボトムシート。カード詳細など）。既定 center。 */
  align?: 'center' | 'bottom';
  /** パネル最大幅。例 '800px' / 'min(680px,92vw)'。 */
  width?: string;
  /** 見出し（省略可）。指定時はタイトル行＋× を共通描画。 */
  title?: React.ReactNode;
  /** × ボタン／バックドロップクリックで閉じる時のハンドラ。 */
  onClose?: () => void;
  /** バックドロップ（暗幕）クリック時のハンドラ。未指定なら onClose を使用。null 明示で無効化。 */
  onBackdropClick?: (() => void) | null;
  /** 重なり順。既定 Z_INDEX.MODAL。 */
  zIndex?: number;
  /** scrim を透過し背後の盤面を見せる（任意効果の確認など）。既定 false。 */
  transparentScrim?: boolean;
  /** パネルの padding 上書き。 */
  padding?: string;
  children: React.ReactNode;
}

const { MODAL, Z_INDEX } = LAYOUT_PARAMS;

export const ModalShell: React.FC<ModalShellProps> = ({
  align = 'center', width = '480px', title, onClose, onBackdropClick,
  zIndex = Z_INDEX.MODAL, transparentScrim = false, padding = '24px', children,
}) => {
  const backdrop = onBackdropClick === null ? undefined : (onBackdropClick ?? onClose);

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex,
    background: transparentScrim ? 'transparent' : MODAL.SCRIM,
    backdropFilter: transparentScrim ? undefined : MODAL.BACKDROP_BLUR,
    WebkitBackdropFilter: transparentScrim ? undefined : MODAL.BACKDROP_BLUR,
    display: 'flex',
    justifyContent: 'center',
    alignItems: align === 'bottom' ? 'flex-end' : 'center',
    padding: align === 'bottom' ? 0 : '20px',
    boxSizing: 'border-box',
    pointerEvents: transparentScrim ? 'none' : undefined,
  };

  const panelStyle: React.CSSProperties = {
    pointerEvents: 'auto',
    width: align === 'bottom' ? '100%' : '90%',
    maxWidth: width,
    maxHeight: align === 'bottom' ? '88vh' : '85vh',
    boxSizing: 'border-box',
    display: 'flex', flexDirection: 'column',
    background: MODAL.PANEL_BG,
    border: MODAL.PANEL_BORDER,
    borderRadius: align === 'bottom'
      ? `${MODAL.PANEL_RADIUS}px ${MODAL.PANEL_RADIUS}px 0 0`
      : MODAL.PANEL_RADIUS,
    boxShadow: MODAL.PANEL_SHADOW,
    color: MODAL.TEXT_PRIMARY,
    padding,
  };

  return (
    <div style={overlayStyle} onClick={backdrop}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        {(title !== undefined || onClose) && (
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: title !== undefined ? 'space-between' : 'flex-end',
            marginBottom: '12px', flexShrink: 0,
          }}>
            {title !== undefined && (
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: MODAL.TEXT_PRIMARY }}>{title}</h3>
            )}
            {onClose && (
              <button
                onClick={onClose}
                aria-label="閉じる"
                style={{
                  border: 'none', background: 'none', color: MODAL.TEXT_MUTED,
                  fontSize: '1.5rem', lineHeight: 1, cursor: 'pointer', padding: '0 4px',
                }}
              >×</button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
};
