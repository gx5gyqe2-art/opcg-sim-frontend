import React, { useState, useMemo } from 'react';
import type { 
  EffectReport, EffectTrigger, 
  CostDefinition, EffectDefinition, VerificationCheck
} from '../game/effectReporting';

interface Props {
  cardName?: string;
  gameState: any; // GameState型だが、柔軟に対応するためany
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

export const EffectReportForm: React.FC<Props> = ({ cardName = '', gameState, activePlayerId, onSubmit, onCancel }) => {
  // 基本情報
  const [inputCardName, setInputCardName] = useState(cardName);
  const [rawText, setRawText] = useState('');
  const [trigger, setTrigger] = useState<EffectTrigger>('ON_PLAY');
  const [conditionText, setConditionText] = useState('');
  const [note, setNote] = useState('');

  // UI状態
  const [showCardSelector, setShowCardSelector] = useState(false);

  // リスト項目
  const [costs, setCosts] = useState<CostDefinition[]>([]);
  const [effects, setEffects] = useState<EffectDefinition[]>([]);
  const [verifications, setVerifications] = useState<VerificationCheck[]>([]);

  // --- カード抽出ロジック ---
  const visibleCards = useMemo(() => {
    if (!gameState) return [];
    const cards: SimpleCard[] = [];
    
    const processPlayer = (pid: string, pData: any) => {
      const ownerLabel = pid === activePlayerId ? '自分' : '相手';
      
      // Leader
      if (pData.leader) {
        cards.push({ uuid: pData.leader.uuid, name: pData.leader.name, text: pData.leader.text, owner: ownerLabel, zone: 'リーダー' });
      }
      // Stage
      if (pData.stage) {
        cards.push({ uuid: pData.stage.uuid, name: pData.stage.name, text: pData.stage.text, owner: ownerLabel, zone: 'ステージ' });
      }
      // Field
      pData.zones.field.forEach((c: any) => {
        cards.push({ uuid: c.uuid, name: c.name, text: c.text, owner: ownerLabel, zone: '盤面' });
      });
      // Hand
      pData.zones.hand.forEach((c: any) => {
        cards.push({ uuid: c.uuid, name: c.name, text: c.text, owner: ownerLabel, zone: '手札' });
      });
      // Trash
      pData.zones.trash.forEach((c: any) => {
        cards.push({ uuid: c.uuid, name: c.name, text: c.text, owner: ownerLabel, zone: 'トラッシュ' });
      });
    };

    if (gameState.players.p1) processPlayer('p1', gameState.players.p1);
    if (gameState.players.p2) processPlayer('p2', gameState.players.p2);

    return cards;
  }, [gameState, activePlayerId]);

  const handleSelectCard = (card: SimpleCard) => {
    setInputCardName(card.name);
    if (card.text) setRawText(card.text);
    setShowCardSelector(false);
  };

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

  // Styles (Mobile Optimized)
  const overlayStyle: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
    backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 10000,
    display: 'flex', justifyContent: 'center', alignItems: 'flex-end' // Bottom sheet style usually
  };
  
  const formContainerStyle: React.CSSProperties = {
    width: '100%', maxWidth: '600px', height: '95vh', 
    backgroundColor: '#2c3e50', color: '#ecf0f1',
    borderTopLeftRadius: '16px', borderTopRightRadius: '16px',
    padding: '16px', boxSizing: 'border-box',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden' // 内部スクロールのため
  };

  const scrollAreaStyle: React.CSSProperties = {
    flex: 1, overflowY: 'auto', paddingBottom: '20px', WebkitOverflowScrolling: 'touch'
  };

  const sectionStyle: React.CSSProperties = { 
    marginBottom: '24px', border: '1px solid #7f8c8d', padding: '12px', borderRadius: '8px', background: '#34495e' 
  };
  
