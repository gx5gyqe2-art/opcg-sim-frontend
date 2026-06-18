import React, { useEffect, useState } from 'react';
import { LAYOUT_PARAMS } from '../layout/layout.config';

/**
 * 先行/後攻決定のリビール演出（CPU・対戦モード用／ミニマル・モダン版）。
 *
 * サーバが決定した先行プレイヤー(firstPlayerId)を受け取り、VS 構図の2セル上を
 * 光のセレクターが往復し、先攻側に「ロックイン」して決定を見せる。コインの比喩は
 * 用いず、クリーンなタイポと控えめなモーションでアプリらしく仕上げる。演出後に
 * 「ゲーム開始」で閉じる（リビール完了でボタンが有効化）。ゲーム状態には干渉しない
 * 純粋なオーバーレイで、表示・破棄は呼び出し側(RealGame)が管理する。
 */
const ACCENT = '#34e0a6';        // 先攻アクセント（ミント）
const MUTED = '#8a99ad';         // 後攻・補助テキスト
const REVEAL_MS = 1850;          // リビールまでの時間

const TRACK_W = 340;             // トラック幅(px)
const SEL_LEFT = 6;              // セレクター左端位置(px)
const SEL_RIGHT = TRACK_W / 2 + 4;

export const CoinFlip: React.FC<{
  firstPlayerId: 'p1' | 'p2';
  viewerId: 'p1' | 'p2';
  onClose: () => void;
}> = ({ firstPlayerId, viewerId, onClose }) => {
  const viewerIsFirst = firstPlayerId === viewerId;
  const opponentId = viewerId === 'p1' ? 'p2' : 'p1';
  // 視点プレイヤーは常に左セル。先攻側のセル(0=左 / 1=右)を求める。
  const winnerIndex = viewerIsFirst ? 0 : 1;

  const [mounted, setMounted] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    const t = setTimeout(() => setRevealed(true), REVEAL_MS);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, []);

  const selectorLeft = winnerIndex === 0 ? SEL_LEFT : SEL_RIGHT;

  const cell = (side: 0 | 1) => {
    const isViewer = side === 0;
    const tag = (isViewer ? viewerId : opponentId).toUpperCase();
    const isWinner = side === winnerIndex;
    const dimmed = revealed && !isWinner;
    return (
      <div style={{
        flex: 1, position: 'relative', zIndex: 2,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '7px', height: '100%',
        opacity: dimmed ? 0.45 : 1,
        transition: 'opacity 0.5s ease',
      }}>
        <span style={{ fontSize: '11px', letterSpacing: '3px', color: MUTED, fontWeight: 700 }}>
          {tag}
        </span>
        <span style={{ fontSize: '21px', fontWeight: 800, color: '#eef3f9', letterSpacing: '1px' }}>
          {isViewer ? 'あなた' : 'あいて'}
        </span>
        {/* 結果チップ（リビール時にフェードアップ） */}
        <span style={{
          marginTop: '2px',
          fontSize: '12px', fontWeight: 800, letterSpacing: '2px',
          padding: '3px 12px', borderRadius: '999px',
          color: isWinner ? '#06281f' : MUTED,
          background: isWinner ? ACCENT : 'transparent',
          border: isWinner ? 'none' : `1px solid rgba(138,153,173,0.35)`,
          boxShadow: isWinner ? `0 4px 16px rgba(52,224,166,0.45)` : 'none',
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'translateY(0)' : 'translateY(6px)',
          transition: 'opacity 0.4s ease 0.05s, transform 0.4s ease 0.05s',
        }}>
          {isWinner ? '先攻' : '後攻'}
        </span>
      </div>
    );
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: LAYOUT_PARAMS.Z_INDEX.SPOTLIGHT,
      background: 'radial-gradient(circle at 50% 38%, rgba(17,22,31,0.9) 0%, rgba(5,7,11,0.96) 100%)',
      backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '30px',
      pointerEvents: 'auto',
      opacity: mounted ? 1 : 0, transition: 'opacity 0.4s ease',
    }}>
      {/* keyframes（セレクター往復・スイープ光） */}
      <style>{`
        @keyframes cf-oscillate {
          0%   { left: ${SEL_LEFT}px; }
          50%  { left: ${SEL_RIGHT}px; }
          100% { left: ${SEL_LEFT}px; }
        }
        @keyframes cf-sweep {
          0%   { transform: translateX(-120%); opacity: 0; }
          50%  { opacity: 0.7; }
          100% { transform: translateX(120%); opacity: 0; }
        }
      `}</style>

      {/* 見出し（eyebrow） */}
      <div style={{
        color: MUTED, fontSize: '12px', fontWeight: 700, letterSpacing: '6px',
        textTransform: 'uppercase',
        opacity: mounted ? 0.9 : 0, transform: mounted ? 'translateY(0)' : 'translateY(-6px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
      }}>
        先攻・後攻
      </div>

      {/* VS トラック */}
      <div style={{
        position: 'relative', width: `${TRACK_W}px`, height: '128px',
        borderRadius: '18px', overflow: 'hidden',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
        border: '1px solid rgba(255,255,255,0.10)',
        boxShadow: '0 18px 50px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'stretch',
      }}>
        {/* スイープ光（リビール前のみ） */}
        {!revealed && (
          <div style={{
            position: 'absolute', top: 0, bottom: 0, width: '45%', zIndex: 3,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)',
            animation: 'cf-sweep 1.5s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
        )}

        {/* 移動セレクター */}
        <div style={{
          position: 'absolute', top: '6px', bottom: '6px', zIndex: 1,
          width: `${TRACK_W / 2 - 10}px`,
          borderRadius: '13px',
          background: revealed
            ? 'linear-gradient(180deg, rgba(52,224,166,0.22), rgba(52,224,166,0.10))'
            : 'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))',
          border: `1px solid ${revealed ? 'rgba(52,224,166,0.6)' : 'rgba(255,255,255,0.18)'}`,
          boxShadow: revealed ? `0 0 0 1px rgba(52,224,166,0.25), 0 8px 24px rgba(52,224,166,0.35)` : 'none',
          left: revealed ? `${selectorLeft}px` : `${SEL_LEFT}px`,
          animation: revealed ? 'none' : 'cf-oscillate 0.62s cubic-bezier(0.45,0,0.55,1) infinite',
          transition: revealed
            ? 'left 0.5s cubic-bezier(0.22,0.8,0.2,1), background 0.4s ease, box-shadow 0.4s ease, border-color 0.4s ease'
            : 'none',
        }} />

        {cell(0)}
        {/* 中央 VS 区切り */}
        <div style={{
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', zIndex: 2,
          fontSize: '13px', fontWeight: 900, letterSpacing: '1px', color: MUTED,
          width: '30px', height: '30px', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(8,11,16,0.9)', border: '1px solid rgba(255,255,255,0.12)',
        }}>
          VS
        </div>
        {cell(1)}
      </div>

      {/* 結果見出し */}
      <div style={{
        minHeight: '30px',
        opacity: revealed ? 1 : 0, transform: revealed ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.4s ease 0.1s, transform 0.4s ease 0.1s',
      }}>
        <span style={{
          fontSize: '24px', fontWeight: 900, letterSpacing: '1px',
          color: viewerIsFirst ? ACCENT : '#9fb4cc',
          textShadow: '0 2px 14px rgba(0,0,0,0.6)',
        }}>
          {viewerIsFirst ? 'あなたの先攻' : 'あなたは後攻'}
        </span>
      </div>

      {/* 開始ボタン（ゴースト→アクティブ） */}
      <button
        onClick={onClose}
        disabled={!revealed}
        style={{
          padding: '11px 34px', borderRadius: '999px', fontWeight: 800, fontSize: '14px',
          fontFamily: 'inherit',  // ネイティブ button は font を継承しないため、全体の :root フォントへ揃える
          letterSpacing: '1px',
          color: revealed ? '#06281f' : MUTED,
          background: revealed ? ACCENT : 'transparent',
          border: `1.5px solid ${revealed ? ACCENT : 'rgba(138,153,173,0.4)'}`,
          cursor: revealed ? 'pointer' : 'default',
          boxShadow: revealed ? '0 8px 22px rgba(52,224,166,0.4)' : 'none',
          transition: 'all 0.35s ease',
        }}
      >
        ゲーム開始
      </button>
    </div>
  );
};
