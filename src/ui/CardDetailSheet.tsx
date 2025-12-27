import React from 'react';
import CONST from '../../shared_constants.json';

interface CardDetailSheetProps {
  card: any;
  location: string;
  onAction: (type: string, payload: any) => Promise<void>;
  onClose: () => void;
}

export const CardDetailSheet: React.FC<CardDetailSheetProps> = ({ card, location, onAction, onClose }) => {
  const ACTIONS = CONST.c_to_s_interface.GAME_ACTIONS.TYPES;

  // アクション実行ハンドラ
  const handleExecute = async (type: string, extra: any = {}) => {
    await onAction(type, {
      card_id: card.uuid,
      ...extra
    });
    onClose(); // アクション送信後にシートを閉じる
  };

  // 場所に応じたボタンの出し分けロジック (過去ソースの仕様を反映)
  const renderButtons = () => {
    const buttons = [];

    if (location === 'hand') {
      buttons.push(
        <button key="play" onClick={() => handleExecute(ACTIONS.PLAY)} className="action-btn play">
          登場させる
        </button>
      );
    }

    if (location === 'field' || location === 'leader') {
      // アタックボタン（レスト中でない場合）
      if (!card.is_rest) {
        buttons.push(
          <button key="attack" onClick={() => handleExecute(ACTIONS.ATTACK)} className="action-btn attack">
            アタック
          </button>
        );
      }
      
      // ドン!!付与ボタン（自分のターン中などの条件はバックエンドで判定）
      buttons.push(
        <button key="attach" onClick={() => handleExecute(ACTIONS.ATTACH_DON, { extra: { count: 1 } })} className="action-btn attach">
          ドン!!を1枚付与
        </button>
      );

      // 起動メイン
      if (card.text && card.text.includes('『起動メイン』')) {
        buttons.push(
          <button key="activate" onClick={() => handleExecute(ACTIONS.ACTIVATE_MAIN)} className="action-btn main">
            効果発動
          </button>
        );
      }
    }

    return buttons;
  };

  return (
    <div className="card-detail-overlay" onClick={onClose}>
      <div className="card-detail-content" onClick={(e) => e.stopPropagation()}>
        <div className="card-info">
          <h2>{card.name}</h2>
          <p className="card-text">{card.text}</p>
          <div className="card-stats">
            {card.power !== undefined && <span>POWER: {card.power}</span>}
            {card.cost !== undefined && <span>COST: {card.cost}</span>}
          </div>
        </div>

        <div className="action-menu">
          {renderButtons()}
          <button onClick={onClose} className="action-btn close">閉じる</button>
        </div>
      </div>

      <style jsx>{`
        .card-detail-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.7);
          display: flex; justify-content: center; align-items: center;
          z-index: 1000;
        }
        .card-detail-content {
          background: white; padding: 20px; border-radius: 12px;
          width: 80%; max-width: 400px;
        }
        .action-menu {
          display: flex; flex-direction: column; gap: 10px; margin-top: 20px;
        }
        .action-btn {
          padding: 12px; border: none; border-radius: 6px;
          font-weight: bold; cursor: pointer;
        }
        .play { background: #2ecc71; color: white; }
        .attack { background: #e74c3c; color: white; }
        .attach { background: #f1c40f; color: black; }
        .main { background: #3498db; color: white; }
        .close { background: #95a5a6; color: white; }
      `}</style>
    </div>
  );
};
