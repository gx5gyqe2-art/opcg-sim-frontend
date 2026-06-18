import React from 'react';
import { LAYOUT_CONSTANTS, LAYOUT_PARAMS } from '../../layout/layout.config';
import type { BattleDecisionMeta } from './battleDecision';

// ブロック（SELECT_BLOCKER）とカウンター（SELECT_COUNTER）は、どちらも「防御側の選択」
// として同じ盤面選択 UI に乗るため見分けが付きにくい。アイコン・色・タイトル・効果説明を
// 明確に分けて表示し、何を求められているかを一目で判別できるようにする。

const { COLORS } = LAYOUT_CONSTANTS;
const { MODAL } = LAYOUT_PARAMS;

// バナー見出し（アイコン＋色付きタイトル＋効果説明）。誰の防御かも併記する。
export const BattleDecisionHeader: React.FC<{
  meta: BattleDecisionMeta;
  defenderLabel?: string | null;
}> = ({ meta, defenderLabel }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
      <span style={{ fontSize: '18px', lineHeight: 1 }}>{meta.icon}</span>
      <span style={{ fontSize: '16px', fontWeight: 800, color: meta.color, letterSpacing: '0.08em' }}>
        {meta.title}
      </span>
    </div>
    {defenderLabel && (
      <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#fff', opacity: 0.85 }}>
        🛡 {defenderLabel} の防御
      </div>
    )}
    <div style={{ fontSize: '10.5px', fontWeight: 500, color: MODAL.TEXT_MUTED, maxWidth: '300px', lineHeight: 1.4 }}>
      {meta.desc}
    </div>
  </div>
);

export interface BattlePanelInfo {
  attackerName: string;
  attackerPower: number;
  targetName: string;
  targetBasePower: number;
  counterBuff: number;
}

// バトルの数値情報パネル。ブロックとカウンターで内容を変える。
//  - カウンター: 対象パワー＋累計バフ、攻撃を耐えるかの判定（残り必要値）。
//  - ブロック  : ブロッカーを選ぶと攻撃を肩代わりすることを明示。
export const BattleDecisionPanel: React.FC<{
  meta: BattleDecisionMeta;
  info: BattlePanelInfo;
}> = ({ meta, info }) => {
  const targetEff = info.targetBasePower + info.counterBuff;
  const survives = info.attackerPower < targetEff;
  const needed = info.attackerPower - targetEff + 1;

  return (
    <div
      style={{
        margin: '1px 0 2px',
        padding: '7px 10px',
        borderRadius: '8px',
        background: 'rgba(0,0,0,0.3)',
        border: `1px solid ${meta.color}55`,
        fontSize: '12px',
        lineHeight: 1.6,
      }}
    >
      <div style={{ color: COLORS.OVERLAY_BORDER_HIGHLIGHT, marginBottom: '4px' }}>
        ⚔ {info.attackerName}（{info.attackerPower}） → {info.targetName}
      </div>

      {meta.kind === 'SELECT_BLOCKER' ? (
        <>
          <div>
            現在の対象パワー：<span style={{ fontWeight: 'bold' }}>{targetEff}</span>
            <span style={{ color: survives ? '#2ecc71' : '#e74c3c' }}>
              {survives ? '（このままでも耐える）' : '（このままだと耐えられない）'}
            </span>
          </div>
          <div style={{ color: meta.color, fontWeight: 'bold' }}>
            → ブロッカーを選ぶと、そのキャラが代わりに攻撃を受けます
          </div>
        </>
      ) : (
        <>
          <div>
            対象パワー：{info.targetBasePower}
            {info.counterBuff > 0 && (
              <span style={{ color: '#ffff00', fontWeight: 'bold' }}> +{info.counterBuff}</span>
            )}
            {' '}= <span style={{ fontWeight: 'bold' }}>{targetEff}</span>
          </div>
          {info.counterBuff > 0 && (
            <div style={{ color: meta.color }}>カウンター累計：+{info.counterBuff}</div>
          )}
          <div style={{ fontWeight: 'bold', color: survives ? '#2ecc71' : '#e74c3c' }}>
            {survives ? '✔ このパワーで耐えられます' : `✖ あと ${needed} 必要`}
          </div>
        </>
      )}
    </div>
  );
};
