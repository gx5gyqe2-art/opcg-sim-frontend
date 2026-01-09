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
      case 'SelectOption': return '例: 1枚引く | 相手キャラをKO';
      case 'AddDon': return '例: 2 (枚数)';
      default: return '詳細';
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: '#2c3e50',
      color: '#ecf0f1',
      padding: '20px',
      borderRadius: '8px',
      boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
      zIndex: 10000,
      width: '500px',
      maxHeight: '90vh',
      overflowY: 'auto',
      fontFamily: 'monospace'
    }}>
      <h3 style={{ marginTop: 0, borderBottom: '1px solid #7f8c8d', paddingBottom: '10px' }}>
        🎴 効果定義レポート
      </h3>
      
      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', fontSize: '0.8em', color: '#bdc3c7' }}>カード名</label>
        <input 
          type="text" 
          value={inputCardName}
          onChange={e => setInputCardName(e.target.value)}
          placeholder="カード名を入力"
          style={{ width: '100%', padding: '5px', background: '#34495e', color: 'white', border: '1px solid #7f8c8d' }}
        />
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', fontSize: '0.8em', color: '#bdc3c7' }}>いつ (Trigger)</label>
        <select 
          value={trigger} 
          onChange={e => setTrigger(e.target.value as EffectTrigger)}
          style={{ width: '100%', padding: '5px', background: '#34495e', color: 'white', border: '1px solid #7f8c8d' }}
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

      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', fontSize: '0.8em', color: '#bdc3c7' }}>どの場合 (Condition)</label>
        <input 
          type="text" 
          placeholder="例: リーダーが特徴《麦わらの一味》を持つ場合" 
          value={condition}
          onChange={e => setCondition(e.target.value)}
          style={{ width: '100%', padding: '5px', background: '#34495e', color: 'white', border: '1px solid #7f8c8d' }}
        />
      </div>

      <hr style={{ borderColor: '#7f8c8d', opacity: 0.3 }} />

      <div style={{ marginBottom: '10px', display: 'flex', gap: '10px' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: '0.8em', color: '#bdc3c7' }}>どこから (Source)</label>
          <select 
            value={sourceZone} 
            onChange={e => setSourceZone(e.target.value as GameZone)}
            style={{ width: '100%', padding: '5px', background: '#34495e', color: 'white', border: '1px solid #7f8c8d' }}
          >
            <option value="Field">盤面</option>
            <option value="Hand">手札</option>
            <option value="Trash">トラッシュ</option>
            <option value="Life">ライフ</option>
            <option value="Deck">デッキ</option>
            <option value="CostArea">コストエリア</option>
          </select>
        </div>
        <div style={{ width: '80px' }}>
          <label style={{ display: 'block', fontSize: '0.8em', color: '#bdc3c7' }}>枚数</label>
          <input 
            type="number" 
            value={targetCount} 
            onChange={e => setTargetCount(Number(e.target.value))}
            style={{ width: '100%', padding: '5px', background: '#34495e', color: 'white', border: '1px solid #7f8c8d' }}
          />
        </div>
      </div>
      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', fontSize: '0.8em', color: '#bdc3c7' }}>何を (Filter)</label>
        <input 
          type="text" 
          placeholder="例: コスト3以下のキャラ" 
          value={targetFilter} 
          onChange={e => setTargetFilter(e.target.value)}
          style={{ width: '100%', padding: '5px', background: '#34495e', color: 'white', border: '1px solid #7f8c8d' }}
        />
      </div>

      <hr style={{ borderColor: '#7f8c8d', opacity: 0.3 }} />

      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', fontSize: '0.8em', color: '#bdc3c7' }}>効果・行動 (Actions)</label>
        {actions.map((act, idx) => (
          <div key={idx} style={{ marginBottom: '5px', display: 'flex', gap: '5px', alignItems: 'center' }}>
            <span style={{color: '#95a5a6', fontSize: '0.8em'}}>{idx+1}.</span>
            <select 
              value={act.type} 
              onChange={e => updateAction(idx, 'type', e.target.value as ActionType)}
              style={{ width: '130px', padding: '5px', background: '#34495e', color: 'white', border: '1px solid #7f8c8d' }}
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
              style={{ flex: 1, padding: '5px', background: '#34495e', color: 'white', border: '1px solid #7f8c8d' }}
            />
            {actions.length > 1 && (
              <button 
                onClick={() => removeAction(idx)}
                style={{ background: '#c0392b', color: 'white', border: 'none', cursor: 'pointer', padding: '5px 10px' }}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button 
          onClick={addAction} 
          type="button" 
          style={{ marginTop: '5px', fontSize: '0.8em', background: 'transparent', border: '1px dashed #7f8c8d', color: '#bdc3c7', cursor: 'pointer', width: '100%' }}
        >
          + アクション追加
        </button>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', fontSize: '0.8em', color: '#bdc3c7' }}>補足メモ</label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          style={{ width: '100%', padding: '5px', background: '#34495e', color: 'white', border: '1px solid #7f8c8d' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ padding: '8px 16px', background: '#7f8c8d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>キャンセル</button>
        <button onClick={handleSubmit} style={{ padding: '8px 16px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>報告送信</button>
      </div>
    </div>
  );
};
