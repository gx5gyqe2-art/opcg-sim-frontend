import React, { useState } from 'react';
import CONST from '../../shared_constants.json';
import { LAYOUT_CONSTANTS, LAYOUT_PARAMS } from '../layout/layout.config';
import { getAvailableActions, type CardActionKey } from '../game/cardActions';
import type { CardInstance } from '../game/types';

interface CardActionMenuProps {
  card: CardInstance;
  location: string;
  activeDonCount: number;
  anchor: { x: number; y: number }; // タップ位置（CSSピクセル）
  onAction: (type: string, payload: Record<string, unknown>) => Promise<void>;
  onShowDetail: () => void;
  onClose: () => void;
  // ドン!!ゾーンから対象を選んで開いた場合、最初から枚数選択(ステッパー)を表示する。
  initialDonMode?: boolean;
}

const PANEL_WIDTH = 170;

// カードタップ時にカード近傍へ表示するコンパクトな操作メニュー。
// 詳細シートを毎回開かずに、攻撃/ドン付与/効果起動/登場を即実行できる。
export const CardActionMenu: React.FC<CardActionMenuProps> = ({
  card, location, activeDonCount, anchor, onAction, onShowDetail, onClose, initialDonMode = false,
}) => {
  const { COLORS } = LAYOUT_CONSTANTS;
  const { Z_INDEX, SHAPE, MODAL } = LAYOUT_PARAMS;
  const ACTIONS = CONST.c_to_s_interface.GAME_ACTIONS.TYPES;

  // ドン付与は枚数選択のためパネル内をステッパー表示に切り替える。
  // ドン!!ゾーンから対象を選んで開いた場合は最初からステッパーを表示する。
  const [donMode, setDonMode] = useState(initialDonMode);
  const [donAmount, setDonAmount] = useState(1);

  const actions = getAvailableActions(card, location, true, activeDonCount);

  const handleActionTap = async (key: CardActionKey) => {
    if (key === 'don') {
      setDonAmount(1);
      setDonMode(true);
      return;
    }
    if (key === 'play') {
      await onAction(ACTIONS.PLAY, { uuid: card.uuid });
    } else if (key === 'attack') {
      await onAction(ACTIONS.ATTACK, { uuid: card.uuid });
    } else if (key === 'activate') {
      await onAction(ACTIONS.ACTIVATE_MAIN, { uuid: card.uuid });
    }
    onClose();
  };

  const handleAttachDon = async () => {
    for (let i = 0; i < donAmount; i++) {
      await onAction(ACTIONS.ATTACH_DON, { uuid: card.uuid });
    }
    onClose();
  };

  // 画面端で見切れないように配置をクランプ。タップ位置が上半分なら下に、
  // 下半分なら上に開く（カード自体を隠さないため）。
  const left = Math.min(
    Math.max(anchor.x - PANEL_WIDTH / 2, 8),
    window.innerWidth - PANEL_WIDTH - 8,
  );
  const openBelow = anchor.y < window.innerHeight / 2;
  const verticalStyle: React.CSSProperties = openBelow
    ? { top: Math.min(anchor.y + 16, window.innerHeight - 8) }
    : { bottom: Math.min(window.innerHeight - anchor.y + 16, window.innerHeight - 8) };

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    left,
    ...verticalStyle,
    width: PANEL_WIDTH,
    background: MODAL.PANEL_BG,
    border: MODAL.PANEL_BORDER,
    borderRadius: '12px',
    boxShadow: MODAL.PANEL_SHADOW,
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    zIndex: Z_INDEX.MINI_MENU,
    boxSizing: 'border-box',
  };

  const btnStyle = (bg: string, color: string = '#fff'): React.CSSProperties => ({
    padding: '11px 10px',
    borderRadius: SHAPE.CORNER_RADIUS_BTN,
    border: 'none',
    background: bg,
    color,
    fontWeight: 'bold',
    fontSize: '0.95rem',
    cursor: 'pointer',
    width: '100%',
  });

  const actionBg: Record<CardActionKey, string> = {
    play: COLORS.BTN_SUCCESS,
    attack: COLORS.BTN_DANGER,
    don: COLORS.BTN_WARNING,
    activate: COLORS.BTN_PRIMARY,
  };
  const actionFg: Record<CardActionKey, string> = {
    play: '#fff', attack: '#fff', don: '#222', activate: '#fff',
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: Z_INDEX.MINI_MENU }}
      onPointerDown={onClose}
    >
      <div style={panelStyle} onPointerDown={(e) => e.stopPropagation()}>
        {donMode ? (
          <>
            <div style={{ color: '#fff', fontSize: '0.8rem', textAlign: 'center', fontWeight: 'bold' }}>
              ドン!!付与
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
              <button
                onClick={() => setDonAmount(Math.max(1, donAmount - 1))}
                style={{ ...btnStyle(COLORS.BTN_SECONDARY), width: '40px', padding: '8px 0' }}
              >−</button>
              <div style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 'bold', minWidth: '24px', textAlign: 'center' }}>
                {donAmount}
              </div>
              <button
                onClick={() => setDonAmount(Math.min(activeDonCount, donAmount + 1))}
                disabled={donAmount >= activeDonCount}
                style={{ ...btnStyle(donAmount >= activeDonCount ? COLORS.BTN_DISABLED : COLORS.BTN_SECONDARY), width: '40px', padding: '8px 0' }}
              >＋</button>
            </div>
            <div style={{ color: '#aaa', fontSize: '0.7rem', textAlign: 'center' }}>可能: {activeDonCount}枚</div>
            <button onClick={handleAttachDon} style={btnStyle(COLORS.BTN_WARNING, '#222')}>付与する</button>
            <button onClick={() => setDonMode(false)} style={btnStyle(COLORS.BTN_SECONDARY)}>戻る</button>
          </>
        ) : (
          <>
            {actions.map(a => (
              <button key={a.key} onClick={() => handleActionTap(a.key)} style={btnStyle(actionBg[a.key], actionFg[a.key])}>
                {a.label}
              </button>
            ))}
            <button onClick={onShowDetail} style={btnStyle('#5a6573')}>詳細</button>
          </>
        )}
      </div>
    </div>
  );
};
