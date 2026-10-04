import React, { useEffect, useState } from 'react';
import CONST from '../../shared_constants.json';
import { LAYOUT_CONSTANTS, LAYOUT_PARAMS } from '../layout/layout.config';
// ▼ 変更: imageAssetsから関数をインポート
import { getCardImageUrl } from '../utils/imageAssets';
import type { CardInstance, BoardCard, LeaderCard } from '../game/types';
import { getAvailableActions, type CardActionKey } from '../game/cardActions';
import { ModalShell } from './common/ModalShell';
import { ModalButton, type ModalButtonVariant } from './common/ModalButton';
import { getStatusViews, STATUS_TONE_COLOR } from '../game/cardStatus';

interface CardDetailSheetProps {
  card: CardInstance & { cards?: CardInstance[] };
  location: string;
  isMyTurn: boolean;
  activeDonCount?: number;
  /** 現在のターン数（状態の期間表示「このターン終了まで／次のターン終了まで」に使う） */
  turnCount?: number;
  onAction: (type: string, payload: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}

export const CardDetailSheet: React.FC<CardDetailSheetProps> = ({ card, location, isMyTurn, activeDonCount = 0, turnCount, onAction, onClose }) => {
  const { COLORS } = LAYOUT_CONSTANTS;
  const { UI_DETAILS, SHAPE, MODAL } = LAYOUT_PARAMS;

  // ドン付与モード用ステート
  const [donMode, setDonMode] = useState(false);
  const [donAmount, setDonAmount] = useState(1);

  useEffect(() => {
  }, [card.name, card.uuid, location]);

  const ACTIONS = CONST.c_to_s_interface.GAME_ACTIONS.TYPES;
  const statusViews = getStatusViews(card, turnCount);
  // 効果による増減（例: 「(+2000)」）。付与ドン!!は含まない。
  const modLabel = (mod?: number) => (mod ? (
    <span style={{ color: mod > 0 ? '#4cd964' : '#ff6b6b', marginLeft: '4px' }}>({mod > 0 ? '+' : ''}{mod})</span>
  ) : null);

  const handleExecute = async (type: string, extra: Record<string, unknown> = {}) => {
    await onAction(type, { uuid: card.uuid, extra });
  };

  // ドン付与一括実行ロジック
  const handleAttachDonBatch = async () => {
    for (let i = 0; i < donAmount; i++) {
        await onAction(ACTIONS.ATTACH_DON, { uuid: card.uuid });
    }
    setDonMode(false);
    onClose();
  };

  const renderButtons = () => {
    if (donMode) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', background: 'rgba(255,255,255,0.06)', padding: '12px', borderRadius: '10px' }}>
          <div style={{ fontWeight: 'bold', color: MODAL.TEXT_PRIMARY }}>ドン!!を付与する枚数</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <ModalButton variant="secondary" onClick={() => setDonAmount(Math.max(1, donAmount - 1))} style={{ width: '48px' }}>−</ModalButton>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: MODAL.TEXT_PRIMARY }}>{donAmount}</div>
            <ModalButton variant="secondary" disabled={donAmount >= activeDonCount} onClick={() => setDonAmount(Math.min(activeDonCount, donAmount + 1))} style={{ width: '48px' }}>＋</ModalButton>
          </div>
          <div style={{ fontSize: '12px', color: MODAL.TEXT_MUTED }}>可能: {activeDonCount}枚</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', width: '100%' }}>
            <ModalButton variant="secondary" fullWidth onClick={() => setDonMode(false)}>キャンセル</ModalButton>
            <ModalButton variant="warning" fullWidth onClick={handleAttachDonBatch}>決定</ModalButton>
          </div>
        </div>
      );
    }

    // ボタンの表示可否はカード種別・ロケーションに基づき getAvailableActions に一元化。
    // ステージカードに攻撃/ドン付与が出るバグはこのヘルパー側で防いでいる。
    const actionVariants: Record<CardActionKey, ModalButtonVariant> = {
      play: 'success', attack: 'danger', don: 'warning', activate: 'primary',
    };
    const actionHandlers: Record<CardActionKey, () => void> = {
      play: () => handleExecute(ACTIONS.PLAY),
      attack: () => handleExecute(ACTIONS.ATTACK),
      don: () => { setDonAmount(1); setDonMode(true); },
      activate: () => handleExecute(ACTIONS.ACTIVATE_MAIN),
    };

    return getAvailableActions(card, location, isMyTurn, activeDonCount).map(a => (
      <ModalButton key={a.key} variant={actionVariants[a.key]} fullWidth onClick={actionHandlers[a.key]}>
        {a.label}
      </ModalButton>
    ));
  };

  const badgeStyle = (bg: string): React.CSSProperties => ({
    backgroundColor: bg,
    color: 'white',
    padding: '2px 8px',
    borderRadius: SHAPE.CORNER_RADIUS_SHEET_BADGE,
    fontSize: '0.7rem',
    fontWeight: 'bold'
  });

  // ▼ 変更: getCardImageUrlを使用
  const mainImageUrl = ('card_id' in card) ? getCardImageUrl((card as { card_id: string }).card_id) : null;

  if (card.cards && card.cards.length > 0) {
    return (
      <ModalShell align="bottom" width={UI_DETAILS.MODAL_MAX_WIDTH} title={`${card.name} (${card.cards.length})`} onClose={onClose}>
          <div style={{ maxHeight: '60vh', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '8px' }}>
            {card.cards.map((c, idx) => {
              // ▼ 変更: getCardImageUrlを使用
              const imgUrl = getCardImageUrl(c.card_id);
              return (
                <div key={idx} style={{ 
                  aspectRatio: '0.714',
                  borderRadius: '4px', 
                  overflow: 'hidden',
                  border: '1px solid #ccc',
                  backgroundColor: '#444',
                  position: 'relative'
                }}>
                  <img 
                    src={imgUrl} 
                    alt={c.name}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement!.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:white;font-size:0.7rem;text-align:center;padding:2px;">${c.name}</div>`;
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: '10px' }}>
            <ModalButton variant="secondary" fullWidth onClick={onClose}>閉じる</ModalButton>
          </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell align="bottom" width={UI_DETAILS.MODAL_MAX_WIDTH} onClose={onClose}>
        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
          
          {mainImageUrl && (
            <div style={{ marginBottom: '15px' }}>
              <img 
                src={mainImageUrl} 
                alt={card.name} 
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '300px', 
                  borderRadius: '8px',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
                }} 
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', textAlign: 'left' }}>
            <h2 style={{ margin: 0, fontSize: '1.4rem', color: MODAL.TEXT_PRIMARY }}>{card.name || 'Unknown Card'}</h2>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px', justifyContent: 'flex-start' }}>
            <span style={badgeStyle(COLORS.BADGE_LOC)}>{location.toUpperCase()}</span>
            {'attribute' in card && card.attribute && <span style={badgeStyle(COLORS.BADGE_ATTR)}>{card.attribute}</span>}
            {'traits' in card && card.traits && card.traits.map((trait: string, idx: number) => (
              <span key={idx} style={badgeStyle(COLORS.BADGE_TRAIT)}>{trait}</span>
            ))}
          </div>
          {statusViews.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px', textAlign: 'left' }}>
              {statusViews.map(v => (
                <div key={v.code} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                  <span style={{ ...badgeStyle(STATUS_TONE_COLOR[v.tone].css), flexShrink: 0 }}>{v.short}</span>
                  <span style={{ color: MODAL.TEXT_PRIMARY }}>{v.label}</span>
                  {v.duration && <span style={{ color: MODAL.TEXT_MUTED, marginLeft: 'auto', whiteSpace: 'nowrap' }}>{v.duration}</span>}
                </div>
              ))}
            </div>
          )}
          <p style={{ fontSize: '0.9rem', color: MODAL.TEXT_PRIMARY, lineHeight: '1.6', whiteSpace: 'pre-wrap', textAlign: 'left' }}>
            {'text' in card ? card.text : ''}
          </p>
          {'trigger_text' in card && card.trigger_text && (
            <p style={{ fontSize: '0.9rem', color: MODAL.TEXT_PRIMARY, lineHeight: '1.6', whiteSpace: 'pre-wrap', textAlign: 'left', borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: '8px', marginTop: '4px' }}>
              <span style={{ fontWeight: 'bold', color: MODAL.ACCENT }}>【トリガー】</span> {card.trigger_text}
            </p>
          )}
          <div style={{ marginTop: '15px', fontWeight: 'bold', color: MODAL.TEXT_PRIMARY, display: 'flex', gap: '20px', borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: '10px', justifyContent: 'center' }}>
            {'power' in card && <span>POWER: {(card as LeaderCard | BoardCard).power}{modLabel(card.power_mod)}</span>}
            {'cost' in card && <span>COST: {(card as BoardCard).cost}{modLabel(card.cost_mod)}</span>}
            {'counter' in card && (card as BoardCard).counter !== undefined && (card as BoardCard).counter! > 0 && (
              <span>COUNTER: +{(card as BoardCard).counter}</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {renderButtons()}
          {!donMode && (
            <ModalButton variant="secondary" fullWidth onClick={onClose}>閉じる</ModalButton>
          )}
        </div>
    </ModalShell>
  );
};
