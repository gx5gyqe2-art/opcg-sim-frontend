import React from 'react';
import './GameUI.css';

// 必要な型を簡易定義（またはCardInstanceをインポート）
interface Props {
  cardName: string;
  location: 'hand' | 'field' | 'other';
  onSelect: (action: string) => void;
  onClose: () => void;
}

export const ActionMenu: React.FC<Props> = ({ cardName, location, onSelect, onClose }) => {
  return (
    <div className="ui-overlay" onClick={onClose}>
      <div className="action-menu" onClick={(e) => e.stopPropagation()}>
        <h3 className="menu-title">{cardName}</h3>
        <div className="menu-buttons">
          
          {location === 'hand' && (
            <button className="menu-btn primary" onClick={() => onSelect('PLAY_CARD')}>
              登場させる
            </button>
          )}

          {location === 'field' && (
            <>
              <button className="menu-btn danger" onClick={() => onSelect('ATTACK')}>
                攻撃する
              </button>
              <button className="menu-btn action" onClick={() => onSelect('ATTACH_DON')}>
                ドン!!付与 (+1)
              </button>
              <button className="menu-btn primary" onClick={() => onSelect('ACTIVATE')}>
                効果発動
              </button>
            </>
          )}

          <button className="menu-btn cancel" onClick={onClose}>
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
};
