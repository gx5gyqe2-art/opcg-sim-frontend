import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { 
  EffectReport, EffectTrigger, CostType, ActionType,
  CostDefinition, EffectDefinition, VerificationCheck,
  TargetPlayer, CardZone, CardTypeFilter, TargetSelector
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
  const [trigger, setTrigger] = useState<EffectTrigger>('ON_PLAY');
  const [conditionText, setConditionText] = useState('');
  const [note, setNote] = useState('');

  const [showCardSelector, setShowCardSelector] = useState(false);
  const [selectionRange, setSelectionRange] = useState<{start: number, end: number, text: string} | null>(null);
  const [selectedSegmentIndices, setSelectedSegmentIndices] = useState<number[]>([]);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const [costs, setCosts] = useState<CostDefinition[]>([]);
  const [effects, setEffects] = useState<EffectDefinition[]>([]);
  const [verifications, setVerifications] = useState<VerificationCheck[]>([]);

  // テキスト分割: 句読点やスペース、特定のキーワードで細かく区切る
  const textSegments = useMemo(() => {
    if (!rawText) return [];
    return rawText
      .split(/([【\[].*?[\]】]|ドン!!(?:[-−×x]?\d+|.*?)|[:：。、,\n\s]+|(?=attribute)|(?=パワー)|(?=コスト))/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }, [rawText]);

  const toggleSegment = (index: number) => {
    setSelectionRange(null);
    setSelectedSegmentIndices(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      } else {
        return [...prev, index].sort((a, b) => a - b);
      }
    });
  };

  // --- 解析ロジック ---

  const guessTrigger = (text: string): EffectTrigger | null => {
    if (text.match(/登場時|OnPlay/i)) return 'ON_PLAY';
    if (text.match(/アタック時|WhenAttacking/i)) return 'WHEN_ATTACKING';
    if (text.match(/起動メイン|ActivateMain/i)) return 'ACTIVATE_MAIN';
    if (text.match(/ブロック時|OnBlock/i)) return 'ON_BLOCK';
    if (text.match(/KO時|OnKO/i)) return 'ON_KO';
    if (text.match(/ターン終了時|TurnEnd/i)) return 'TURN_END';
    if (text.match(/トリガー|Trigger/i)) return 'TRIGGER';
    if (text.match(/速攻|ブロッカー/)) return 'RULE';
    return null;
  };

  const guessCost = (text: string): CostDefinition => {
    let type: CostType = 'NONE';
    let amount = 1;

    if (text.match(/ドン!!\s*[-−]\s*(\d+)/)) {
      type = 'DOWN_DON';
      amount = parseInt(RegExp.$1);
    } else if (text.match(/ドン!!\s*(\d+)\s*枚をレスト/)) {
      type = 'REST_DON';
      amount = parseInt(RegExp.$1);
    } else if (text.match(/ドン!!\s*(\d+)\s*枚を(戻|デッキ)/)) {
      type = 'RETURN_DON';
      amount = parseInt(RegExp.$1);
    } else if (text.match(/手札(\d+)枚を捨てる/)) {
      type = 'TRASH_HAND';
      amount = parseInt(RegExp.$1);
    }
    // 判定できなくてもテキストは残す
    return { type, amount, rawText: text };
  };

  const guessTarget = (text: string): TargetSelector => {
    const isSelf = text.match(/自分|味方/);
    const isOpponent = text.match(/相手|敵/);
    
    let zone: CardZone = 'FIELD';
    if (text.match(/手札/)) zone = 'HAND';
    if (text.match(/ライフ/)) zone = 'LIFE';
    if (text.match(/トラッシュ/)) zone = 'TRASH';

    let cardType: CardTypeFilter = 'ALL';
    if (text.match(/キャラ/)) cardType = 'CHARACTER';
    if (text.match(/リーダー/)) cardType = 'LEADER';
    if (text.match(/ステージ/)) cardType = 'STAGE';
    if (text.match(/イベント/)) cardType = 'EVENT';

    let count = 1;
    const numMatch = text.match(/(\d+)枚/);
    if (numMatch) count = parseInt(numMatch[1]);

    return {
      player: isSelf ? 'SELF' : (isOpponent ? 'OPPONENT' : 'OPPONENT'), // デフォルト相手
      zone,
      cardType,
      filterQuery: text, // 抽出したテキストをそのまま条件クエリとして入れる
      count
    };
  };

  const guessActionType = (text: string): { type: ActionType, value?: string } => {
    if (text.match(/KO/i)) return { type: 'KO' };
    if (text.match(/手札に戻す|バウンス/)) return { type: 'RETURN_TO_HAND' };
    if (text.match(/レスト/)) return { type: 'REST' };
    if (text.match(/アクティブ/)) return { type: 'ACTIVE' };
    if (text.match(/トラッシュ/)) return { type: 'TRASH' };
    if (text.match(/引く|ドロー/)) return { type: 'DRAW' };
    if (text.match(/登場/)) return { type: 'PLAY' };
    if (text.match(/ライフ.*(加える|増やす)/)) return { type: 'ADD_LIFE' };
    
    const powerMatch = text.match(/パワー\s*([+＋\-−]\d+)/);
    if (powerMatch) return { type: 'BUFF_POWER', value: powerMatch[1] };
    
    return { type: 'OTHER' };
  };

  // --- 選択適用ロジック ---

  const applySelection = (category: 'TRIGGER' | 'CONDITION' | 'COST' | 'TARGET' | 'ACTION') => {
    let text = "";
    if (selectionRange) {
      text = selectionRange.text;
    } else if (selectedSegmentIndices.length > 0) {
      text = selectedSegmentIndices.map(i => textSegments[i]).join('');
    }
    if (!text) return;

    switch (category) {
      case 'TRIGGER':
        const t = guessTrigger(text);
        if (t) setTrigger(t);
        break;
      
      case 'CONDITION':
        setConditionText(prev => prev ? prev + " / " + text : text);
        break;
      
      case 'COST':
        setCosts([...costs, guessCost(text)]);
        break;
      
      case 'TARGET': {
        // 対象のみを指定。最後の効果が空(OTHER)ならそこにマージ、そうでなければ新規作成
        const target = guessTarget(text);
        setEffects(prev => {
          const lastIdx = prev.length - 1;
          // 最後の効果が存在し、かつアクションが未定(OTHER) または ターゲットが未定の場合
          if (lastIdx >= 0 && (prev[lastIdx].type === 'OTHER' || !prev[lastIdx].target)) {
            const newEffects = [...prev];
            newEffects[lastIdx] = { ...newEffects[lastIdx], target };
            return newEffects;
          } else {
            // 新規効果として追加（アクションは後で決める）
            return [...prev, { type: 'OTHER', target, rawText: text }];
          }
        });
        break;
      }

      case 'ACTION': {
        // アクションを指定。
        const { type, value } = guessActionType(text);
        setEffects(prev => {
          const lastIdx = prev.length - 1;
          // 最後の効果が存在し、アクションが未定(OTHER)なら上書き
          if (lastIdx >= 0 && prev[lastIdx].type === 'OTHER') {
            const newEffects = [...prev];
            newEffects[lastIdx] = { ...newEffects[lastIdx], type, value, rawText: (newEffects[lastIdx].rawText || '') + text };
            return newEffects;
          } else {
            // 最後の効果が既に埋まっているなら、新しい効果箱を作成（これで複数効果に対応）
            return [...prev, { type, value, rawText: text }];
          }
        });
        break;
      }
    }
    
    // リセット
    setSelectionRange(null);
    setSelectedSegmentIndices([]);
  };

  // --- UI Helpers ---
  // (カード選択などは変更なし)
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
      setSelectedSegmentIndices([]);
    }
    setShowCardSelector(false);
  };

  const updateCost = (idx: number, field: keyof CostDefinition, val: any) => {
    const newCosts = [...costs]; (newCosts[idx] as any)[field] = val; setCosts(newCosts);
  };
  const removeCost = (idx: number) => setCosts(costs.filter((_, i) => i !== idx));

  const addEffect = () => setEffects([...effects, { type: 'OTHER', target: { player: 'OPPONENT', zone: 'FIELD', cardType: 'CHARACTER', filterQuery: '', count: 1 } }]);
  const updateEffect = (idx: number, field: keyof EffectDefinition, val: any) => {
    const newEffects = [...effects]; (newEffects[idx] as any)[field] = val; setEffects(newEffects);
  };
  const updateEffectTarget = (idx: number, field: string, val: any) => {
    const newEffects = [...effects]; if (!newEffects[idx].target) return; (newEffects[idx].target as any)[field] = val; setEffects(newEffects);
  };
  const removeEffect = (idx: number) => setEffects(effects.filter((_, i) => i !== idx));

  const addVerification = () => setVerifications([...verifications, { targetPlayer: 'OPPONENT', targetProperty: 'field', operator: 'DECREASE_BY', value: 1 }]);
  const updateVerification = (idx: number, field: keyof VerificationCheck, val: any) => {
    const newVer = [...verifications]; (newVer[idx] as any)[field] = val; setVerifications(newVer);
  };
  const removeVerification = (idx: number) => setVerifications(verifications.filter((_, i) => i !== idx));

  const handleSubmit = () => {
    const report: EffectReport = {
      correction: {
        cardName: inputCardName,
        rawText,
        structuredEffect: { trigger, costs, conditions: conditionText, effects }
      },
      verification: { expectedStateChanges: verifications },
      note
    };
    onSubmit(report);
  };

  const handleTextSelect = () => {
    const el = textAreaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = el.value.substring(start, end).trim();
    if (text.length > 0) {
      setSelectionRange({ start, end, text });
      setSelectedSegmentIndices([]); 
    } else {
      setSelectionRange(null);
    }
  };

  // Styles
  const overlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' };
  const formContainerStyle: React.CSSProperties = { width: '100%', height: '100%', backgroundColor: '#2c3e50', color: '#ecf0f1', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' };
  const scrollAreaStyle: React.CSSProperties = { flex: 1, overflowY: 'auto', padding: '15px', paddingBottom: '120px', WebkitOverflowScrolling: 'touch' };
  const sectionStyle: React.CSSProperties = { marginBottom: '20px', border: '1px solid #7f8c8d', padding: '10px', borderRadius: '8px', background: '#34495e' };
  const inputStyle: React.CSSProperties = { padding: '8px', borderRadius: '4px', border: '1px solid #7f8c8d', background: '#2c3e50', color: 'white', flex: 1, fontSize: '14px', maxWidth: '100%' };
  const btnStyle = (bg: string) => ({ padding: '8px 12px', background: bg, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', whiteSpace: 'nowrap' });
  const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9em', color: '#bdc3c7' };

  const currentSelection = selectionRange 
    ? selectionRange.text 
    : selectedSegmentIndices.map(i => textSegments[i]).join('');

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
            <label style={labelStyle}>① カードテキストから抽出</label>
            <div style={{display: 'flex', gap: '8px', marginBottom: '10px'}}>
              <input value={inputCardName} readOnly placeholder="カードを選択してください" style={{...inputStyle, background: '#2c3e50'}} />
              <button onClick={() => setShowCardSelector(true)} style={btnStyle('#e67e22')}>カード選択</button>
            </div>
            
            <div style={{marginBottom:'10px'}}>
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '6px', 
                padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', minHeight: '40px',
                marginBottom: '5px'
              }}>
                {textSegments.length === 0 && <span style={{color:'#95a5a6', fontSize:'0.8em'}}>テキストがありません</span>}
                {textSegments.map((seg, idx) => {
                  const isSelected = selectedSegmentIndices.includes(idx);
                  return (
                    <button
                      key={idx}
                      onClick={() => toggleSegment(idx)}
                      style={{
                        padding: '6px 10px',
                        background: isSelected ? '#3498db' : '#34495e',
                        color: 'white',
                        border: isSelected ? '1px solid #2980b9' : '1px solid #7f8c8d',
                        borderRadius: '16px', fontSize: '12px', cursor: 'pointer', transition: 'all 0.1s',
                        textAlign: 'left', maxWidth: '100%'
                      }}
                    >
                      {seg}
                    </button>
                  );
                })}
              </div>
              <textarea 
                ref={textAreaRef}
                value={rawText} 
                onChange={e => setRawText(e.target.value)}
                onSelect={handleTextSelect}
                placeholder="直接編集や範囲選択も可能" 
                style={{...inputStyle, width: '100%', height: '40px', fontFamily: 'monospace', fontSize: '12px', boxSizing:'border-box'}} 
              />
            </div>

            {/* アクションメニュー */}
            <div style={{
              position: 'sticky', bottom: '0', 
              background: '#2980b9', padding: '10px', borderRadius: '4px', 
              display: 'flex', gap: '5px', zIndex: 10, overflowX: 'auto',
              boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
            }}>
              <span style={{fontSize:'11px', alignSelf:'center', color:'white', whiteSpace:'nowrap', maxWidth:'80px', overflow:'hidden', textOverflow:'ellipsis'}}>
                {currentSelection ? `「${currentSelection}」` : '選択なし'}
              </span>
              <button onClick={() => applySelection('TRIGGER')} disabled={!currentSelection} style={{...btnStyle('#16a085'), opacity: !currentSelection?0.5:1}}>トリガー</button>
              <button onClick={() => applySelection('CONDITION')} disabled={!currentSelection} style={{...btnStyle('#8e44ad'), opacity: !currentSelection?0.5:1}}>条件</button>
              <button onClick={() => applySelection('COST')} disabled={!currentSelection} style={{...btnStyle('#d35400'), opacity: !currentSelection?0.5:1}}>コスト</button>
              {/* 分離したボタン */}
              <button onClick={() => applySelection('TARGET')} disabled={!currentSelection} style={{...btnStyle('#2c3e50'), border:'1px solid #3498db', opacity: !currentSelection?0.5:1}}>対象</button>
              <button onClick={() => applySelection('ACTION')} disabled={!currentSelection} style={{...btnStyle('#c0392b'), opacity: !currentSelection?0.5:1}}>アクション</button>
            </div>
          </div>

          <div style={sectionStyle}>
            <div style={{marginBottom: '10px'}}>
              <label style={{fontSize:'0.9em', color:'#bdc3c7'}}>発動タイミング</label>
              <select value={trigger} onChange={e => setTrigger(e.target.value as EffectTrigger)} style={{...inputStyle, width: '100%'}}>
                <option value="ON_PLAY">登場時</option>
                <option value="WHEN_ATTACKING">アタック時</option>
                <option value="ACTIVATE_MAIN">起動メイン</option>
                <option value="ON_BLOCK">ブロック時</option>
                <option value="ON_KO">KO時</option>
                <option value="TURN_END">ターン終了時</option>
                <option value="TRIGGER">トリガー</option>
                <option value="RULE">ルール効果</option>
                <option value="OTHER">その他</option>
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
              <div key={i} style={{display:'flex', gap:'5px', marginBottom:'5px', alignItems:'center'}}>
                <select value={c.type} onChange={e => updateCost(i, 'type', e.target.value)} style={{...inputStyle, flex:2}}>
                  <option value="DOWN_DON">ドン!!-</option>
                  <option value="REST_DON">ドン!!レスト</option>
                  <option value="RETURN_DON">ドン!!戻す</option>
                  <option value="TRASH_HAND">手札捨て</option>
                  <option value="NONE">なし</option>
                </select>
                <input type="number" value={c.amount} onChange={e => updateCost(i, 'amount', Number(e.target.value))} style={{...inputStyle, flex:1, textAlign:'center'}} />
                {c.rawText && <span style={{fontSize:'0.7em', color:'#95a5a6'}}>({c.rawText})</span>}
                <button onClick={() => removeCost(i)} style={btnStyle('#c0392b')}>×</button>
              </div>
            ))}
          </div>

          <div style={sectionStyle}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px'}}>
              <label style={labelStyle}>④ 効果 (Effects)</label>
              <button onClick={addEffect} style={{...btnStyle('#7f8c8d'), padding:'2px 8px'}}>+ 追加</button>
            </div>
            {effects.map((eff, i) => (
              <div key={i} style={{background: 'rgba(0,0,0,0.2)', padding:'8px', marginBottom:'8px', borderRadius:'4px'}}>
                <div style={{display:'flex', gap:'5px', marginBottom:'5px'}}>
                  <select value={eff.type} onChange={e => updateEffect(i, 'type', e.target.value)} style={{...inputStyle, flex:2}}>
                    <option value="KO">KO</option>
                    <option value="RETURN_TO_HAND">バウンス</option>
                    <option value="REST">レスト</option>
                    <option value="ACTIVE">アクティブ</option>
                    <option value="BUFF_POWER">パワー+</option>
                    <option value="DRAW">ドロー</option>
                    <option value="ADD_DON_ACTIVE">ドン追加</option>
                    <option value="ADD_LIFE">ライフ追加</option>
                    <option value="OTHER">その他</option>
                  </select>
                  <button onClick={() => removeEffect(i)} style={btnStyle('#c0392b')}>削除</button>
                </div>
                
                <div style={{ fontSize: '0.9em', marginLeft:'5px', borderLeft:'2px solid #3498db', paddingLeft:'5px' }}>
                  <div style={{display:'flex', gap:'5px', marginBottom:'5px'}}>
                    <select value={eff.target?.player} onChange={e => updateEffectTarget(i, 'player', e.target.value)} style={inputStyle}>
                      <option value="OPPONENT">相手</option>
                      <option value="SELF">自分</option>
                    </select>
                    <select value={eff.target?.cardType} onChange={e => updateEffectTarget(i, 'cardType', e.target.value)} style={inputStyle}>
                      <option value="CHARACTER">キャラ</option>
                      <option value="LEADER">リーダー</option>
                      <option value="ALL">すべて</option>
                    </select>
                      <input type="number" value={eff.target?.count} onChange={e => updateEffectTarget(i, 'count', Number(e.target.value))} style={{...inputStyle, width:'40px'}} />
                  </div>
                  <input value={eff.target?.filterQuery} onChange={e => updateEffectTarget(i, 'filterQuery', e.target.value)} placeholder="対象条件 (例: Cost<=4)" style={{...inputStyle, width:'100%', boxSizing:'border-box'}} />
                </div>
                
                {['BUFF_POWER', 'ADD_DON_ACTIVE'].includes(eff.type) && (
                  <input value={eff.value} onChange={e => updateEffect(i, 'value', e.target.value)} placeholder="値 (+1000)" style={{...inputStyle, marginTop:'5px', width:'100%', boxSizing:'border-box'}} />
                )}
                {eff.rawText && <div style={{fontSize:'0.7em', color:'#bdc3c7', marginTop:'2px'}}>元の文: {eff.rawText}</div>}
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
