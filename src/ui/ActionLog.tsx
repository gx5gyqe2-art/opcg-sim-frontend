import React from 'react';
import type { ActionEvent } from '../api/types';

const EVENT_COLORS: Record<string, string> = {
  PLAY: '#2ecc71',
  ATTACK: '#e74c3c',
  TURN_END: '#7f8c8d',
  ATTACH_DON: '#9b59b6',
  ACTIVATE_MAIN: '#3498db',
  BLOCK: '#e67e22',
  COUNTER: '#f39c12',
  PASS: '#95a5a6',
  EFFECT: '#2980b9',
  MULLIGAN: '#e67e22',
  KEEP_HAND: '#2ecc71',
};

const EFFECT_LABELS: Record<string, string> = {
  DRAW: 'ドロー',
  KO: 'KO',
  BOUNCE: '手札に戻す',
  DISCARD: 'トラッシュ',
  TRASH: 'トラッシュ',
  BUFF: 'パワー変更',
  FREEZE: '凍結',
  NEGATE_EFFECT: '効果無効',
  HEAL: 'ライフ回復',
  LIFE_RECOVER: 'ライフ回復',
  RAMP_DON: 'ドン追加',
  REST_DON: 'ドンレスト',
  ACTIVE_DON: 'ドンアクティブ',
  RETURN_DON: 'ドン返却',
  PLAY_CARD: 'カード登場',
  TRASH_FROM_DECK: 'ミル',
  SHUFFLE: 'シャッフル',
  LOOK: 'デッキ確認',
  MOVE_CARD: 'カード移動',
  REVEAL: '公開',
  ACTIVE: 'アクティブ',
  REST: 'レスト',
  ATTACK_DISABLE: 'アタック不能',
  GRANT_KEYWORD: 'キーワード付与',
  RULE_PROCESSING: 'ルール処理',
};

// MOVE_CARD の行き先別ラベル（ev.dest・backend が additive に付与）。無印の「カード移動」だと
// 効果の意味が読めず、OP16-119 等のライフ追加が「発動していない」ように見えていた。
const MOVE_DEST_LABELS: Record<string, string> = {
  LIFE: 'ライフに追加',
  HAND: '手札に加える',
  DECK: 'デッキに戻す',
  TRASH: 'トラッシュへ',
  FIELD: '場に出す',
};

function formatEvent(ev: ActionEvent): string {
  if (ev.message) return ev.message;
  if (ev.type === 'EFFECT' && ev.action) {
    let label = EFFECT_LABELS[ev.action] || ev.action;
    if (ev.action === 'MOVE_CARD' && ev.dest) {
      label = MOVE_DEST_LABELS[ev.dest] ?? `カード移動(${ev.dest})`;
    }
    const targetStr = ev.targets?.length ? ` → ${ev.targets.join(', ')}` : '';
    const valueStr = ev.value != null && ev.value !== 0 ? ` (${ev.value > 0 ? '+' : ''}${ev.value})` : '';
    const cardStr = ev.card_name ? `「${ev.card_name}」` : '';
    return `${cardStr}${label}${targetStr}${valueStr}`;
  }
  return ev.card_name ? `「${ev.card_name}」` : ev.type;
}

interface ActionLogProps {
  events: ActionEvent[];
  anchorY: number;
  onClose: () => void;
  /** 「採取」: ログ（イベント履歴＋CPU思考トレース）をクリップボードにコピーする。 */
  onCapture?: () => void;
}

export const ActionLog: React.FC<ActionLogProps> = ({ events, anchorY, onClose, onCapture }) => {
  return (
    <>
      {/* 背景クリックで閉じる透明オーバーレイ */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, zIndex: 148 }}
      />
      {/* ログポップアップ本体 */}
      <div style={{
        position: 'absolute',
        left: '10px',
        bottom: `${anchorY + 10}px`,
        width: '220px',
        maxHeight: '280px',
        background: 'rgba(0,0,0,0.88)',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '11px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
        zIndex: 149,
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '5px 6px 5px 10px',
          borderBottom: '1px solid #333',
          flexShrink: 0,
        }}>
          <span style={{ color: '#bbb', fontWeight: 'bold', fontSize: '11px' }}>
            ログ ({events.length})
          </span>
          {onCapture && (
            <button
              onClick={onCapture}
              title="ログ（イベント履歴＋CPU思考トレース）をクリップボードにコピー"
              style={{
                background: 'rgba(41,128,185,0.9)',
                color: '#fff',
                border: '1px solid #2980b9',
                borderRadius: '4px',
                padding: '2px 9px',
                fontSize: '10px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontFamily: 'inherit',
                flexShrink: 0,
              }}
            >
              採取
            </button>
          )}
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {events.length === 0 ? (
            <div style={{ color: '#666', padding: '8px 10px' }}>アクションなし</div>
          ) : (
            [...events].reverse().map((ev, idx) => {
              const color = EVENT_COLORS[ev.type] || '#aaa';
              return (
                <div key={idx} style={{
                  padding: '3px 8px 3px 11px',
                  borderLeft: `3px solid ${color}`,
                  marginBottom: '1px',
                  color: '#ddd',
                  display: 'flex',
                  gap: '5px',
                  alignItems: 'flex-start',
                  opacity: ev.success === false ? 0.5 : 1,
                }}>
                  <span style={{ color, minWidth: '24px', fontSize: '10px', paddingTop: '1px', flexShrink: 0 }}>
                    {ev.player}
                  </span>
                  <span style={{ flex: 1, wordBreak: 'break-all', lineHeight: '1.4' }}>
                    {formatEvent(ev)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};
