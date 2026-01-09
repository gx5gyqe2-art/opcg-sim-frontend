import React, { useState, useMemo } from 'react';
import type { 
  EffectReport, TriggerType, ActionType,
  EffectAction, VerificationCheck, VerificationOperator
} from '../game/effectReporting';

interface Props {
  cardName?: string;
  gameState: any;
  activePlayerId: string;
  onSubmit: (report: EffectReport) => void;
  onCancel: () => void;
}

// 簡易カード型
interface SimpleCard {
  uuid: string;
  name: string;
  text?: string;
  owner: string;
  zone: string;
}

// アクティブな入力フィールドを識別するID
type FieldId = string;

export const EffectReportForm: React.FC<Props> = ({ cardName = '', gameState, activePlayerId, onSubmit, onCancel }) => {
  // --- State ---
  const [inputCardName, setInputCardName] = useState(cardName);
  const [rawText, setRawText] = useState('');
  const [trigger, setTrigger] = useState<TriggerType>('ON_PLAY');
  const [conditionText, setConditionText] = useState('');
  const [note, setNote] = useState('');

  const [showCardSelector, setShowCardSelector] = useState(false);
  
  // 文字選択用
  const [rangeStart, setRangeStart] = useState<number | null>(null);
  const [rangeEnd, setRangeEnd] = useState<number | null>(null);

  // アクティブなフィールド（ここにテキストが注入される）
  const [activeFieldId, setActiveFieldId] = useState<FieldId | null>(null);

  // データ
  const [costs, setCosts] = useState<EffectAction[]>([]);
  const [effects, setEffects] = useState<EffectAction[]>([]);
  const [verifications, setVerifications] = useState<VerificationCheck[]>([]);

  // --- Helpers ---
  
  // テキスト選択ハンドラ
  const handleCharClick = (index: number) => {
    let newStart = rangeStart;
    let newEnd = rangeEnd;

    if (newStart === null) {
      newStart = index;
      newEnd = null;
    } else if (newEnd === null) {
      if (index < newStart) {
        newEnd = newStart;
        newStart = index;
      } else {
        newEnd = index;
      }
    } else {
      newStart = index;
      newEnd = null;
    }
    setRangeStart(newStart);
    setRangeEnd(newEnd);

    // テキスト確定時にアクティブフィールドがあれば注入
    if (newStart !== null) {
      const start = newStart;
      const end = newEnd !== null ? newEnd : newStart;
      const text = rawText.slice(start, end + 1);
      
      if (activeFieldId && text) {
        handleInjectText(activeFieldId, text);
      }
    }
  };

  // テキスト注入ロジック
  const handleInjectText = (fieldId: string, text: string) => {
    const [section, indexStr, prop, subProp] = fieldId.split('-');
    const idx = parseInt(indexStr);
    
    // 数値変換を試みる（全角対応）
    const numVal = parseInt(text.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).replace(/[^0-9-]/g, '')) || 0;
    
    const updateList = (list: EffectAction[], setList: React.Dispatch<React.SetStateAction<EffectAction[]>>) => {
      const newList = [...list];
      const item = newList[idx];
      
      if (prop === 'value') {
        item.value = numVal;
      } else if (prop === 'target') {
        if (!item.target) item.target = { zone: 'FIELD', player: 'OPPONENT', count: 1, is_up_to: false };
        
        if (subProp === 'count') item.target.count = numVal;
        else if (subProp === 'filterQuery') item.target.filterQuery = text;
      }
      item.raw_text = text;
      setList(newList);
    };

    if (section === 'cost') updateList(costs, setCosts);
    if (section === 'effect') updateList(effects, setEffects);
    
    if (section === 'condition') setConditionText(prev => prev ? prev + " " + text : text);

    setRangeStart(null);
    setRangeEnd(null);
    setActiveFieldId(null);
  };

  // リスト操作
  const addAction = (section: 'cost' | 'effect') => {
    const newItem: EffectAction = { type: 'OTHER', value: 0 };
    if (section === 'cost') setCosts([...costs, newItem]);
    else setEffects([...effects, { ...newItem, target: { player: 'OPPONENT', zone: 'FIELD', count: 1, is_up_to: false } }]);
  };
  
  const removeAction = (section: 'cost' | 'effect', idx: number) => {
    if (section === 'cost') setCosts(costs.filter((_, i) => i !== idx));
    else setEffects(effects.filter((_, i) => i !== idx));
  };

  const updateActionType = (section: 'cost' | 'effect', idx: number, type: ActionType) => {
    const list = section === 'cost' ? costs : effects;
    const setList = section === 'cost' ? setCosts : setEffects;
    const newList = [...list];
    newList[idx].type = type;
    setList(newList);
  };

  const updateActionTarget = (section: 'cost' | 'effect', idx: number, key: string, val: any) => {
    const list = section === 'cost' ? costs : effects;
    const setList = section === 'cost' ? setCosts : setEffects;
    const newList = [...list];
    if (!newList[idx].target) newList[idx].target = { player: 'OPPONENT', zone: 'FIELD', count: 1, is_up_to: false };
    (newList[idx].target as any)[key] = val;
    setList(newList);
  };

  // 検証項目の操作
  const addVerification = () => {
    setVerifications([...verifications, { targetPlayer: 'OPPONENT', targetProperty: 'field', operator: 'DECREASE_BY', value: 1 }]);
  };

  const removeVerification = (idx: number) => {
    setVerifications(verifications.filter((_, i) => i !== idx));
  };

  const updateVerification = (idx: number, field: keyof VerificationCheck, val: any) => {
    const newVer = [...verifications];
    (newVer[idx] as any)[field] = val;
    setVerifications(newVer);
  };

  // カード選択
  const visibleCards = useMemo(() => {
    if (!gameState) return [];
    const cards: SimpleCard[] = [];
    const processPlayer = (pid: string, pData: any) => {
      const ownerLabel = pid === activePlayerId ? '自分' : '相手';
      if (pData.leader) cards.push({ uuid: pData.leader.uuid, name: pData.leader.name, text: pData.leader.text, owner: ownerLabel, zone: 'リーダー' });
      if (pData.stage) cards.push({ uuid: pData.stage.uuid, name: pData.stage.name, text: pData.stage.text, owner: ownerLabel, zone: 'ステージ' });
      pData.zones.field.forEach((c: any) => cards.push({ uuid: c.uuid, name: c.name, text: c.text, owner: ownerLabel, zone: '盤面' }));
      pData.zones.hand.forEach((c: any) => cards.push({ uuid: c.uuid, name: c.name, text: c.text, owner: ownerLabel, zone: '手札' }));
      pData.zones.trash.forEach((c: any) => cards.push({ uuid: c.uuid, name: c.name, text: c.text, owner: ownerLabel, zone: 'トラッシュ' }));
    };
    if (gameState.players.p1) processPlayer('p1', gameState.players.p1);
    if (gameState.players.p2) processPlayer('p2', gameState.players.p2);
    return cards;
  }, [gameState, activePlayerId]);

  const handleSelectCard = (card: SimpleCard) => {
    setInputCardName(card.name);
    if (card.text) {
      setRawText(card.text);
      setRangeStart(null); setRangeEnd(null);
    }
    setShowCardSelector(false);
  };

  const handleSubmit = () => {
    const report: EffectReport = {
      correction: {
        cardName: inputCardName,
        rawText: rawText,
        ability: {
          trigger: trigger,
          condition: conditionText, // 型修正済み
          costs: costs,
          actions: effects,
          raw_text: rawText
        }
      },
      verification: { expectedStateChanges: verifications },
      note: note
    };
    onSubmit(report);
  };

  // --- UI Components ---

  const SlotInput = ({ id, value, placeholder, width = '60px' }: { id: string, value: string | number, placeholder?: string, width?: string }) => {
    const isActive = activeFieldId === id;
    return (
      <div 
        onClick={() => setActiveFieldId(isActive ? null : id)}
        style={{
          minWidth: width,
          height: '32px',
          padding: '0 8px',
          background: isActive ? '#3498db' : '#2c3e50',
          border: isActive ? '2px solid #f1c40f' : '1px solid #7f8c8d',
          borderRadius: '4px',
          color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          fontSize: '14px',
          transition: 'all 0.2s',
          overflow: 'hidden', whiteSpace: 'nowrap'
        }}
      >
        {value || <span style={{color:'#95a5a6', fontSize:'0.8em'}}>{placeholder || '選択'}</span>}
      </div>
    );
  };

  // Styles
  const overlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' };
  const formContainerStyle: React.CSSProperties = { width: '100%', height: '100%', backgroundColor: '#2c3e50', color: '#ecf0f1', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' };
  const scrollAreaStyle: React.CSSProperties = { flex: 1, overflowY: 'auto', padding: '15px', paddingBottom: '120px', WebkitOverflowScrolling: 'touch' };
  const sectionStyle: React.CSSProperties = { marginBottom: '20px', border: '1px solid #7f8c8d', padding: '10px', borderRadius: '8px', background: '#34495e' };
  const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9em', color: '#bdc3c7' };
  const btnStyle = (bg: string) => ({ padding: '8px 12px', background: bg, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', whiteSpace: 'nowrap' });
  const selectStyle: React.CSSProperties = { padding: '5px', borderRadius: '4px', border: '1px solid #7f8c8d', background: '#2c3e50', color: 'white', fontSize: '13px' };
  const inputStyle: React.CSSProperties = { padding: '5px', borderRadius: '4px', border: '1px solid #7f8c8d', background: '#2c3e50', color: 'white', fontSize: '13px', maxWidth: '60px' };

  if (showCardSelector) {
    return (
      <div style={overlayStyle}>
        <div style={{...formContainerStyle, background: '#2c3e50', padding: '10px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
            <h3>🃏 対象カードを選択</h3>
            <button onClick={() => setShowCardSelector(false)} style={btnStyle('#95a5a6')}>閉じる</button>
          </div>
          <div style={{...scrollAreaStyle, padding: 0}}>
            {visibleCards.map((c) => (
              <div key={c.uuid} onClick={() => handleSelectCard(c)} style={{padding: '12px', borderBottom: '1px solid #7f8c8d', cursor: 'pointer', background: inputCardName === c.name ? '#2980b9' : 'transparent'}}>
                <div style={{fontWeight: 'bold'}}>{c.name}</div>
                <div style={{fontSize: '0.8em', color: '#bdc3c7'}}>[{c.owner}] {c.zone}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={overlayStyle}>
      <div style={formContainerStyle}>
        <div style={{ padding: '10px 15px', background: '#2c3e50', borderBottom: '1px solid #7f8c8d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>🛠 効果修正レポート (スロット式)</h3>
          <button onClick={onCancel} style={{ background: 'transparent', border: 'none', color: '#bdc3c7', fontSize: '24px' }}>×</button>
        </div>

        <div style={scrollAreaStyle}>
          {/* テキスト選択エリア */}
          <div style={{...sectionStyle, position: 'sticky', top: 0, zIndex: 100, background: '#2c3e50', borderBottom: '2px solid #f1c40f', boxShadow: '0 4px 10px rgba(0,0,0,0.5)'}}>
            <div style={{display: 'flex', gap: '8px', marginBottom: '5px'}}>
              <input value={inputCardName} readOnly placeholder="カード未選択" style={{background: 'transparent', border:'none', color:'white', fontWeight:'bold', flex:1}} />
              <button onClick={() => setShowCardSelector(true)} style={btnStyle('#e67e22')}>カード選択</button>
            </div>
            
            <div style={{
              background: '#202020', padding: '10px', borderRadius: '6px', 
              fontFamily: 'monospace', fontSize: '16px', lineHeight: '2.2',
              minHeight: '60px', whiteSpace: 'pre-wrap', border: '1px solid #7f8c8d'
            }}>
              {rawText ? rawText.split('').map((char, idx) => {
                const isSelected = rangeStart !== null && rangeEnd !== null 
                  ? (idx >= rangeStart && idx <= rangeEnd)
                  : (idx === rangeStart);
                return (
                  <span 
                    key={idx}
                    onClick={() => handleCharClick(idx)}
                    style={{
                      background: isSelected ? '#3498db' : 'transparent',
                      color: isSelected ? 'white' : '#ecf0f1',
                      padding: '4px 1px', margin: '0 1px',
                      borderRadius: '3px', cursor: 'pointer',
                      borderBottom: rangeStart === idx ? '3px solid #e74c3c' : '1px solid #444',
                      borderTop: isSelected ? '1px solid #3498db' : 'none'
                    }}
                  >
                    {char}
                  </span>
                );
              }) : <span style={{color: '#7f8c8d'}}>カードを選択してください</span>}
            </div>
            {activeFieldId && (
              <div style={{fontSize:'12px', color:'#f1c40f', marginTop:'5px', textAlign:'center'}}>
                ✨ テキストをタップして <b>{activeFieldId}</b> に入力
              </div>
            )}
          </div>

          {/* トリガー & 条件 */}
          <div style={sectionStyle}>
            <div style={{marginBottom: '10px'}}>
              <label style={labelStyle}>Trigger (いつ)</label>
              <select value={trigger} onChange={e => setTrigger(e.target.value as TriggerType)} style={{...selectStyle, width: '100%'}}>
                <option value="ON_PLAY">登場時</option>
                <option value="ON_ATTACK">アタック時</option>
                <option value="ACTIVATE_MAIN">起動メイン</option>
                <option value="ON_BLOCK">ブロック時</option>
                <option value="ON_KO">KO時</option>
                <option value="TURN_END">ターン終了時</option>
                <option value="TRIGGER">トリガー</option>
                <option value="RULE">ルール効果</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Condition (条件)</label>
              <SlotInput id="condition-0-text" value={conditionText} placeholder="例: リーダーが特徴《...》" width="100%" />
            </div>
          </div>

          {/* コスト */}
          <div style={sectionStyle}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}>
              <label style={labelStyle}>Costs (コスト)</label>
              <button onClick={() => addAction('cost')} style={btnStyle('#7f8c8d')}>+ 追加</button>
            </div>
            {costs.map((c, i) => (
              <div key={i} style={{background: 'rgba(0,0,0,0.2)', padding:'8px', marginBottom:'8px', borderRadius:'4px'}}>
                <div style={{display:'flex', gap:'5px', marginBottom:'5px'}}>
                  <select value={c.type} onChange={e => updateActionType('cost', i, e.target.value as ActionType)} style={selectStyle}>
                    <option value="DOWN_DON">ドン!!-</option>
                    <option value="REST_DON">ドン!!レスト</option>
                    <option value="RETURN_DON">ドン!!戻す</option>
                    <option value="TRASH">手札捨て</option>
                    <option value="REST">自身レスト</option>
                    <option value="OTHER">その他</option>
                  </select>
                  <button onClick={() => removeAction('cost', i)} style={{...btnStyle('#c0392b'), padding:'2px 8px'}}>×</button>
                </div>
                <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                  <span style={{fontSize:'0.8em', color:'#bdc3c7'}}>Value:</span>
                  <SlotInput id={`cost-${i}-value`} value={c.value || ''} placeholder="数値" />
                </div>
              </div>
            ))}
          </div>

          {/* 効果 */}
          <div style={sectionStyle}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}>
              <label style={labelStyle}>Actions (効果)</label>
              <button onClick={() => addAction('effect')} style={btnStyle('#7f8c8d')}>+ 追加</button>
            </div>
            {effects.map((eff, i) => (
              <div key={i} style={{background: 'rgba(0,0,0,0.2)', padding:'8px', marginBottom:'8px', borderRadius:'4px'}}>
                <div style={{display:'flex', gap:'5px', marginBottom:'8px'}}>
                  <select value={eff.type} onChange={e => updateActionType('effect', i, e.target.value as ActionType)} style={{...selectStyle, flex:1}}>
                    <option value="KO">KO</option>
                    <option value="MOVE_TO_HAND">バウンス</option>
                    <option value="REST">レスト</option>
                    <option value="ACTIVE">アクティブ</option>
                    <option value="BUFF">パワー+</option>
                    <option value="DRAW">ドロー</option>
                    <option value="ATTACH_DON">ドン付与</option>
                    <option value="ACTIVE_DON">ドンアクティブ</option>
                    <option value="PLAY_CARD">登場</option>
                    <option value="LIFE_MANIPULATE">ライフ操作</option>
                    <option value="OTHER">その他</option>
                  </select>
                  <button onClick={() => removeAction('effect', i)} style={{...btnStyle('#c0392b'), padding:'2px 8px'}}>×</button>
                </div>

                <div style={{display:'flex', gap:'10px', alignItems:'center', marginBottom:'8px'}}>
                  <span style={{fontSize:'0.8em', color:'#bdc3c7'}}>Value:</span>
                  <SlotInput id={`effect-${i}-value`} value={eff.value || ''} placeholder="数値" />
                </div>

                {/* Target Section */}
                <div style={{background:'rgba(255,255,255,0.05)', padding:'5px', borderRadius:'4px'}}>
                  <div style={{fontSize:'0.8em', color:'#bdc3c7', marginBottom:'4px'}}>Target (対象)</div>
                  <div style={{display:'flex', gap:'5px', marginBottom:'5px'}}>
                    <select value={eff.target?.player} onChange={e => updateActionTarget('effect', i, 'player', e.target.value)} style={selectStyle}>
                      <option value="OPPONENT">相手</option>
                      <option value="SELF">自分</option>
                      <option value="BOTH">お互い</option>
                    </select>
                    <select value={eff.target?.zone} onChange={e => updateActionTarget('effect', i, 'zone', e.target.value)} style={selectStyle}>
                      <option value="FIELD">盤面</option>
                      <option value="HAND">手札</option>
                      <option value="LIFE">ライフ</option>
                      <option value="TRASH">トラッシュ</option>
                    </select>
                  </div>
                  <div style={{display:'flex', gap:'5px', alignItems:'center'}}>
                    <span style={{fontSize:'0.8em'}}>枚数:</span>
                    <SlotInput id={`effect-${i}-target-count`} value={eff.target?.count || ''} placeholder="1" width="40px" />
                    <span style={{fontSize:'0.8em'}}>条件:</span>
                    <SlotInput id={`effect-${i}-target-filterQuery`} value={eff.target?.filterQuery || ''} placeholder="Cost<=4" width="100px" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 検証 (追加) */}
          <div style={sectionStyle}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}>
              <label style={labelStyle}>Verification (検証)</label>
              <button onClick={addVerification} style={btnStyle('#7f8c8d')}>+ 追加</button>
            </div>
            {verifications.map((v, i) => (
              <div key={i} style={{background: 'rgba(0,0,0,0.2)', padding:'5px', marginBottom:'5px', borderRadius:'4px', display:'flex', gap:'5px', flexWrap:'wrap', alignItems:'center'}}>
                <select value={v.targetPlayer} onChange={e => updateVerification(i, 'targetPlayer', e.target.value)} style={selectStyle}>
                  <option value="OPPONENT">相手</option>
                  <option value="SELF">自分</option>
                </select>
                <select value={v.targetProperty} onChange={e => updateVerification(i, 'targetProperty', e.target.value)} style={selectStyle}>
                  <option value="field">盤面</option>
                  <option value="hand">手札</option>
                  <option value="life">ライフ</option>
                </select>
                <select value={v.operator} onChange={e => updateVerification(i, 'operator', e.target.value as VerificationOperator)} style={selectStyle}>
                  <option value="DECREASE_BY">減る</option>
                  <option value="INCREASE_BY">増える</option>
                </select>
                <input value={v.value} onChange={e => updateVerification(i, 'value', e.target.value)} style={inputStyle} placeholder="1" />
                <button onClick={() => removeVerification(i)} style={{...btnStyle('#c0392b'), padding:'2px 6px'}}>×</button>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>補足メモ</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} style={{width: '100%', padding:'8px', borderRadius:'4px', border:'1px solid #7f8c8d', background:'#2c3e50', color:'white', boxSizing:'border-box'}} />
          </div>
        </div>

        <div style={{ padding: '15px', background: '#2c3e50', borderTop: '1px solid #7f8c8d', display: 'flex', gap: '10px' }}>
          <button onClick={onCancel} style={{...btnStyle('#7f8c8d'), flex: 1, padding: '12px', fontSize:'16px'}}>キャンセル</button>
          <button onClick={handleSubmit} style={{...btnStyle('#27ae60'), flex: 1, padding: '12px', fontSize:'16px'}}>報告送信</button>
        </div>
      </div>
    </div>
  );
};
