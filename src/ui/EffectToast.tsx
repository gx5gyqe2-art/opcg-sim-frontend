import React from 'react';
import { TOAST_KEYFRAMES, TOAST_Z_INDEX, toastPillStyle } from './common/toastStyles';

/**
 * 効果適用の一時的な視覚フィードバック（トースト）。
 *
 * バックエンドの `action_events`（KO/ドロー/バウンス等）を受けて、画面上部中央に
 * 短時間フェードするバッジを表示する。Pixi キャンバスやゲーム状態には一切干渉しない
 * 純粋な追加レイヤー（pointerEvents: none）で、表示と自動消滅は親(RealGame)が管理する。
 *
 * スタイルは統一トースト基盤（common/toastStyles）を参照する。
 */
export interface EffectToastItem {
  id: number;
  text: string;
  emphasis: boolean;
}

export const EffectToast: React.FC<{ toasts: ReadonlyArray<EffectToastItem> }> = ({ toasts }) => {
  if (toasts.length === 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        top: '11%',
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        pointerEvents: 'none',
        zIndex: TOAST_Z_INDEX,
      }}
    >
      <style>{TOAST_KEYFRAMES}</style>
      {toasts.map((t) => (
        <div key={t.id} style={toastPillStyle(t.emphasis ? 'emphasis' : 'info', true)}>
          {t.text}
        </div>
      ))}
    </div>
  );
};