  const labelStyle: React.CSSProperties = {
    display: 'block', marginBottom: '8px', color: '#95a5a6', fontSize: '0.9em', fontWeight: 'bold'
  };

  const rowStyle: React.CSSProperties = { display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' };
  const inputStyle: React.CSSProperties = { 
    padding: '10px', borderRadius: '6px', border: '1px solid #7f8c8d', 
    background: '#2c3e50', color: 'white', flex: 1, fontSize: '16px' // 16px to prevent iOS zoom
  };
  
  const btnStyle = (bg: string) => ({ 
    padding: '8px 12px', background: bg, color: 'white', border: 'none', 
    borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px',
    minHeight: '40px' // タップしやすく
  });

  // カード選択モーダル
  if (showCardSelector) {
    return (
      <div style={overlayStyle}>
        <div style={{...formContainerStyle, height: '80vh'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
            <h3>🃏 対象カードを選択</h3>
            <button onClick={() => setShowCardSelector(false)} style={btnStyle('#95a5a6')}>閉じる</button>
          </div>
          <div style={scrollAreaStyle}>
            {visibleCards.length === 0 && <p>選択可能なカードがありません</p>}
            {visibleCards.map((c) => (
              <div 
                key={c.uuid} 
                onClick={() => handleSelectCard(c)}
                style={{
                  padding: '12px', borderBottom: '1px solid #7f8c8d', cursor: 'pointer',
                  background: inputCardName === c.name ? '#2980b9' : 'transparent'
                }}
              >
                <div style={{fontWeight: 'bold'}}>{c.name}</div>
                <div style={{fontSize: '0.8em', color: '#bdc3c7'}}>
                  [{c.owner}] {c.zone}
                </div>
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
        
        {/* ヘッダー */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid #7f8c8d', paddingBottom: '10px' }}>
          <h3 style={{ margin: 0 }}>🛠 効果修正レポート</h3>
          <button onClick={onCancel} style={{ background: 'transparent', border: 'none', color: '#bdc3c7', fontSize: '24px' }}>×</button>
        </div>

        {/* スクロール領域 */}
        <div style={scrollAreaStyle}>
          
          {/* 1. 基本情報 */}
          <div style={sectionStyle}>
            <label style={labelStyle}>① 対象カードとタイミング</label>
            <div style={{display: 'flex', gap: '8px', marginBottom: '10px'}}>
              <input 
                placeholder="カード名 (選択で自動入力)" 
                value={inputCardName} 
                readOnly
                style={{...inputStyle, background: '#2c3e50', opacity: 0.8}} 
              />
              <button onClick={() => setShowCardSelector(true)} style={btnStyle('#e67e22')}>選択</button>
            </div>

            <div style={{marginBottom: '10px'}}>
              <label style={{fontSize:'0.8em', color:'#bdc3c7'}}>発動タイミング</label>
              <select value={trigger} onChange={e => setTrigger(e.target.value as EffectTrigger)} style={{...inputStyle, width: '100%'}}>
                <option value="ON_PLAY">登場時 (OnPlay)</option>
                <option value="WHEN_ATTACKING">アタック時 (WhenAttacking)</option>
                <option value="ACTIVATE_MAIN">起動メイン (ActivateMain)</option>
                <option value="ON_BLOCK">ブロック時 (OnBlock)</option>
                <option value="ON_KO">KO時 (OnKO)</option>
                <option value="TURN_END">ターン終了時 (TurnEnd)</option>
                <option value="TRIGGER">トリガー (Trigger)</option>
                <option value="OTHER">その他</option>
              </select>
            </div>

            <textarea 
              placeholder="カードテキスト原文 (自動入力されます)" 
              value={rawText} onChange={e => setRawText(e.target.value)} 
              style={{...inputStyle, width: '100%', height: '60px', fontFamily: 'monospace', fontSize: '12px'}} 
            />
          </div>

          {/* 2. 条件 (分離) */}
          <div style={sectionStyle}>
            <label style={labelStyle}>② 発動条件 (Condition)</label>
            <input 
              placeholder="例: リーダーが特徴《麦わら》を持つ場合" 
              value={conditionText} 
              onChange={e => setConditionText(e.target.value)} 
              style={{...inputStyle, width: '100%'}} 
            />
          </div>

          {/* 3. コスト */}
          <div style={sectionStyle}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px'}}>
              <label style={{...labelStyle, marginBottom:0}}>③ コスト (Cost)</label>
              <button onClick={addCost} style={{...btnStyle('#7f8c8d'), padding:'4px 8px', fontSize:'12px'}}>+ 追加</button>
            </div>
            
            {costs.length === 0 && <div style={{color:'#7f8c8d', fontSize:'0.9em', textAlign:'center'}}>コストなし</div>}
            
            {costs.map((c, i) => (
              <div key={i} style={rowStyle}>
                <select value={c.type} onChange={e => updateCost(i, 'type', e.target.value)} style={inputStyle}>
                  <option value="DOWN_DON">ドン!!-</option>
                  <option value="REST_DON">ドン!!レスト</option>
                  <option value="TRASH_CARD">手札を捨てる</option>
                  <option value="RETURN_DON">ドン!!を戻す</option>
                </select>
                <input type="number" value={c.amount} onChange={e => updateCost(i, 'amount', Number(e.target.value))} style={{...inputStyle, maxWidth: '60px', textAlign:'center'}} />
                <button onClick={() => removeCost(i)} style={btnStyle('#c0392b')}>×</button>
              </div>
            ))}
          </div>

          {/* 4. 効果定義 */}
          <div style={sectionStyle}>
             <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px'}}>
              <label style={{...labelStyle, marginBottom:0}}>④ 効果内容 (Effects)</label>
              <button onClick={addEffect} style={{...btnStyle('#7f8c8d'), padding:'4px 8px', fontSize:'12px'}}>+ 追加</button>
            </div>

            {effects.map((eff, i) => (
              <div key={i} style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', marginBottom: '10px', borderRadius: '4px' }}>
                <div style={rowStyle}>
                  <select value={eff.type} onChange={e => updateEffect(i, 'type', e.target.value)} style={inputStyle}>
                    <option value="KO">KOする</option>
                    <option value="RETURN_TO_HAND">手札に戻す</option>
                    <option value="REST">レストにする</option>
                    <option value="ACTIVE">アクティブにする</option>
                    <option value="TRASH">トラッシュ送</option>
                    <option value="BUFF_POWER">パワー増減</option>
                    <option value="ADD_DON_ACTIVE">ドン追加(アクティブ)</option>
                    <option value="DRAW">ドロー</option>
                    <option value="OTHER">その他</option>
                  </select>
                  <button onClick={() => removeEffect(i)} style={btnStyle('#c0392b')}>削除</button>
                </div>
                
                {/* 対象セレクタ */}
                {['KO', 'RETURN_TO_HAND', 'REST', 'ACTIVE', 'TRASH', 'BUFF_POWER'].includes(eff.type) && eff.target && (
                  <div style={{ fontSize: '0.9em', paddingLeft: '8px', borderLeft: '2px solid #3498db', marginTop:'5px' }}>
                    <div style={rowStyle}>
                      <select value={eff.target.player} onChange={e => updateEffectTarget(i, 'player', e.target.value)} style={inputStyle}>
                        <option value="OPPONENT">相手の</option>
                        <option value="SELF">自分の</option>
                        <option value="BOTH">お互い</option>
                      </select>
                      <select value={eff.target.zone} onChange={e => updateEffectTarget(i, 'zone', e.target.value)} style={inputStyle}>
                        <option value="FIELD">盤面</option>
                        <option value="HAND">手札</option>
                        <option value="LIFE">ライフ</option>
                        <option value="TRASH">トラッシュ</option>
                      </select>
                    </div>
                    <div style={rowStyle}>
                      <select value={eff.target.cardType} onChange={e => updateEffectTarget(i, 'cardType', e.target.value)} style={inputStyle}>
                        <option value="CHARACTER">キャラ</option>
                        <option value="LEADER">リーダー</option>
                        <option value="STAGE">ステージ</option>
                        <option value="ALL">全部</option>
                      </select>
                       <input type="number" placeholder="枚" value={eff.target.count} onChange={e => updateEffectTarget(i, 'count', Number(e.target.value))} style={{...inputStyle, maxWidth: '50px'}} />
                       <span style={{fontSize:'0.8em'}}>枚</span>
                    </div>
                    <div style={rowStyle}>
                       <input placeholder="条件 (例: Cost<=4)" value={eff.target.filterQuery} onChange={e => updateEffectTarget(i, 'filterQuery', e.target.value)} style={{...inputStyle, width:'100%'}} />
                    </div>
                  </div>
                )}
                
                {['BUFF_POWER', 'ADD_DON_ACTIVE', 'DRAW'].includes(eff.type) && (
                  <input placeholder="値 (例: +1000, 2)" value={eff.value || ''} onChange={e => updateEffect(i, 'value', e.target.value)} style={{...inputStyle, marginTop:'5px'}} />
                )}
              </div>
            ))}
          </div>

          {/* 5. 検証条件 */}
          <div style={sectionStyle}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px'}}>
              <label style={{...labelStyle, marginBottom:0}}>✅ 検証 (Verification)</label>
              <button onClick={addVerification} style={{...btnStyle('#7f8c8d'), padding:'4px 8px', fontSize:'12px'}}>+ 追加</button>
            </div>

            {verifications.map((v, i) => (
              <div key={i} style={{...rowStyle, flexWrap: 'wrap', background: 'rgba(0,0,0,0.2)', padding:'5px', borderRadius:'4px'}}>
                <select value={v.targetPlayer} onChange={e => updateVerification(i, 'targetPlayer', e.target.value)} style={{...inputStyle, minWidth:'80px'}}>
                  <option value="OPPONENT">相手</option>
                  <option value="SELF">自分</option>
                </select>
                <select value={v.targetProperty} onChange={e => updateVerification(i, 'targetProperty', e.target.value)} style={{...inputStyle, minWidth:'100px'}}>
                  <option value="field">盤面枚数</option>
                  <option value="hand">手札枚数</option>
                  <option value="life">ライフ</option>
                  <option value="don_active">アクティブドン</option>
                </select>
                <select value={v.operator} onChange={e => updateVerification(i, 'operator', e.target.value)} style={{...inputStyle, minWidth:'100px'}}>
                  <option value="DECREASE_BY">が減る</option>
                  <option value="INCREASE_BY">が増える</option>
                  <option value="CONTAINS">を含む</option>
                  <option value="NOT_CONTAINS">含まない</option>
                </select>
                <input placeholder="値" value={v.value} onChange={e => updateVerification(i, 'value', e.target.value)} style={{...inputStyle, maxWidth: '60px'}} />
                <button onClick={() => removeVerification(i)} style={btnStyle('#c0392b')}>×</button>
              </div>
            ))}
          </div>
          
           <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>補足メモ</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              style={{...inputStyle, width: '100%'}}
            />
          </div>

        </div>

        {/* フッターアクション */}
        <div style={{ paddingTop: '10px', borderTop: '1px solid #7f8c8d', display: 'flex', gap: '10px' }}>
          <button onClick={onCancel} style={{...btnStyle('#7f8c8d'), flex: 1, padding: '12px'}}>キャンセル</button>
          <button onClick={handleSubmit} style={{...btnStyle('#27ae60'), flex: 1, padding: '12px', fontSize:'16px'}}>報告送信</button>
        </div>

      </div>
    </div>
  );
};
