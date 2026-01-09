import React, { useState } from 'react';
import type { EffectReport, EffectTrigger, GameZone, ActionType } from '../game/effectReporting';

interface Props {
  cardName?: string;
  onSubmit: (report: EffectReport) => void;
  onCancel: () => void;
}

export const EffectReportForm: React.FC<Props> = ({ cardName = '', onSubmit, onCancel }) => {
  const [inputCardName, setInputCardName] = useState(cardName);
  const [trigger, setTrigger] = useState<EffectTrigger>('OnPlay');
  const [condition, setCondition] = useState('');
  const [sourceZone, setSourceZone] = useState<GameZone>('Field');
  const [targetCount, setTargetCount] = useState(1);
  const [targetFilter, setTargetFilter] = useState('');
  const [note, setNote] = useState('');
  
  const [actions, setActions] = useState<{type: ActionType, detail: string}[]>([
    { type: 'Other', detail: '' }
  ]);

  const addAction = () => {
    setActions([...actions, { type: 'Other', detail: '' }]);
  };

  const removeAction = (index: number) => {
    const newActions = actions.filter((_, i) => i !== index);
    setActions(newActions);
  };

  const updateAction = (index: number, field: 'type' | 'detail', value: string) => {
    const newActions = [...actions];
    // @ts-ignore
    newActions[index][field] = value;
    setActions(newActions);
  };

  const handleSubmit = () => {
    const report: EffectReport = {
      cardName: inputCardName,
      trigger,
      condition,
      sourceZone,
      targetSelector: {
        count: targetCount,
        filter: targetFilter
      },
      actions,
      note
    };
    onSubmit(report);
  };

  const getPlaceholderForAction = (type: ActionType) => {
    switch (type) {
      case 'BuffPower': return '例: +2000';
      case 'SelectOption': return '例: 1枚引く | KO';
      case 'AddDon': return '例: 2';
      default: return '詳細';
    }
  };

  // 共通スタイル定義
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px', // タップしやすいよう拡大
    background: '#34495e',
    color: 'white',
    border: '1px solid #7f8c8d',
    borderRadius: '4px',
    fontSize: '16px', // iOSでのズーム防止
    boxSizing: 'border-box',
    marginBottom: '5px'
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.85em',
    color: '#bdc3c7',
    marginBottom: '4px',
    fontWeight: 'bold'
  };

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: '#2c3e50',
      color: '#ecf0f1',
      padding: '15px', // モバイル向けに少し縮小
      borderRadius: '8px',
      boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
      zIndex: 10000,
      width: '95%', // モバイル向けに幅を確保
      maxWidth: '500px', // PCでは広がりすぎないように
      maxHeight: '90vh',
      overflowY: 'auto',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      fontSize: '14px',
      boxSizing: 'border-box'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '15px',
        borderBottom: '1px solid #7f8c8d', 
        paddingBottom: '10px' 
      }}>
        <h3 style={{ margin: 0, fontSize: '1.2em' }}>🎴 効果定義レポート</h3>
        <button 
          onClick={onCancel}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#bdc3c7',
            fontSize: '1.5em',
            padding: '0 10px',
            cursor: 'pointer'
          }}
        >
          ×
        </button>
      </div>
      
      {/* カード名 */}
      <div style={{ marginBottom: '15px' }}>
        <label style={labelStyle}>カード名</label>
        <input 
          type="text" 
          value={inputCardName}
          onChange={e => setInputCardName(e.target.value)}
          placeholder="カード名を入力"
          style={inputStyle}
        />
      </div>

      {/* 1. タイミング */}
      <div style={{ marginBottom: '15px' }}>
        <label style={labelStyle}>いつ (Trigger)</label>
        <select 
          value={trigger} 
          onChange={e => setTrigger(e.target.value as EffectTrigger)}
          style={{...inputStyle, appearance: 'none'}} // appearance: noneでOS標準スタイルを抑制
        >
          <option value="OnPlay">登場時 (OnPlay)</option>
          <option value="WhenAttacking">アタック時 (WhenAttacking)</option>
          <option value="ActivateMain">起動メイン (ActivateMain)</option>
          <option value="OnBlock">ブロック時 (OnBlock)</option>
          <option value="OnKO">KO時 (OnKO)</option>
          <option value="TurnEnd">ターン終了時 (TurnEnd)</option>
          <option value="Trigger">トリガー (Trigger)</option>
          <option value="Other">その他</option>
        </select>
      </div>

      {/* 2. 条件 */}
      <div style={{ marginBottom: '15px' }}>
        <label style={labelStyle}>どの場合 (Condition)</label>
        <input 
          type="text" 
          placeholder="例: リーダーが特徴《麦わらの一味》を持つ場合" 
          value={condition}
          onChange={e => setCondition(e.target.value)}
          style={inputStyle}
        />
      </div>

      <hr style={{ borderColor: '#7f8c8d', opacity: 0.3, margin: '20px 0' }} />

      {/* 3. 対象選択 */}
      <div style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
        <div style={{ flex: 2 }}>
          <label style={labelStyle}>どこから</label>
          <select 
            value={sourceZone} 
            onChange={e => setSourceZone(e.target.value as GameZone)}
            style={inputStyle}
          >
            <option value="Field">盤面</option>
            <option value="Hand">手札</option>
            <option value="Trash">トラッシュ</option>
            <option value="Life">ライフ</option>
            <option value="Deck">デッキ</option>
            <option value="CostArea">コスト</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>枚数</label>
          <input 
            type="number" 
            value={targetCount} 
            onChange={e => setTargetCount(Number(e.target.value))}
            style={{...inputStyle, textAlign: 'center'}}
          />
        </div>
      </div>
      <div style={{ marginBottom: '15px' }}>
        <label style={labelStyle}>何を (Filter)</label>
        <input 
          type="text" 
          placeholder="例: コスト3以下のキャラ" 
          value={targetFilter} 
          onChange={e => setTargetFilter(e.target.value)}
          style={inputStyle}
        />
      </div>

      <hr style={{ borderColor: '#7f8c8d', opacity: 0.3, margin: '20px 0' }} />

      {/* 4. アクション（複数） */}
      <div style={{ marginBottom: '20px' }}>
        <label style={labelStyle}>効果・行動 (Actions)</label>
        {actions.map((act, idx) => (
          <div key={idx} style={{ 
            marginBottom: '10px', 
            background: 'rgba(0,0,0,0.2)', 
            padding: '10px', 
            borderRadius: '4px' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span style={{color: '#95a5a6', fontSize: '0.8em'}}>Action {idx+1}</span>
              {actions.length > 1 && (
                <button 
                  onClick={() => removeAction(idx)}
                  style={{ 
                    background: '#c0392b', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '3px',
                    padding: '2px 8px',
                    fontSize: '12px'
                  }}
                >
                  削除
                </button>
              )}
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <select 
                value={act.type} 
                onChange={e => updateAction(idx, 'type', e.target.value as ActionType)}
                style={inputStyle}
              >
                <option value="Other">その他</option>
                <option value="Rest">レストにする</option>
                <option value="Active">アクティブにする</option>
                <option value="KO">KOする</option>
                <option value="ReturnToHand">手札に戻す</option>
                <option value="BuffPower">パワー増減</option>
                <option value="AddDon">ドン追加(アクティブ)</option>
                <option value="RestDon">ドン追加(レスト)</option>
                <option value="Draw">ドロー</option>
                <option value="Trash">トラッシュに送る</option>
                <option value="SelectOption">選択肢(Option)</option>
              </select>
              <input 
                type="text" 
                placeholder={getPlaceholderForAction(act.type)}
                value={act.detail}
                onChange={e => updateAction(idx, 'detail', e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        ))}
        <button 
          onClick={addAction} 
          type="button" 
          style={{ 
            marginTop: '5px', 
            fontSize: '14px', 
            padding: '12px',
            background: 'transparent', 
            border: '2px dashed #7f8c8d', 
            color: '#ecf0f1', 
            cursor: 'pointer', 
            width: '100%',
            borderRadius: '4px'
          }}
        >
          + アクション追加
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={labelStyle}>補足メモ</label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          style={{...inputStyle, height: 'auto'}}
        />
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button 
          onClick={onCancel} 
          style={{ 
            flex: 1,
            padding: '12px', 
            background: '#7f8c8d', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px', 
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer' 
          }}
        >
          キャンセル
        </button>
        <button 
          onClick={handleSubmit} 
          style={{ 
            flex: 1,
            padding: '12px', 
            background: '#27ae60', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px', 
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer' 
          }}
        >
          報告送信
        </button>
      </div>
      
      {/* iOS Safariの下部バー余白用 */}
      <div style={{ height: '20px' }}></div>
    </div>
  );
};
