import React, { useState } from 'react';
import type { 
  EffectReport, EffectTrigger, 
  CostDefinition, EffectDefinition, VerificationCheck
} from '../game/effectReporting';

interface Props {
  cardName?: string;
  onSubmit: (report: EffectReport) => void;
  onCancel: () => void;
}

export const EffectReportForm: React.FC<Props> = ({ cardName = '', onSubmit, onCancel }) => {
  // 基本情報
  const [inputCardName, setInputCardName] = useState(cardName);
  const [rawText, setRawText] = useState('');
  const [trigger, setTrigger] = useState<EffectTrigger>('ON_PLAY');
  const [conditionText, setConditionText] = useState('');
  const [note, setNote] = useState('');

  // リスト項目
  const [costs, setCosts] = useState<CostDefinition[]>([]);
  const [effects, setEffects] = useState<EffectDefinition[]>([]);
  const [verifications, setVerifications] = useState<VerificationCheck[]>([]);

  // --- Helpers for UI Builders ---
  
  const addCost = () => setCosts([...costs, { type: 'DOWN_DON', amount: 1 }]);
  const updateCost = (idx: number, field: keyof CostDefinition, val: any) => {
    const newCosts = [...costs];
    (newCosts[idx] as any)[field] = val;
    setCosts(newCosts);
  };
  const removeCost = (idx: number) => setCosts(costs.filter((_, i) => i !== idx));

  const addEffect = () => setEffects([...effects, { 
    type: 'KO', 
    target: { player: 'OPPONENT', zone: 'FIELD', cardType: 'CHARACTER', filterQuery: '', count: 1 } 
  }]);
  const updateEffect = (idx: number, field: keyof EffectDefinition, val: any) => {
    const newEffects = [...effects];
    (newEffects[idx] as any)[field] = val;
    setEffects(newEffects);
  };
  const updateEffectTarget = (idx: number, field: string, val: any) => {
    const newEffects = [...effects];
    if (!newEffects[idx].target) return;
    (newEffects[idx].target as any)[field] = val;
    setEffects(newEffects);
  };
  const removeEffect = (idx: number) => setEffects(effects.filter((_, i) => i !== idx));

  const addVerification = () => setVerifications([...verifications, { 
    targetPlayer: 'OPPONENT', targetProperty: 'field', operator: 'DECREASE_BY', value: 1 
  }]);
  const updateVerification = (idx: number, field: keyof VerificationCheck, val: any) => {
    const newVer = [...verifications];
    (newVer[idx] as any)[field] = val;
    setVerifications(newVer);
  };
  const removeVerification = (idx: number) => setVerifications(verifications.filter((_, i) => i !== idx));

  const handleSubmit = () => {
    const report: EffectReport = {
      correction: {
        cardName: inputCardName,
        rawText,
        structuredEffect: {
          trigger,
          costs,
          conditions: conditionText,
          effects
        }
      },
      verification: {
        expectedStateChanges: verifications
      },
      note
    };
    onSubmit(report);
  };

  // Styles
  const containerStyle: React.CSSProperties = {
    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
    backgroundColor: '#2c3e50', color: '#ecf0f1', padding: '20px', borderRadius: '8px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 10000,
    width: '95%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto',
    fontFamily: 'sans-serif', fontSize: '14px', boxSizing: 'border-box'
  };
  const sectionStyle: React.CSSProperties = { marginBottom: '20px', border: '1px solid #7f8c8d', padding: '10px', borderRadius: '4px' };
  const rowStyle: React.CSSProperties = { display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'center' };
  const inputStyle: React.CSSProperties = { padding: '8px', borderRadius: '4px', border: '1px solid #95a5a6', background: '#34495e', color: 'white', flex: 1 };
  const btnStyle = (color: string) => ({ padding: '5px 10px', background: color, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' });

  return (
    <div style={containerStyle}>
      <h3 style={{ marginTop: 0, borderBottom: '1px solid #7f8c8d', paddingBottom: '10px' }}>🛠 自動修正用データ作成</h3>
      
      {/* 1. 基本情報 */}
      <div style={sectionStyle}>
        <div style={rowStyle}>
          <input placeholder="カード名" value={inputCardName} onChange={e => setInputCardName(e.target.value)} style={inputStyle} />
          <select value={trigger} onChange={e => setTrigger(e.target.value as EffectTrigger)} style={inputStyle}>
            <option value="ON_PLAY">登場時</option>
            <option value="WHEN_ATTACKING">アタック時</option>
            <option value="ACTIVATE_MAIN">起動メイン</option>
            <option value="ON_BLOCK">ブロック時</option>
            <option value="ON_KO">KO時</option>
            <option value="TURN_END">ターン終了時</option>
            <option value="TRIGGER">トリガー</option>
          </select>
        </div>
        <textarea 
          placeholder="カードテキスト原文 (Parser学習用)" 
          value={rawText} onChange={e => setRawText(e.target.value)} 
          style={{...inputStyle, width: '100%', height: '50px'}} 
        />
      </div>

      {/* 2. コスト & 条件 */}
      <div style={sectionStyle}>
        <label>💰 コスト定義</label>
        {costs.map((c, i) => (
          <div key={i} style={rowStyle}>
            <select value={c.type} onChange={e => updateCost(i, 'type', e.target.value)} style={inputStyle}>
              <option value="DOWN_DON">ドン!!-</option>
              <option value="REST_DON">ドン!!レスト</option>
              <option value="TRASH_CARD">手札を捨てる</option>
              <option value="RETURN_DON">ドン!!を戻す</option>
            </select>
            <input type="number" value={c.amount} onChange={e => updateCost(i, 'amount', Number(e.target.value))} style={{...inputStyle, maxWidth: '60px'}} />
            <button onClick={() => removeCost(i)} style={btnStyle('#c0392b')}>×</button>
          </div>
        ))}
        <button onClick={addCost} style={btnStyle('#7f8c8d')}>+ コスト追加</button>
        
        <div style={{ marginTop: '10px' }}>
          <input placeholder="発動条件 (例: リーダーが特徴《麦わら》を持つ)" value={conditionText} onChange={e => setConditionText(e.target.value)} style={{...inputStyle, width: '100%'}} />
        </div>
      </div>

      {/* 3. 効果定義 (Actions) */}
      <div style={sectionStyle}>
        <label>⚡ 効果定義 (Matcher & Resolver)</label>
        {effects.map((eff, i) => (
          <div key={i} style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', marginBottom: '10px', borderRadius: '4px' }}>
            <div style={rowStyle}>
              <select value={eff.type} onChange={e => updateEffect(i, 'type', e.target.value)} style={inputStyle}>
                <option value="KO">KOする</option>
                <option value="RETURN_TO_HAND">手札に戻す</option>
                <option value="REST">レストにする</option>
                <option value="ACTIVE">アクティブにする</option>
                <option value="TRASH">トラッシュに送る</option>
                <option value="BUFF_POWER">パワー増減</option>
                <option value="ADD_DON_ACTIVE">ドン追加(アクティブ)</option>
                <option value="DRAW">ドロー</option>
                <option value="OTHER">その他</option>
              </select>
              <button onClick={() => removeEffect(i)} style={btnStyle('#c0392b')}>削除</button>
            </div>
            
            {/* 対象セレクタ (対象を取る効果の場合) */}
            {['KO', 'RETURN_TO_HAND', 'REST', 'ACTIVE', 'TRASH', 'BUFF_POWER'].includes(eff.type) && eff.target && (
              <div style={{ fontSize: '0.9em', paddingLeft: '10px', borderLeft: '3px solid #3498db' }}>
                <div style={rowStyle}>
                  <select value={eff.target.player} onChange={e => updateEffectTarget(i, 'player', e.target.value)} style={inputStyle}>
                    <option value="OPPONENT">相手の</option>
                    <option value="SELF">自分の</option>
                    <option value="BOTH">お互いの</option>
                  </select>
                  <select value={eff.target.zone} onChange={e => updateEffectTarget(i, 'zone', e.target.value)} style={inputStyle}>
                    <option value="FIELD">盤面</option>
                    <option value="HAND">手札</option>
                    <option value="LIFE">ライフ</option>
                    <option value="TRASH">トラッシュ</option>
                  </select>
                  <select value={eff.target.cardType} onChange={e => updateEffectTarget(i, 'cardType', e.target.value)} style={inputStyle}>
                    <option value="CHARACTER">キャラ</option>
                    <option value="LEADER">リーダー</option>
                    <option value="STAGE">ステージ</option>
                    <option value="ALL">すべて</option>
                  </select>
                </div>
                <div style={rowStyle}>
                  <input placeholder="条件 (例: Cost<=4)" value={eff.target.filterQuery} onChange={e => updateEffectTarget(i, 'filterQuery', e.target.value)} style={inputStyle} />
                  <input type="number" placeholder="枚数" value={eff.target.count} onChange={e => updateEffectTarget(i, 'count', Number(e.target.value))} style={{...inputStyle, maxWidth: '60px'}} />
                  <span>枚まで</span>
                </div>
              </div>
            )}
            
            {['BUFF_POWER', 'ADD_DON_ACTIVE', 'DRAW'].includes(eff.type) && (
              <input placeholder="値 (例: +1000, 2)" value={eff.value || ''} onChange={e => updateEffect(i, 'value', e.target.value)} style={inputStyle} />
            )}
          </div>
        ))}
        <button onClick={addEffect} style={btnStyle('#7f8c8d')}>+ 効果追加</button>
      </div>

      {/* 4. 検証条件 (Verification) */}
      <div style={sectionStyle}>
        <label>✅ 検証条件 (テスト自動生成用)</label>
        {verifications.map((v, i) => (
          <div key={i} style={rowStyle}>
            <select value={v.targetPlayer} onChange={e => updateVerification(i, 'targetPlayer', e.target.value)} style={inputStyle}>
              <option value="OPPONENT">相手の</option>
              <option value="SELF">自分の</option>
            </select>
            <select value={v.targetProperty} onChange={e => updateVerification(i, 'targetProperty', e.target.value)} style={inputStyle}>
              <option value="field">盤面枚数</option>
              <option value="hand">手札枚数</option>
              <option value="life">ライフ枚数</option>
              <option value="don_active">アクティブドン</option>
            </select>
            <select value={v.operator} onChange={e => updateVerification(i, 'operator', e.target.value)} style={inputStyle}>
              <option value="DECREASE_BY">が減る (数)</option>
              <option value="INCREASE_BY">が増える (数)</option>
              <option value="CONTAINS">を含む (ID)</option>
              <option value="NOT_CONTAINS">を含まない (ID)</option>
            </select>
            <input placeholder="値" value={v.value} onChange={e => updateVerification(i, 'value', e.target.value)} style={{...inputStyle, maxWidth: '100px'}} />
            <button onClick={() => removeVerification(i)} style={btnStyle('#c0392b')}>×</button>
          </div>
        ))}
        <button onClick={addVerification} style={btnStyle('#7f8c8d')}>+ 検証条件追加</button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label>補足メモ</label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          style={{...inputStyle, height: 'auto', width: '100%'}}
        />
      </div>

      <div style={rowStyle}>
        <button onClick={onCancel} style={{...btnStyle('#7f8c8d'), flex: 1, padding: '12px'}}>キャンセル</button>
        <button onClick={handleSubmit} style={{...btnStyle('#27ae60'), flex: 1, padding: '12px', fontWeight: 'bold'}}>報告送信</button>
      </div>
    </div>
  );
};
