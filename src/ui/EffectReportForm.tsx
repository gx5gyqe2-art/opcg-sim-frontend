import React, { useState, useMemo } from 'react';
import type { 
  EffectReport, TriggerType, ActionType,
  EffectAction, TargetQuery, VerificationCheck,
  Zone, PlayerType
} from '../game/effectReporting';

interface Props {
  cardName?: string;
  gameState: any;
  activePlayerId: string;
  onSubmit: (report: EffectReport) => void;
  onCancel: () => void;
}

interface SimpleCard {
  uuid: string;
  name: string;
  text?: string;
  owner: string;
  zone: string;
}

export const EffectReportForm: React.FC<Props> = ({ cardName = '', gameState, activePlayerId, onSubmit, onCancel }) => {
  const [inputCardName, setInputCardName] = useState(cardName);
  const [rawText, setRawText] = useState('');
  const [trigger, setTrigger] = useState<TriggerType>('ON_PLAY');
  const [conditionText, setConditionText] = useState('');
  const [note, setNote] = useState('');

  const [showCardSelector, setShowCardSelector] = useState(false);
  
  // 文字選択用
  const [rangeStart, setRangeStart] = useState<number | null>(null);
  const [rangeEnd, setRangeEnd] = useState<number | null>(null);

  // リスト項目
  const [costs, setCosts] = useState<EffectAction[]>([]);
  const [effects, setEffects] = useState<EffectAction[]>([]);
  const [verifications, setVerifications] = useState<VerificationCheck[]>([]);

  // --- 文字選択ロジック ---
  const handleCharClick = (index: number) => {
    if (rangeStart === null) {
      setRangeStart(index);
      setRangeEnd(null);
    } else if (rangeEnd === null) {
      if (index < rangeStart) {
        setRangeEnd(rangeStart);
        setRangeStart(index);
      } else {
        setRangeEnd(index);
      }
    } else {
      setRangeStart(index);
      setRangeEnd(null);
    }
  };

  const selectedText = useMemo(() => {
    if (!rawText || rangeStart === null) return "";
    const start = rangeStart;
    const end = rangeEnd !== null ? rangeEnd : rangeStart;
    return rawText.slice(start, end + 1);
  }, [rawText, rangeStart, rangeEnd]);

  // --- 解析ロジック ---
  const guessCost = (text: string): EffectAction => {
    const action: EffectAction = { type: 'OTHER', value: 1, raw_text: text };
    
    if (text.match(/ドン!!\s*[-−]\s*(\d+)/)) {
      action.type = 'RETURN_DON';
      action.value = parseInt(RegExp.$1);
    } else if (text.match(/ドン!!\s*(\d+)\s*枚をレスト/)) {
      action.type = 'REST_DON';
      action.value = parseInt(RegExp.$1);
    } else if (text.match(/手札(\d+)枚を捨てる/)) {
      action.type = 'TRASH';
      action.source_zone = 'HAND';
      action.subject = 'SELF';
      action.value = parseInt(RegExp.$1);
      action.target = {
        zone: 'HAND',
        player: 'SELF',
        count: parseInt(RegExp.$1),
        is_up_to: false
      };
    }
    return action;
  };

  const guessEffect = (text: string): EffectAction => {
    let type: ActionType = 'OTHER';
    let value = 0;

    if (text.includes('KO')) type = 'KO';
    else if (text.includes('手札に戻す')) type = 'MOVE_TO_HAND';
    else if (text.includes('レスト')) type = 'REST';
    else if (text.includes('アクティブ')) type = 'ACTIVE';
    else if (text.includes('引く')) type = 'DRAW';
    else if (text.includes('パワー')) type = 'BUFF';
    else if (text.includes('登場')) type = 'PLAY_CARD';

    const action: EffectAction = { type, value: 0, raw_text: text };

    if (['KO', 'MOVE_TO_HAND', 'REST', 'ACTIVE', 'BUFF'].includes(type)) {
      const countMatch = text.match(/(\d+)枚/);
      const count = countMatch ? parseInt(countMatch[1]) : 1;
      const isOpponent = !text.includes('自分');
      
      action.target = {
        player: isOpponent ? 'OPPONENT' : 'SELF',
        zone: 'FIELD',
        count: count,
        is_up_to: text.includes('まで'),
      };
    }

    if (type === 'BUFF') {
      const buffMatch = text.match(/([+＋\-−]\d+)/);
      if (buffMatch) {
        action.value = parseInt(buffMatch[1].replace('＋', '+').replace('−', '-'));
      }
    } else if (type === 'DRAW') {
      const drawMatch = text.match(/(\d+)枚/);
      if (drawMatch) action.value = parseInt(drawMatch[1]);
    }

    return action;
  };

  const guessTrigger = (text: string): TriggerType | null => {
    if (text.includes('登場時')) return 'ON_PLAY';
    if (text.includes('アタック時')) return 'ON_ATTACK';
    if (text.includes('起動メイン')) return 'ACTIVATE_MAIN';
    if (text.includes('ブロック時')) return 'ON_BLOCK';
    if (text.includes('KO時')) return 'ON_KO';
    if (text.includes('トリガー')) return 'TRIGGER';
    return null;
  };

  const applySelection = (category: 'TRIGGER' | 'CONDITION' | 'COST' | 'EFFECT') => {
    if (!selectedText) return;

    switch (category) {
      case 'TRIGGER':
        const t = guessTrigger(selectedText);
        if (t) setTrigger(t);
        break;
      case 'CONDITION':
        setConditionText(prev => prev ? prev + " AND " + selectedText : selectedText);
        break;
      case 'COST':
        setCosts([...costs, guessCost(selectedText)]);
        break;
      case 'EFFECT':
        setEffects([...effects, guessEffect(selectedText)]);
        break;
    }
    setRangeStart(null);
    setRangeEnd(null);
  };

  // --- カード選択 ---
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
      setRangeStart(null);
      setRangeEnd(null);
    }
    setShowCardSelector(false);
  };

  // --- Helpers ---
  const removeCost = (idx: number) => setCosts(costs.filter((_, i) => i !== idx));
  const removeEffect = (idx: number) => setEffects(effects.filter((_, i) => i !== idx));
  const removeVerification = (idx: number) => setVerifications(verifications.filter((_, i) => i !== idx));

  const addVerification = () => setVerifications([...verifications, { targetPlayer: 'OPPONENT', targetProperty: 'field', operator: 'DECREASE_BY', value: 1 }]);
  const updateVerification = (idx: number, field: keyof VerificationCheck, val: any) => {
    const newVer = [...verifications]; (newVer[idx] as any)[field] = val; setVerifications(newVer);
  };

  const handleSubmit = () => {
    const report: EffectReport = {
      correction: {
        cardName: inputCardName,
        rawText: rawText,
        ability: {
          trigger: trigger,
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

  // Styles
  const overlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' };
  const formContainerStyle: React.CSSProperties = { width: '100%', height: '100%', backgroundColor: '#2c3e50', color: '#ecf0f1', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' };
  const scrollAreaStyle: React.CSSProperties = { flex: 1, overflowY: 'auto', padding: '15px', paddingBottom: '120px', WebkitOverflowScrolling: 'touch' };
  const sectionStyle: React.CSSProperties = { marginBottom: '20px', border: '1px solid #7f8c8d', padding: '10px', borderRadius: '8px', background: '#34495e' };
  const inputStyle: React.CSSProperties = { padding: '8px', borderRadius: '4px', border: '1px solid #7f8c8d', background: '#2c3e50', color: 'white', flex: 1, fontSize: '14px', maxWidth: '100%' };
  const btnStyle = (bg: string) => ({ padding: '8px 12px', background: bg, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', whiteSpace: 'nowrap' });
  const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9em', color: '#bdc3c7' };

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
          <h3 style={{ margin: 0 }}>🛠 効果修正レポート</h3>
          <button onClick={onCancel} style={{ background: 'transparent', border: 'none', color: '#bdc3c7', fontSize: '24px' }}>×</button>
        </div>

        <div style={scrollAreaStyle}>
          <div style={sectionStyle}>
            <label style={labelStyle}>① カードテキストから抽出 (始点・終点をタップ)</label>
            <div style={{display: 'flex', gap: '8px', marginBottom: '10px'}}>
              <input value={inputCardName} readOnly placeholder="カードを選択してください" style={{...inputStyle, background: '#2c3e50'}} />
              <button onClick={() => setShowCardSelector(true)} style={btnStyle('#e67e22')}>カード選択</button>
            </div>
            
            <div style={{
              background: '#202020', padding: '15px', borderRadius: '6px', 
              fontFamily: 'monospace', fontSize: '16px', lineHeight: '2.2',
              minHeight: '60px', whiteSpace: 'pre-wrap', marginBottom: '10px',
              border: '1px solid #7f8c8d'
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
                      padding: '4px 2px', margin: '0 1px',
                      borderRadius: '3px', cursor: 'pointer',
                      borderBottom: rangeStart === idx ? '3px solid #e74c3c' : '1px solid #444',
                      borderTop: isSelected ? '1px solid #3498db' : 'none'
                    }}
                  >
                    {char}
                  </span>
                );
              }) : <span style={{color: '#7f8c8d'}}>カードを選択するとテキストが表示されます</span>}
            </div>

            {selectedText && (
              <div style={{
                position: 'sticky', bottom: '0', 
                background: '#2980b9', padding: '10px', borderRadius: '4px', 
                display: 'flex', gap: '8px', zIndex: 10, overflowX: 'auto',
                boxShadow: '0 -2px 10px rgba(0,0,0,0.5)'
              }}>
                <div style={{color:'white', fontSize:'12px', marginBottom:'4px', width:'100%', position:'absolute', top:'-20px', left:0, background:'rgba(0,0,0,0.8)', padding:'2px 5px'}}>
                  選択中: {selectedText}
                </div>
                <div style={{display:'flex', gap:'5px', marginTop:'5px'}}>
                  <button onClick={() => applySelection('TRIGGER')} style={btnStyle('#16a085')}>トリガー</button>
                  <button onClick={() => applySelection('CONDITION')} style={btnStyle('#8e44ad')}>条件</button>
                  <button onClick={() => applySelection('COST')} style={btnStyle('#d35400')}>コスト</button>
                  <button onClick={() => applySelection('EFFECT')} style={btnStyle('#c0392b')}>効果</button>
                </div>
              </div>
            )}
          </div>

          <div style={sectionStyle}>
            <div style={{marginBottom: '10px'}}>
              <label style={{fontSize:'0.9em', color:'#bdc3c7'}}>発動タイミング</label>
              <select value={trigger} onChange={e => setTrigger(e.target.value as TriggerType)} style={{...inputStyle, width: '100%'}}>
                <option value="ON_PLAY">登場時</option>
                <option value="ON_ATTACK">アタック時</option>
                <option value="ACTIVATE_MAIN">起動メイン</option>
                <option value="ON_BLOCK">ブロック時</option>
                <option value="ON_KO">KO時</option>
                <option value="TURN_END">ターン終了時</option>
                <option value="TRIGGER">トリガー</option>
                <option value="RULE">ルール効果</option>
                <option value="UNKNOWN">その他</option>
              </select>
            </div>
            <div>
              <label style={{fontSize:'0.9em', color:'#bdc3c7'}}>発動条件</label>
              <input value={conditionText} onChange={e => setConditionText(e.target.value)} placeholder="例: リーダーが特徴《麦わら》を持つ" style={{...inputStyle, width: '100%', boxSizing:'border-box'}} />
            </div>
          </div>

          <div style={sectionStyle}>
            <label style={labelStyle}>③ コスト (Cost)</label>
            {costs.map((c, i) => (
              <div key={i} style={{display:'flex', gap:'5px', marginBottom:'5px', alignItems:'center', background:'rgba(0,0,0,0.2)', padding:'5px', borderRadius:'4px'}}>
                <div style={{flex:1, fontSize:'0.9em'}}>{c.type} {c.value} {c.raw_text && `(${c.raw_text})`}</div>
                <button onClick={() => removeCost(i)} style={btnStyle('#c0392b')}>×</button>
              </div>
            ))}
          </div>

          <div style={sectionStyle}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px'}}>
              <label style={labelStyle}>④ 効果 (Effect)</label>
            </div>
            {effects.map((eff, i) => (
              <div key={i} style={{background: 'rgba(0,0,0,0.2)', padding:'8px', marginBottom:'8px', borderRadius:'4px'}}>
                <div style={{display:'flex', gap:'5px', marginBottom:'5px', justifyContent:'space-between'}}>
                  <span style={{fontWeight:'bold', color:'#3498db'}}>{eff.type}</span>
                  <button onClick={() => removeEffect(i)} style={btnStyle('#c0392b')}>×</button>
                </div>
                <div style={{fontSize:'0.8em', color:'#bdc3c7'}}>
                  {eff.target && `Target: ${eff.target.player} ${eff.target.count}枚`}
                  {eff.value !== 0 && ` Value: ${eff.value}`}
                  {eff.raw_text && ` ("${eff.raw_text}")`}
                </div>
              </div>
            ))}
          </div>

          <div style={sectionStyle}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px'}}>
               <label style={labelStyle}>✅ 検証 (Verification)</label>
               <button onClick={addVerification} style={{...btnStyle('#7f8c8d'), padding:'2px 8px'}}>+ 追加</button>
            </div>
            {verifications.map((v, i) => (
              <div key={i} style={{display:'flex', flexWrap:'wrap', gap:'5px', marginBottom:'5px', background:'rgba(0,0,0,0.2)', padding:'5px', borderRadius:'4px'}}>
                <select value={v.targetPlayer} onChange={e => updateVerification(i, 'targetPlayer', e.target.value)} style={{...inputStyle, width:'60px'}}>
                  <option value="OPPONENT">相手</option>
                  <option value="SELF">自分</option>
                </select>
                <select value={v.targetProperty} onChange={e => updateVerification(i, 'targetProperty', e.target.value)} style={{...inputStyle, width:'80px'}}>
                  <option value="field">盤面</option>
                  <option value="hand">手札</option>
                  <option value="life">ライフ</option>
                </select>
                <select value={v.operator} onChange={e => updateVerification(i, 'operator', e.target.value)} style={{...inputStyle, width:'80px'}}>
                  <option value="DECREASE_BY">減る</option>
                  <option value="INCREASE_BY">増える</option>
                </select>
                <input value={v.value} onChange={e => updateVerification(i, 'value', e.target.value)} placeholder="1" style={{...inputStyle, width:'40px'}} />
                <button onClick={() => removeVerification(i)} style={btnStyle('#c0392b')}>×</button>
              </div>
            ))}
          </div>
          
           <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>補足メモ</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} style={{...inputStyle, width: '100%', boxSizing:'border-box'}} />
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
