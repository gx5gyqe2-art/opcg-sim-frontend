import React from 'react';
import './GameUI.css';

interface Props {
  card: any; // 厳密な型定義は CardInstance 推奨
  onClose: () => void;
}

export const CardDetailSheet: React.FC<Props> = ({ card, onClose }) => {
  if (!card) return null;

  return (
    <div className="bottom-sheet-container" onClick={onClose}>
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <div className="sheet-title">{card.name}</div>
          <button className="sheet-close" onClick={onClose}>×</button>
        </div>

        <div className="sheet-stats">
          {card.power !== undefined && <span className="stat-badge">Power: {card.power}</span>}
          {card.cost !== undefined && <span className="stat-badge">Cost: {card.cost}</span>}
          {card.attribute && <span className="stat-badge">{card.attribute}</span>}
        </div>

        <div className="sheet-text">
          {card.text || "効果なし"}
        </div>
      </div>
    </div>
  );
};
