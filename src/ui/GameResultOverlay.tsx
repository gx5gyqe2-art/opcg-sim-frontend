import React from 'react';
import { LAYOUT_PARAMS } from '../layout/layout.config';
import { ModalButton } from './common/ModalButton';
import { getCardImageUrl } from '../utils/imageAssets';
import type { GameState } from '../game/types';
import './GameUI.css'; // fadeIn / popIn keyframes

/**
 * 勝敗確定時のフルスクリーン結果画面。
 *
 * - 視点固定（CPU/オンライン）: 「勝利 / 敗北」を大きく表示。
 * - ソロ（ホットシート）: 「P1 の勝利」のように勝者席を表示。
 * 「トップに戻る」で即座にトップ画面へ、「盤面を見る」で閉じて最終盤面を確認できる。
 */
interface GameResultOverlayProps {
  gameState: GameState;
  winner: string;
  /** 視点の席。null はソロ（両席操作）＝勝者席をそのまま表示。 */
  viewerId: 'p1' | 'p2' | null;
  onBackToTop: () => void;
  onViewBoard: () => void;
}

const { MODAL, Z_INDEX } = LAYOUT_PARAMS;

const WIN_COLOR = '#ffd54d';
const LOSE_COLOR = '#8fa3c0';

export const GameResultOverlay: React.FC<GameResultOverlayProps> = ({
  gameState, winner, viewerId, onBackToTop, onViewBoard,
}) => {
  const isWin = viewerId === null || winner === viewerId;
  const accent = isWin ? WIN_COLOR : LOSE_COLOR;
  const headline = viewerId === null
    ? `${winner.toUpperCase()} の勝利`
    : (isWin ? '勝利' : '敗北');
  const subline = viewerId === null ? 'GAME SET' : (isWin ? 'VICTORY' : 'DEFEAT');

  // 左＝視点側（ソロは p1）、右＝相手側。
  const left: 'p1' | 'p2' = viewerId ?? 'p1';
  const right: 'p1' | 'p2' = left === 'p1' ? 'p2' : 'p1';

  const renderSide = (pid: 'p1' | 'p2') => {
    const player = gameState.players?.[pid];
    const leader = player?.leader;
    const won = pid === winner;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', opacity: won ? 1 : 0.55 }}>
        <div style={{
          width: 'min(26vw, 120px, 18vh)', aspectRatio: '63 / 88', borderRadius: '8px', overflow: 'hidden',
          background: 'rgba(255,255,255,0.06)',
          border: won ? `2px solid ${WIN_COLOR}` : '2px solid rgba(255,255,255,0.15)',
          boxShadow: won ? '0 0 24px rgba(255,213,77,0.45)' : 'none',
          filter: won ? undefined : 'grayscale(0.6)',
        }}>
          {leader?.card_id && (
            <img
              src={getCardImageUrl(leader.card_id)}
              alt={leader.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
        </div>
        <div style={{ color: won ? WIN_COLOR : MODAL.TEXT_MUTED, fontSize: '12px', fontWeight: 700 }}>
          {pid.toUpperCase()}{won ? ' WIN' : ''}
        </div>
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-label="対戦結果"
      style={{
        position: 'fixed', inset: 0, zIndex: Z_INDEX.SPOTLIGHT,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 'min(22px, 3vh)', padding: '16px', boxSizing: 'border-box', overflowY: 'auto',
        background: isWin
          ? 'radial-gradient(ellipse at center, rgba(70,52,8,0.92) 0%, rgba(8,10,14,0.96) 70%)'
          : 'radial-gradient(ellipse at center, rgba(22,30,46,0.92) 0%, rgba(8,10,14,0.96) 70%)',
        backdropFilter: MODAL.BACKDROP_BLUR,
        WebkitBackdropFilter: MODAL.BACKDROP_BLUR,
        // 最後の演出（KO・ライフ減少など）を少し見せてから出す。
        animation: 'fadeIn 0.5s ease 0.6s both',
      }}
    >
      <div style={{ textAlign: 'center', animation: 'popIn 0.5s ease 0.8s both' }}>
        <div style={{ color: accent, opacity: 0.8, fontSize: '14px', letterSpacing: '0.4em', fontWeight: 700 }}>
          {subline}
        </div>
        <div style={{
          color: accent, fontSize: 'clamp(32px, min(12vw, 13vh), 84px)', fontWeight: 900, lineHeight: 1.1,
          textShadow: isWin ? '0 0 28px rgba(255,213,77,0.55)' : '0 0 18px rgba(0,0,0,0.6)',
        }}>
          {isWin && viewerId !== null ? '🏆 ' : ''}{headline}
        </div>
        <div style={{ color: MODAL.TEXT_MUTED, fontSize: '13px', marginTop: '6px' }}>
          {gameState.turn_info?.turn_count ?? '-'} ターンで決着
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', animation: 'fadeIn 0.5s ease 1s both' }}>
        {renderSide(left)}
        <div style={{ color: MODAL.TEXT_MUTED, fontSize: '16px', fontWeight: 900 }}>VS</div>
        {renderSide(right)}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px', animation: 'fadeIn 0.5s ease 1.1s both' }}>
        <ModalButton variant="primary" onClick={onBackToTop} style={{ padding: '13px 30px', fontSize: '16px' }}>
          トップに戻る
        </ModalButton>
        <ModalButton variant="ghost" onClick={onViewBoard} style={{ padding: '13px 30px', fontSize: '16px' }}>
          盤面を見る
        </ModalButton>
      </div>
    </div>
  );
};
