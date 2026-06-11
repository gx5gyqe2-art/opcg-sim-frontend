import React from 'react';

/**
 * 効果適用の一時的な視覚フィードバック（トースト）。
 *
 * バックエンドの `action_events`（KO/ドロー/バウンス等）を受けて、画面上部中央に
 * 短時間フェードするバッジを表示する。Pixi キャンバスやゲーム状態には一切干渉しない
 * 純粋な追加レイヤー（pointerEvents: none）で、表示と自動消滅は親(RealGame)が管理する。
 *
 * 注: カードが実際に飛ぶ等の座標アニメーションは視覚QAが必要な将来課題（doc §7-G）。
 * 本コンポーネントは最小限の「効果が起きたこと」のフィードバックを担う。
 */
export interface EffectToastItem {
  id: number;
  text: string;
  emphasis: boolean;
}

const KEYFRAMES =
  '@keyframes opcgToastRise{0%{opacity:0;transform:translateY(10px) scale(0.94);}' +
  '12%{opacity:1;transform:translateY(0) scale(1);}78%{opacity:1;transform:translateY(0) scale(1);}' +
  '100%{opacity:0;transform:translateY(-12px) scale(1);}}';

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
        zIndex: 160,
      }}
    >
      <style>{KEYFRAMES}</style>
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            padding: '6px 16px',
            background: t.emphasis ? 'rgba(155,24,24,0.92)' : 'rgba(22,24,34,0.9)',
            color: '#fff',
            borderRadius: '16px',
            fontSize: '13px',
            fontWeight: 'bold',
            fontFamily: 'sans-serif',
            letterSpacing: '0.5px',
            boxShadow: '0 3px 14px rgba(0,0,0,0.55)',
            animation: 'opcgToastRise 1.8s ease-out forwards',
          }}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
};
