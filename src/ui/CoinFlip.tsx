import React, { useEffect, useRef, useState } from 'react';

/**
 * 先行/後攻決定のコイントス演出（CPU・対戦モード用）。
 *
 * サーバが決定した先行プレイヤー(firstPlayerId)を受け取り、コインを回転させて
 * 視点プレイヤー(viewerId)から見た「先攻 / 後攻」の面に着地させる。演出後に
 * 「ゲーム開始」で閉じる（一定時間で自動的にボタンが有効化）。ゲーム状態には
 * 干渉しない純粋なオーバーレイで、表示・破棄は呼び出し側(RealGame)が管理する。
 */
export const CoinFlip: React.FC<{
  firstPlayerId: 'p1' | 'p2';
  viewerId: 'p1' | 'p2';
  onClose: () => void;
}> = ({ firstPlayerId, viewerId, onClose }) => {
  const viewerIsFirst = firstPlayerId === viewerId;
  // 着地面: 先攻=表(0deg) / 後攻=裏(180deg)。複数回転を加えて回す。
  const TURNS = 5;
  const finalDeg = TURNS * 360 + (viewerIsFirst ? 0 : 180);

  const [spun, setSpun] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const coinRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // マウント直後に回転開始（transition を効かせるため次フレームで適用）。
    const raf = requestAnimationFrame(() => setSpun(true));
    const t1 = setTimeout(() => setRevealed(true), 1700);
    return () => { cancelAnimationFrame(raf); clearTimeout(t1); };
  }, []);

  const faceBase: React.CSSProperties = {
    position: 'absolute', inset: 0, borderRadius: '50%',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
    fontWeight: 900, color: '#3a2c00',
    boxShadow: 'inset 0 0 14px rgba(0,0,0,0.35)',
    border: '4px solid #b8860b',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 6000,
      background: 'radial-gradient(circle at center, rgba(20,24,33,0.82) 0%, rgba(0,0,0,0.92) 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '26px',
      pointerEvents: 'auto',
    }}>
      <div style={{ color: '#f1c40f', fontWeight: 800, fontSize: '15px', letterSpacing: '2px', opacity: 0.9 }}>
        先行・後攻を決定
      </div>

      {/* コイン（3D） */}
      <div style={{ perspective: '900px', width: '140px', height: '140px' }}>
        <div
          ref={coinRef}
          style={{
            position: 'relative', width: '100%', height: '100%',
            transformStyle: 'preserve-3d',
            transform: `rotateY(${spun ? finalDeg : 0}deg)`,
            transition: spun ? 'transform 1.7s cubic-bezier(0.22, 0.8, 0.2, 1)' : 'none',
            filter: 'drop-shadow(0 10px 18px rgba(0,0,0,0.55))',
          }}
        >
          {/* 表: 先攻 */}
          <div style={{ ...faceBase, background: 'radial-gradient(circle at 35% 30%, #ffe07a, #f1c40f 55%, #d4a309)' }}>
            <span style={{ fontSize: '34px', lineHeight: 1 }}>先</span>
            <span style={{ fontSize: '11px', letterSpacing: '1px' }}>FIRST</span>
          </div>
          {/* 裏: 後攻 */}
          <div style={{ ...faceBase, transform: 'rotateY(180deg)', background: 'radial-gradient(circle at 35% 30%, #cfe3ff, #9ec9f0 55%, #6fa8d6)', color: '#13314f', borderColor: '#4a78a3' }}>
            <span style={{ fontSize: '34px', lineHeight: 1 }}>後</span>
            <span style={{ fontSize: '11px', letterSpacing: '1px' }}>SECOND</span>
          </div>
        </div>
      </div>

      {/* 結果表示 */}
      <div style={{
        textAlign: 'center', minHeight: '64px',
        opacity: revealed ? 1 : 0, transform: revealed ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.35s ease, transform 0.35s ease',
      }}>
        <div style={{
          fontSize: '30px', fontWeight: 900,
          color: viewerIsFirst ? '#2ecc71' : '#5da9e9',
          textShadow: '0 2px 12px rgba(0,0,0,0.6)',
        }}>
          {viewerIsFirst ? 'あなたの先攻' : 'あなたは後攻'}
        </div>
        <div style={{ color: '#9aa4b2', fontSize: '12px', marginTop: '4px' }}>
          先行: {firstPlayerId.toUpperCase()}
        </div>
      </div>

      <button
        onClick={onClose}
        disabled={!revealed}
        style={{
          padding: '11px 30px', borderRadius: '999px', border: 'none', fontWeight: 800, fontSize: '15px',
          color: 'white', background: revealed ? '#e67e22' : '#555',
          cursor: revealed ? 'pointer' : 'default',
          opacity: revealed ? 1 : 0.6, transition: 'opacity 0.3s ease, background 0.3s ease',
          boxShadow: revealed ? '0 6px 18px rgba(230,126,34,0.45)' : 'none',
        }}
      >
        ゲーム開始
      </button>
    </div>
  );
};
