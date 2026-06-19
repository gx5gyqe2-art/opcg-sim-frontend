import React from 'react';
import { LAYOUT_PARAMS } from '../../layout/layout.config';
import { ModalButton, type ModalButtonVariant } from '../common/ModalButton';
import type { BattleDecisionMeta } from './battleDecision';

// ブロック/カウンター選択の「スリムバー」。盤面（特に相手側）を隠さないよう、上部の
// 数値パネルをやめ、画面下端（手札の上）に最小限の情報だけ並べる。攻撃の向きは盤面の
// 矢印で示すため、ここは「種別・要点数値・操作ボタン・👁長押し透過」だけに絞る。

const { MODAL, Z_INDEX } = LAYOUT_PARAMS;

export interface BattleBarAction {
  label: React.ReactNode;
  variant?: ModalButtonVariant;
  onClick: () => void;
  disabled?: boolean;
}

interface BattleDecisionBarProps {
  meta: BattleDecisionMeta;
  attackerPower: number;
  targetBasePower: number;
  counterBuff: number;
  defenderLabel?: string | null;
  actions: BattleBarAction[];
  /** 配置Y(px)。指定時はその高さに中央寄せ（ドン!!・トラッシュ行に収める）。未指定は下端寄せ。 */
  topPx?: number;
  /** 長押し中だけ透過（背後の盤面確認）。 */
  peek: boolean;
  onPeekDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPeekUp: () => void;
}

export const BattleDecisionBar: React.FC<BattleDecisionBarProps> = ({
  meta, attackerPower, targetBasePower, counterBuff, defenderLabel, actions,
  topPx, peek, onPeekDown, onPeekUp,
}) => {
  const targetEff = targetBasePower + counterBuff;
  const survives = attackerPower < targetEff;
  const needed = attackerPower - targetEff + 1;

  // topPx 指定時はその高さに中央寄せ（手札に被らないようドン!!・トラッシュ行へ）。
  const posStyle: React.CSSProperties = topPx !== undefined
    ? { top: `${topPx}px`, transform: 'translate(-50%, -50%)' }
    : { bottom: 'calc(env(safe-area-inset-bottom, 0px) + 14vh)', transform: 'translateX(-50%)' };

  return (
    <div
      style={{
        position: 'absolute', left: '50%', ...posStyle,
        zIndex: Z_INDEX.BANNER,
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center',
        gap: '7px 10px', padding: '7px 12px', borderRadius: 12,
        background: MODAL.BANNER_BG,
        backdropFilter: MODAL.BANNER_BLUR, WebkitBackdropFilter: MODAL.BANNER_BLUR,
        border: `1.5px solid ${meta.color}`,
        boxShadow: `0 0 0 1px ${meta.color}55, 0 0 16px ${meta.color}40, 0 8px 22px rgba(0,0,0,0.45)`,
        color: '#fff', maxWidth: 'min(94vw, 480px)',
        opacity: peek ? 0.1 : 1, transition: 'opacity 120ms ease',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, color: meta.color, fontSize: '14px', whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: '16px', lineHeight: 1 }}>{meta.icon}</span>{meta.title}
        {defenderLabel && <span style={{ fontSize: '10px', color: '#fff', opacity: 0.8 }}>🛡{defenderLabel}</span>}
      </span>

      <span style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
        ⚔ {attackerPower} <span style={{ opacity: 0.6 }}>→</span> {targetEff}
        {counterBuff > 0 && <span style={{ color: '#ffd54d' }}> (+{counterBuff})</span>}
        {'　'}
        <span style={{ fontWeight: 'bold', color: survives ? '#2ecc71' : '#e74c3c' }}>
          {survives ? '✔ 耐える' : `✖ あと${needed}`}
        </span>
      </span>

      <div style={{ display: 'flex', gap: '7px', alignItems: 'center' }}>
        {actions.map((a, i) => (
          <ModalButton
            key={i} variant={a.variant ?? 'primary'} disabled={a.disabled} onClick={a.onClick}
            style={{ padding: '6px 14px', borderRadius: 999, fontSize: '12.5px' }}
          >
            {a.label}
          </ModalButton>
        ))}
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
